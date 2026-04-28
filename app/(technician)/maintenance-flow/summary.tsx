// app/(technician)/maintenance-flow/summary.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { maintenanceWorkflowAPI } from "../../../services/maintenanceWorkflowAPI";
import { api } from "../../../services/api";
import { Colors } from "../../../constants/Colors";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const EQUIPMENT_CONFIGS = [
  {
    key: "generator",
    label: "Generator",
    icon: "flash" as const,
    dataKey: "generator_checks",
  },
  {
    key: "power_cabinet",
    label: "Power Cabinet",
    icon: "plug" as const,
    dataKey: "power_cabinet_checks",
  },
  {
    key: "grid",
    label: "Grid",
    icon: "battery-charging" as const,
    dataKey: "grid_checks",
  },
  {
    key: "shelter",
    label: "Shelter",
    icon: "home" as const,
    dataKey: "shelter_checks",
  },
  {
    key: "fuel_tank",
    label: "Fuel Tank",
    icon: "water" as const,
    dataKey: "fuel_tank_checks",
  },
  {
    key: "cleaning",
    label: "Site Cleaning",
    icon: "brush" as const,
    dataKey: "cleaning_checks",
  },
] as const;

const WORKFLOW_STEPS = [
  "activated",
  "checked_in",
  "form_opened",
  "form_submitted",
  "checked_out",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function isCheckCompleted(type: string, checks: any): boolean {
  if (!checks) return false;
  switch (type) {
    case "generator": {
      const g = Array.isArray(checks) ? checks[0] : checks;
      return !!(
        g &&
        (g.battery_status !== undefined || g.batteryStatus !== undefined)
      );
    }
    case "power_cabinet":
      return Array.isArray(checks) && checks.length > 0;
    case "grid":
      return !!(
        checks &&
        (checks.status !== undefined || checks.gridStatus !== undefined)
      );
    case "shelter":
      return !!(
        checks &&
        (checks.status !== undefined || checks.shelterStatus !== undefined)
      );
    case "fuel_tank":
      return !!(
        checks &&
        (checks.status !== undefined || checks.tankStatus !== undefined)
      );
    case "cleaning":
      return !!(
        checks &&
        (checks.is_clean !== undefined || checks.isClean !== undefined)
      );
    default:
      return false;
  }
}

function getPhotoCount(type: string, checks: any): number {
  if (!checks) return 0;
  switch (type) {
    case "generator": {
      const g = Array.isArray(checks) ? checks[0] : checks;
      const elec = g?.electrical_readings || {};
      return (elec.photos || g?.photos || []).length;
    }
    case "grid":
      return (checks.meter_photos || checks.photos || []).length;
    case "cleaning":
      return (checks.photos || []).length;
    case "power_cabinet": {
      const pc = Array.isArray(checks) ? checks[0] : checks;
      return ((pc?.rectifiers || []) as any[]).reduce(
        (sum: number, r: any) => sum + (r?.photos?.length || 0),
        0
      );
    }
    default:
      return 0;
  }
}

// Returns key facts about each check type as readable strings
function getCheckSummaryLines(type: string, checks: any): string[] {
  if (!checks) return [];
  const fmt = (val: any) =>
    val === null || val === undefined ? "—" : String(val);
  const lines: string[] = [];

  switch (type) {
    case "generator": {
      const g = Array.isArray(checks) ? checks[0] : checks;
      if (!g) return [];
      const elec = g.electrical_readings || {};
      if (g.battery_status !== undefined || g.batteryStatus !== undefined)
        lines.push(`Battery: ${fmt(g.battery_status ?? g.batteryStatus)}`);
      if (g.running_hours !== undefined || g.runningHours !== undefined)
        lines.push(
          `Running Hours: ${fmt(g.running_hours ?? g.runningHours)} hrs`
        );
      const i1 = elec.i1 ?? g.i1;
      const i2 = elec.i2 ?? g.i2;
      const i3 = elec.i3 ?? g.i3;
      if (i1 !== undefined) lines.push(`Current: ${i1}A / ${i2}A / ${i3}A`);
      const v1 = elec.v1 ?? g.v1;
      const v2 = elec.v2 ?? g.v2;
      const v3 = elec.v3 ?? g.v3;
      if (v1 !== undefined) lines.push(`Voltage: ${v1}V / ${v2}V / ${v3}V`);
      break;
    }
    case "power_cabinet": {
      const pc = Array.isArray(checks) ? checks[0] : checks;
      if (!pc) return [];
      lines.push(`Rectifiers: ${(pc.rectifiers || []).length}`);
      lines.push(`Batteries: ${(pc.batteries || []).length}`);
      if (pc.cooling?.status !== undefined)
        lines.push(`Cooling: ${fmt(pc.cooling.status)}`);
      if (pc.controller?.status !== undefined)
        lines.push(`Controller: ${fmt(pc.controller.status)}`);
      break;
    }
    case "grid":
      if (checks.status !== undefined || checks.gridStatus !== undefined)
        lines.push(
          `Grid Status: ${fmt(checks.status ?? checks.gridStatus)}`
        );
      if (
        checks.breaker_status !== undefined ||
        checks.breakerStatus !== undefined
      )
        lines.push(
          `Breaker: ${fmt(checks.breaker_status ?? checks.breakerStatus)}`
        );
      if (checks.grid_index !== undefined || checks.gridIndex !== undefined)
        lines.push(
          `Grid Index: ${fmt(checks.grid_index ?? checks.gridIndex)}`
        );
      break;
    case "shelter":
      if (checks.status !== undefined || checks.shelterStatus !== undefined)
        lines.push(
          `Shelter: ${fmt(checks.status ?? checks.shelterStatus)}`
        );
      if (checks.door_status !== undefined || checks.doorStatus !== undefined)
        lines.push(
          `Door: ${fmt(checks.door_status ?? checks.doorStatus)}`
        );
      if (checks.temperature !== undefined)
        lines.push(`Temperature: ${checks.temperature}°C`);
      if (
        checks.controller_status !== undefined ||
        checks.controllerStatus !== undefined
      )
        lines.push(
          `Controller: ${fmt(
            checks.controller_status ?? checks.controllerStatus
          )}`
        );
      break;
    case "fuel_tank":
      if (checks.status !== undefined || checks.tankStatus !== undefined)
        lines.push(
          `Tank Status: ${fmt(checks.status ?? checks.tankStatus)}`
        );
      if (checks.water_in_tank !== undefined || checks.waterInTank !== undefined)
        lines.push(
          `Water in Tank: ${fmt(checks.water_in_tank ?? checks.waterInTank)}`
        );
      if (checks.fuel_line !== undefined || checks.fuelLine !== undefined)
        lines.push(`Fuel Line: ${fmt(checks.fuel_line ?? checks.fuelLine)}`);
      if (checks.is_waterproof !== undefined || checks.isWaterproof !== undefined)
        lines.push(
          `Waterproof: ${fmt(checks.is_waterproof ?? checks.isWaterproof)}`
        );
      break;
    case "cleaning":
      if (checks.is_clean !== undefined || checks.isClean !== undefined)
        lines.push(
          `Site Clean: ${fmt(checks.is_clean ?? checks.isClean)}`
        );
      if (checks.spillage !== undefined)
        lines.push(`Spillage: ${fmt(checks.spillage)}`);
      if (
        checks.guard_present !== undefined ||
        checks.guardPresent !== undefined
      )
        lines.push(
          `Guard Present: ${fmt(checks.guard_present ?? checks.guardPresent)}`
        );
      if (
        checks.security_light !== undefined ||
        checks.securityLight !== undefined
      )
        lines.push(
          `Security Light: ${fmt(
            checks.security_light ?? checks.securityLight
          )}`
        );
      break;
  }
  return lines;
}

function fmtDate(ts?: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function fmtStepLabel(step: string) {
  return step.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function MaintenanceSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workflowId: string;
    maintenanceId: string;
    siteId: string;
    siteName: string;
    visitDate: string;
  }>();

  const [workflow, setWorkflow] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [wfRes, mRes] = await Promise.all([
          params.workflowId
            ? maintenanceWorkflowAPI.get(params.workflowId)
            : Promise.resolve(null),
          params.maintenanceId
            ? api.get(`/technician/maintenance/${params.maintenanceId}`)
            : Promise.resolve(null),
        ]);
        setWorkflow(wfRes?.data?.data ?? null);
        setMaintenance(mRes?.data?.data ?? null);
      } catch (err) {
        console.error("[MaintenanceSummary] load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.workflowId, params.maintenanceId]);

  const getStep = (status: string) =>
    workflow?.workflow_history?.find((h: any) => h.status === status);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Submit maintenance task for approval
      await api.patch(
        `/technician/maintenance/${params.maintenanceId}/submit`,
        { workflowId: params.workflowId }
      );

      // Patch form_submitted on workflow
      if (params.workflowId) {
        await maintenanceWorkflowAPI.updateStatus(
          params.workflowId,
          "form_submitted",
          { submittedAt: new Date().toISOString() }
        );

        // Auto checkout if not already done
        const alreadyCheckedOut = workflow?.workflow_history?.some(
          (h: any) => h.status === "checked_out"
        );
        if (!alreadyCheckedOut) {
          await maintenanceWorkflowAPI.updateStatus(
            params.workflowId,
            "checked_out",
            { checkedOutAt: new Date().toISOString() }
          );
        }
      }

      Alert.alert("Success", "Maintenance submitted for approval!", [
        {
          text: "OK",
          onPress: () => router.replace("/(technician)/maintenance"),
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || err?.message || "Submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  const checks = maintenance?.equipment_checks ?? {};
  const completedCount = EQUIPMENT_CONFIGS.filter((cfg) =>
    isCheckCompleted(cfg.key, checks[cfg.dataKey])
  ).length;
  const allDone = completedCount === EQUIPMENT_CONFIGS.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Before Submission</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {/* ── Site Info ─────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Site Information</Text>
          <InfoRow label="Site Name" value={params.siteName || "—"} />
          <InfoRow label="Site ID" value={params.siteId || "—"} />
          {params.visitDate ? (
            <InfoRow
              label="Scheduled"
              value={new Date(params.visitDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            />
          ) : null}
          <InfoRow
            label="Checks Completed"
            value={`${completedCount} / ${EQUIPMENT_CONFIGS.length}`}
            highlight={!allDone}
          />
        </View>

        {/* ── Workflow Timeline ─────────────────────────────────────────────── */}
        {workflow && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Workflow Timeline</Text>
            {WORKFLOW_STEPS.map((step) => {
              const entry = getStep(step);
              return (
                <View key={step} style={styles.timelineRow}>
                  <Ionicons
                    name={entry ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={entry ? Colors.success : "#D1D5DB"}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        !entry && { color: "#9CA3AF" },
                      ]}
                    >
                      {fmtStepLabel(step)}
                    </Text>
                    {entry && (
                      <Text style={styles.timelineTime}>
                        {fmtDate(entry.timestamp)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Equipment Checks ──────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Equipment Checks</Text>

        {EQUIPMENT_CONFIGS.map((cfg) => {
          const checkData = checks[cfg.dataKey];
          const completed = isCheckCompleted(cfg.key, checkData);
          const lines = getCheckSummaryLines(cfg.key, checkData);
          const photoCount = getPhotoCount(cfg.key, checkData);

          return (
            <View
              key={cfg.key}
              style={[styles.card, !completed && styles.cardIncomplete]}
            >
              {/* Check header row */}
              <View style={styles.checkHeader}>
                <View
                  style={[
                    styles.checkIconBox,
                    { backgroundColor: completed ? "#DCFCE7" : "#F3F4F6" },
                  ]}
                >
                  <Ionicons
                    name={cfg.icon}
                    size={18}
                    color={completed ? Colors.success : "#9CA3AF"}
                  />
                </View>
                <Text style={styles.checkLabel}>{cfg.label}</Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: completed ? "#DCFCE7" : "#FEF9C3",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: completed ? "#166534" : "#854D0E" },
                    ]}
                  >
                    {completed ? "Completed" : "Pending"}
                  </Text>
                </View>
              </View>

              {/* Detail lines */}
              {completed && lines.length > 0 && (
                <View style={styles.detailBlock}>
                  {lines.map((line, i) => (
                    <Text key={i} style={styles.detailLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}

              {/* Photo count */}
              {completed && photoCount > 0 && (
                <View style={styles.photoRow}>
                  <Ionicons name="camera-outline" size={13} color="#6B7280" />
                  <Text style={styles.photoText}>
                    {photoCount} photo{photoCount !== 1 ? "s" : ""} attached
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Incomplete warning ────────────────────────────────────────────── */}
        {!allDone && (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={18} color="#92400E" />
            <Text style={styles.warningText}>
              {EQUIPMENT_CONFIGS.length - completedCount} check
              {EQUIPMENT_CONFIGS.length - completedCount !== 1 ? "s" : ""}{" "}
              still pending. Consider completing all checks before submitting.
            </Text>
          </View>
        )}

        {/* ── Submit button ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>SUBMIT & FINISH</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helper component
// ─────────────────────────────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}:</Text>
      <Text style={[infoStyles.value, highlight && { color: "#B45309" }]}>
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginBottom: 4 },
  label: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  value: { fontSize: 13, color: "#111827", fontWeight: "600", flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F3F4F6" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  back: { padding: 4 },

  body: { padding: 16, gap: 12 },

  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
    marginBottom: -4,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  cardIncomplete: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },

  // Timeline
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
  },
  timelineLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  timelineTime: { fontSize: 12, color: "#6B7280", marginTop: 1 },

  // Equipment check card internals
  checkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillText: { fontSize: 11, fontWeight: "700" },

  detailBlock: { paddingLeft: 44, gap: 2 },
  detailLine: { fontSize: 12, color: "#374151" },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 44,
    marginTop: 2,
  },
  photoText: { fontSize: 12, color: "#6B7280" },

  // Warning
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 20,
  },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});