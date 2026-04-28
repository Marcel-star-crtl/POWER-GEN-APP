import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
import { checkOutSite } from "../../../services/siteVisit";
// import { isRestrictedAcScopeRole } from "../../../utils/roles";
import { isFuelRole, isRestrictedAcScopeRole } from "../../../utils/roles";

interface CheckItem {
  title: string;
  type: string;
  icon: string;
  status: "pending" | "completed";
}

const PREVENTIVE_CHECKS = [
  {
    titleKey: "generator_check",
    defaultTitle: "Generator Check",
    type: "generator",
    icon: "bolt",
  },
  {
    titleKey: "power_cabinet",
    defaultTitle: "Power Cabinet",
    type: "power_cabinet",
    icon: "hdd",
  },
  {
    titleKey: "grid_power",
    defaultTitle: "Grid Power",
    type: "grid",
    icon: "plug",
  },
  {
    titleKey: "shelter",
    defaultTitle: "Shelter",
    type: "shelter",
    icon: "home",
  },
  {
    titleKey: "site_cleaning",
    defaultTitle: "Site Cleaning",
    type: "cleaning",
    icon: "broom",
  },
  {
    titleKey: "fuel_log_tank",
    defaultTitle: "Fuel Log & Tank",
    type: "fuel_tank",
    icon: "tint",
    fuelOnly: true,
  },
];

const REFUELING_CHECKS = [
  {
    titleKey: "fuel_log_tank",
    defaultTitle: "Fuel Log & Tank",
    type: "fuel_tank",
    icon: "tint",
  },
];

const CORRECTIVE_CHECKS = [
  {
    titleKey: "generator_repair",
    defaultTitle: "Generator Repair",
    type: "generator",
    icon: "bolt",
  },
  {
    titleKey: "power_cabinet_repair",
    defaultTitle: "Power Cabinet Repair",
    type: "power_cabinet",
    icon: "hdd",
  },
  {
    titleKey: "rectifier_battery",
    defaultTitle: "Rectifier/Battery",
    type: "power_cabinet",
    icon: "battery-full",
  },
  {
    titleKey: "generic_repair",
    defaultTitle: "Generic Repair",
    type: "shelter",
    icon: "tools",
  },
];

