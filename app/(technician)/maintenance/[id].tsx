// app/(technician)/maintenance/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../../components/ui/Button";
import { LoadingOverlay } from "../../../components/ui/LoadingOverlay";
import { Colors } from "../../../constants/Colors";
import { useAuth } from "../../../context/AuthContext";
import { api, uploadAPI } from "../../../services/api";
import { maintenanceWorkflowAPI } from "../../../services/maintenanceWorkflowAPI";
import { isRestrictedAcScopeRole } from "../../../utils/roles";

type CheckItem = {
  type: string;
  title: string;
  icon: string;
  status: "completed" | "pending";
};

const ALL_CHECKS = [
  { type: "generator",     title: "Generator Check", icon: "bolt" },
  { type: "power_cabinet", title: "Power Cabinet",   icon: "hdd" },
  { type: "grid",          title: "Grid Power",       icon: "plug" },
  { type: "shelter",       title: "Shelter",          icon: "home" },
  { type: "fuel_tank",     title: "Fuel Tank",        icon: "tint" },
  { type: "cleaning",      title: "Site Cleaning",    icon: "broom" },
];

export default function MaintenanceChecklist() {
  const params = useLocalSearchParams<{
    id: string;
    workflowId?: string;
    siteId?: string;
    siteName?: string;
    visitDate?: string;
  }>();
  const { id } = params;
  const router = useRouter();
  const { user } = useAuth();

  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [siteName, setSiteName] = useState(params.siteName ?? "");
  const [siteId, setSiteId] = useState(params.siteId ?? "");
  const [taskStatus, setTaskStatus] = useState<string>("in_progress");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── Workflow state ─────────────────────────────────────────────────────────
  const [workflowId, setWorkflowId] = useState(params.workflowId ?? "");
  const formOpenedPatched = useRef(false);

  // ── Build check list based on role ────────────────────────────────────────
  const getChecksForRole = useCallback(() => {
    if (isRestrictedAcScopeRole(user?.role)) {
      return ALL_CHECKS.filter((c) =>
        ["shelter", "cleaning"].includes(c.type)
      );
    }
    return ALL_CHECKS;
  }, [user?.role]);

  useEffect(() => {
    setChecks(getChecksForRole().map((c) => ({ ...c, status: "pending" })));
  }, [user?.role]);

  // ── Resolve workflowId if not passed via params ───────────────────────────
  useEffect(() => {
    if (workflowId || !id) return;
    maintenanceWorkflowAPI
      .getActiveByMaintenance(String(id))
      .then((res) => {
        const wId = String(res.data?.data?._id ?? "");
        if (wId && wId !== "undefined" && wId !== "null") {
          setWorkflowId(wId);
        }
      })
      .catch(() => {});
  }, [id, workflowId]);

  // ── Patch form_opened once ────────────────────────────────────────────────
  useEffect(() => {
    if (!workflowId || formOpenedPatched.current) return;
    formOpenedPatched.current = true;
    maintenanceWorkflowAPI
      .updateStatus(workflowId, "form_opened", {
        formOpenedAt: new Date().toISOString(),
      })
      .catch(() => {});
  }, [workflowId]);

  // ── Load task metadata + check progress ──────────────────────────────────
  const loadProgress = useCallback(async () => {
    if (!id || checks.length === 0) return;

    // Fetch server state
    let serverChecks: any = {};
    try {
      const res = await api.get(`/technician/maintenance/${id}`);
      if (res.data?.data) {
        const task = res.data.data;
        setSiteName(task.site_name ?? params.siteName ?? "");
        setSiteId(task.site_id ?? params.siteId ?? "");
        setTaskStatus(task.status ?? "in_progress");
        serverChecks = task.equipment_checks ?? {};
      }
    } catch (err) {
      console.error("[MaintenanceChecklist] fetch error:", err);
    } finally {
      setLoading(false);
    }

    // Merge AsyncStorage drafts + server data to determine completion
    const updated = await Promise.all(
      checks.map(async (check) => {
        const draftKey = `draft_${check.type}_${params.siteId ?? siteId}_${id}`;
        const localDraft = await AsyncStorage.getItem(draftKey);
        const hasLocal = !!localDraft;

        const serverKey = `${check.type}_checks`;
        const serverEntry = serverChecks[serverKey];
        let hasServer = false;
        if (serverEntry) {
          if (Array.isArray(serverEntry)) hasServer = serverEntry.length > 0;
          else if (typeof serverEntry === "object")
            hasServer = Object.keys(serverEntry).length > 0;
        }

        return {
          ...check,
          status: (hasServer || hasLocal ? "completed" : "pending") as
            | "completed"
            | "pending",
        };
      })
    );

    setChecks(updated);
  }, [id, checks.length, siteId]);

  useEffect(() => {
    loadProgress();
  }, [id, checks.length]);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [id, checks.length])
  );

  // ── Navigate to equipment form ────────────────────────────────────────────
  const handlePressCheck = (type: string) => {
    router.push({
      pathname: "/(technician)/maintenance/equipment/[type]",
      params: {
        type,
        id,
        siteId: siteId || params.siteId,
        siteName: siteName || params.siteName,
        maintenanceId: id,
      },
    });
  };

  // ── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (!workflowId) return;
    router.push({
      pathname: "/(technician)/maintenance-flow/checkout-site",
      params: {
        workflowId,
        maintenanceId: String(id),
        siteId: siteId || params.siteId || "",
        siteName: siteName || params.siteName || "",
      },
    });
  };

  // ── Submit (mirrors checklist.tsx exactly) ────────────────────────────────
  const handleSubmit = async (isDraft: boolean) => {
    setSubmitting(true);
    try {
      const submissionData: any = {
        site_id: siteId || params.siteId,
        visit_type: "PM",
        siteId: siteId || params.siteId,
        maintenanceId: id,
        type: "preventive",
        visit_date: new Date().toISOString(),
        visitDate: new Date().toISOString(),
        status: isDraft ? "Draft" : "Submitted",
        checks: {},
      };

      // Merge server data first
      if (id && !isDraft) {
        try {
          const res = await api.get(`/technician/maintenance/${id}`);
          if (res.data?.data?.equipment_checks) {
            const sc = res.data.data.equipment_checks;
            if (sc.generator_checks)
              submissionData.checks.generator = sc.generator_checks;
            if (sc.power_cabinet_checks)
              submissionData.checks.power_cabinet = sc.power_cabinet_checks;
            if (sc.grid_checks) submissionData.checks.grid = sc.grid_checks;
            if (sc.shelter_checks)
              submissionData.checks.shelter = sc.shelter_checks;
            if (sc.cleaning_checks)
              submissionData.checks.cleaning = sc.cleaning_checks;
            if (sc.fuel_tank_checks)
              submissionData.checks.fuel_tank = sc.fuel_tank_checks;
          }
        } catch (e) {
          console.log("Error merging server state:", e);
        }
      }

      // Overlay local AsyncStorage drafts
      let hasData = Object.keys(submissionData.checks).length > 0;
      for (const check of checks) {
        const draftKey = `draft_${check.type}_${siteId || params.siteId}_${id}`;
        const dataStr = await AsyncStorage.getItem(draftKey);
        if (dataStr) {
          submissionData.checks[check.type] = JSON.parse(dataStr);
          hasData = true;
        }
      }

      if (!hasData && !isDraft) {
        Alert.alert(
          "Empty Submission",
          "Please complete at least one check before submitting."
        );
        setSubmitting(false);
        return;
      }

      if (!isDraft) {
        // Upload images, then submit
        const processedData =
          await uploadAPI.processAndUploadData(submissionData);
        await api.post("/technician/maintenance/submit", processedData);

        // Patch workflow steps
        if (workflowId) {
          await maintenanceWorkflowAPI.updateStatus(
            workflowId,
            "form_submitted",
            { submittedAt: new Date().toISOString() }
          );
          await maintenanceWorkflowAPI.updateStatus(
            workflowId,
            "checked_out",
            { checkedOutAt: new Date().toISOString() }
          );
        }

        // Clean up drafts
        const draftKeys = checks.map(
          (c) => `draft_${c.type}_${siteId || params.siteId}_${id}`
        );
        await AsyncStorage.multiRemove(draftKeys);

        Alert.alert(
          "Submitted Successfully",
          "The maintenance report has been submitted to your supervisor.",
          [{ text: "OK", onPress: () => router.navigate("/(technician)") }]
        );
      } else {
        await api.post("/technician/visits", submissionData);
        Alert.alert("Draft Saved", "Your progress has been saved.");
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      Alert.alert("Error", "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const completedCount = checks.filter((c) => c.status === "completed").length;
  const progress = checks.length > 0 ? completedCount / checks.length : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LoadingOverlay visible={submitting} message="Submitting..." />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.siteName}>
            {siteName || params.siteName || "Maintenance"}
          </Text>
          <Text style={styles.subTitle}>PREVENTIVE MAINTENANCE CHECKLIST</Text>
        </View>
        {/* Checkout icon */}
        {!!workflowId && (
          <TouchableOpacity onPress={handleCheckout} style={{ padding: 8 }}>
            <FontAwesome5
              name="sign-out-alt"
              size={18}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {!workflowId && <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {completedCount} of {checks.length} Completed
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Required Checks</Text>

        {/* Check items */}
        {checks.map((check, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.checkItem,
              check.status === "completed" && styles.checkItemCompleted,
            ]}
            onPress={() => handlePressCheck(check.type)}
          >
            <View style={styles.checkIcon}>
              <FontAwesome5
                name={check.icon as any}
                size={20}
                color={check.status === "completed" ? "#fff" : Colors.primary}
              />
            </View>
            <View style={styles.checkInfo}>
              <Text
                style={[
                  styles.checkTitle,
                  check.status === "completed" && { color: "#fff" },
                ]}
              >
                {check.title}
              </Text>
              <Text
                style={[
                  styles.checkStatus,
                  check.status === "completed" && {
                    color: "rgba(255,255,255,0.8)",
                  },
                ]}
              >
                {check.status === "completed" ? "Completed" : "Pending"}
              </Text>
            </View>
            <FontAwesome5
              name={
                check.status === "completed" ? "check-circle" : "chevron-right"
              }
              size={20}
              color={
                check.status === "completed" ? "#fff" : Colors.textSecondary
              }
            />
          </TouchableOpacity>
        ))}

        {/* Footer buttons — always visible like checklist.tsx */}
        <View style={styles.footer}>
          <Button
            variant="outline"
            onPress={() => handleSubmit(true)}
            style={{ marginBottom: 12 }}
          >
            Save Draft
          </Button>
          <Button variant="primary" onPress={() => handleSubmit(false)}>
            Submit Report
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 8 },
  siteName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  subTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  content: { padding: 16, paddingBottom: 40 },
  progressContainer: { marginBottom: 24 },
  progressText: {
    marginBottom: 8,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.success,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  checkItemCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  checkInfo: { flex: 1 },
  checkTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  checkStatus: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  footer: { marginTop: 32 },
});