export default function MaintenanceChecklist() {
  const { t } = useTranslation();
  const { siteId, siteName, type, maintenanceId, readOnly } =
    useLocalSearchParams<{
      siteId: string;
      siteName: string;
      type: string;
      maintenanceId?: string;
      readOnly?: string;
    }>();
  const { user } = useAuth();
  // const { t } = useTranslation();
  const router = useRouter();

  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // const applyRoleFilter = (items: CheckItem[]) => {
  //   if (!isRestrictedAcScopeRole(user?.role)) return items;
  //   return items.filter((item) => ["shelter", "cleaning"].includes(item.type));
  // };

  // const applyRoleFilter = (items: CheckItem[]) => {
  //   if (isFuelRole(user?.role)) {
  //     return items.filter((item) => item.type === "fuel_tank");
  //   }
  //   if (!isRestrictedAcScopeRole(user?.role)) return items;
  //   return items.filter((item) => ["shelter", "cleaning"].includes(item.type));
  // };

  const applyRoleFilter = (items: any[]) => {
    if (isFuelRole(user?.role)) {
      // Fuel users only see fuel_tank in preventive
      return items.filter((item) => item.type === "fuel_tank");
    }
    if (isRestrictedAcScopeRole(user?.role)) {
      return items.filter((item) =>
        ["shelter", "cleaning"].includes(item.type),
      );
    }
    // Regular technicians/supervisors don't see the fuel-only entry in preventive
    return items.filter((item) => !item.fuelOnly);
  };

  useEffect(() => {
    // Initialize checks based on type

    // Helper to render translated checklist titles
    function renderCheckTitle(t, check) {
      return t(check.titleKey, check.defaultTitle);
    }
    let initialChecks = [];
    if (type === "preventive") {
      initialChecks = [...PREVENTIVE_CHECKS];
    } else if (type === "refueling") {
      initialChecks = [...REFUELING_CHECKS];
    } else if (type === "corrective") {
      initialChecks = [...CORRECTIVE_CHECKS];
    } else {
      // Default to preventive if unknown
      initialChecks = [...PREVENTIVE_CHECKS];
    }

    const filtered = applyRoleFilter(initialChecks as any[]);

    // We map to add status
    setChecks(filtered.map((c) => ({ ...c, status: "pending" }) as CheckItem));
  }, [type, user?.role]);

  useFocusEffect(
    useCallback(() => {
      if (readOnly === "true") {
        fetchServerProgress();
      } else {
        checkProgress();
      }
    }, [checks.length, siteId, readOnly, maintenanceId]),
  );

  const fetchServerProgress = async () => {
    if (!maintenanceId) return;
    try {
      const res = await api.get(`/technician/maintenance/${maintenanceId}`);
      if (res.data.data) {
        const m = res.data.data;
        const serverChecks = m.equipment_checks || {};

        const updatedChecks = checks.map((c) => {
          // Simple heuristic: check if key exists in server object
          // e.g. generator -> generator_checks
          const key = `${c.type}_checks`;
          // Or sometimes just the type matches keys in some API designs
          // Based on [type].tsx: serverData = maintenance.equipment_checks.generator_checks;
          const hasData =
            serverChecks[key] && Object.keys(serverChecks[key]).length > 0;
          return {
            ...c,
            status: hasData ? "completed" : "pending",
          } as CheckItem;
        });
        setChecks(updatedChecks);
      }
    } catch (e) {
      console.error("Error fetching server progress", e);
    }
  };

  // Improved check: look for both local drafts (AsyncStorage) and server-saved data (if maintenanceId present)
  const checkProgress = async () => {
    if (checks.length === 0) return;

    let serverChecks: any = {};
    if (maintenanceId) {
      try {
        const res = await api.get(`/technician/maintenance/${maintenanceId}`);
        if (res.data && res.data.data && res.data.data.equipment_checks) {
          serverChecks = res.data.data.equipment_checks;
        }
      } catch (err) {
        // ignore server errors but keep local draft checking
        console.error(
          "Unable to fetch server checks for progress:",
          err?.message || err,
        );
      }
    }

    try {
      const updatedChecks = await Promise.all(
        checks.map(async (check) => {
          const key = `draft_${check.type}_${siteId}_${maintenanceId || "adhoc"}`;
          const dataStr = await AsyncStorage.getItem(key);
          const hasLocal = !!dataStr;

          const serverKey = `${check.type}_checks`;
          const serverEntry = serverChecks[serverKey];
          // serverEntry might be an array or object
          let hasServer = false;
          if (serverEntry) {
            if (Array.isArray(serverEntry)) hasServer = serverEntry.length > 0;
            else if (typeof serverEntry === "object")
              hasServer = Object.keys(serverEntry).length > 0;
            else hasServer = true;
          }

          const status = hasServer || hasLocal ? "completed" : "pending";
          return { ...check, status } as CheckItem;
        }),
      );

      const hasChanged = updatedChecks.some(
        (c, i) => c.status !== checks[i].status,
      );
      if (hasChanged) setChecks(updatedChecks);
    } catch (e) {
      console.error("Error checking progress", e);
    }
  };

  const handlePressCheck = (checkType: string) => {
    router.push({
      pathname: "/(technician)/maintenance/equipment/[type]",
      params: { type: checkType, siteId, siteName, maintenanceId, readOnly },
    });
  };

  const cleanUpDrafts = async () => {
    try {
      const keys = checks.map(
        (c) => `draft_${c.type}_${siteId}_${maintenanceId || "adhoc"}`,
      );
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.error("Failed to cleanup drafts", e);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    // Collect all data
    setSubmitting(true);
    try {
      const submissionData: any = {
        site_id: siteId, // Server expects snake_case
        visit_type: type, // Server expects snake_case
        siteId,
        maintenanceId,
        type,
        visit_date: new Date().toISOString(),
        visitDate: new Date().toISOString(),
        status: isDraft ? "Draft" : "Submitted",
        checks: {},
      };

      // Merge existing server data if available (fixes "5/5 completed but empty submission" error)
      if (maintenanceId && !isDraft) {
        try {
          const res = await api.get(`/technician/maintenance/${maintenanceId}`);
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
          console.log("Error fetching server state for submission merge:", e);
        }
      }

      let hasData = Object.keys(submissionData.checks).length > 0;
      for (const check of checks) {
        const key = `draft_${check.type}_${siteId}_${maintenanceId || "adhoc"}`;
        const dataStr = await AsyncStorage.getItem(key);
        if (dataStr) {
          submissionData.checks[check.type] = JSON.parse(dataStr);
          hasData = true;
        }
      }

      if (!hasData && !isDraft) {
        Alert.alert(
          "Empty Submission",
          "Please complete at least one check before submitting.",
        );
        setSubmitting(false);
        return;
      }

      // Process deletions of drafts if submitted
      if (!isDraft) {
        // Upload images first
        console.log("🔄 Processing uploads for submission...");
        const processedData =
          await uploadAPI.processAndUploadData(submissionData);

        console.log("🚀 Submitting Final Visit:", processedData);
        await api.post("/technician/maintenance/submit", processedData);

        await cleanUpDrafts();

        Alert.alert(
          "Submitted Successfully",
          "The maintenance report has been submitted to your supervisor.",
          [{ text: "OK", onPress: () => router.navigate("/(technician)") }],
        );
      } else {
        // Draft logic
        await api.post("/technician/visits", submissionData);
        Alert.alert("Draft Saved", "Your progress has been saved.");
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      Alert.alert("Error", "Failed to submit data. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const completedCount = checks.filter((c) => c.status === "completed").length;
  const progress = checks.length > 0 ? completedCount / checks.length : 0;

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay
        visible={submitting || loading}
        message={
          submitting
            ? t("submitting", "Submitting...")
            : t("loading", "Loading...")
        }
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.siteName}>{siteName}</Text>
          <Text style={styles.subTitle}>
            {t(
              type ? `${type}_maintenance` : "preventive_maintenance",
              `${type?.toUpperCase() || "PREVENTIVE"} MAINTENANCE`,
            )}{" "}
            {t("checklist", "CHECKLIST")}
          </Text>
        </View>
        <View style={{ width: 40 }} />
        <TouchableOpacity
          onPress={async () => {
            try {
              await checkOutSite();
              Alert.alert(
                t("checked_out", "Checked Out"),
                t("site_exit_time_recorded", "Site exit time recorded."),
              );
            } catch (error) {
              Alert.alert(
                t("error", "Error"),
                t(
                  "failed_to_check_out_of_site",
                  "Failed to check out of site.",
                ),
              );
            }
          }}
          style={{ padding: 4 }}
        >
          <FontAwesome5
            name="sign-out-alt"
            size={18}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {completedCount} {t("of", "of")} {checks.length}{" "}
            {t("completed", "Completed")}
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {t("required_checks", "Required Checks")}
        </Text>

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
                name={check.icon}
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
                {t(check.titleKey, check.defaultTitle)}
              </Text>
              <Text
                style={[
                  styles.checkStatus,
                  check.status === "completed" && {
                    color: "rgba(255,255,255,0.8)",
                  },
                ]}
              >
                {check.status === "completed"
                  ? t("completed", "Completed")
                  : t("pending", "Pending")}
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

        {readOnly === "true" ? (
          <View style={styles.footer}>
            <View
              style={[
                styles.checkItemCompleted,
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {t(
                  "maintenance_task_submitted",
                  "This maintenance task has been submitted.",
                )}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.footer}>
            <Button
              variant="outline"
              onPress={() => handleSubmit(true)}
              style={{ marginBottom: 12 }}
            >
              {t("save_draft", "Save as Draft")}
            </Button>
            <Button variant="primary" onPress={() => handleSubmit(false)}>
              {t("submit_report", "Submit Report")}
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  progressContainer: {
    marginBottom: 24,
  },
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
  checkInfo: {
    flex: 1,
  },
  checkTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  checkStatus: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  footer: {
    marginTop: 32,
  },
});
