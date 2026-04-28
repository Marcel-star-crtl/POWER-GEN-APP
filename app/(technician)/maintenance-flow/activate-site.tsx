// app/(technician)/maintenance-flow/activate-site.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../../constants/Colors";
import { useAuth } from "../../../context/AuthContext";
import { maintenanceWorkflowAPI } from "../../../services/maintenanceWorkflowAPI";

export default function MaintenanceActivateSiteScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const params = useLocalSearchParams<{
    maintenanceId: string;
    siteId: string;
    siteName: string;
    visitDate: string;
  }>();

  const [statusText, setStatusText] = useState("Activating site...");

  useEffect(() => {
    if (!params.maintenanceId || !user?.id) {
      Alert.alert("Error", "Missing maintenance task or user info.");
      router.back();
      return;
    }

    const init = async () => {
      try {
        setStatusText("Checking for existing workflow...");
        console.log(
          "[MaintenanceActivateSite] params:",
          JSON.stringify(params),
        );

        let workflowId = "";
        let currentStatus = "initiated";

        // ── Step 1: Look up any active workflow for this task ─────────────────
        const activeRes = await maintenanceWorkflowAPI.getActiveByMaintenance(
          params.maintenanceId,
        );
        const activeRecord = activeRes.data?.data ?? null;

        if (activeRecord) {
          // Resume existing workflow
          workflowId = String(activeRecord._id ?? "");
          currentStatus = activeRecord.workflow_status ?? "initiated";
          console.log(
            "[MaintenanceActivateSite] Found active workflow:",
            workflowId,
            "status:",
            currentStatus,
          );
          setStatusText("Resuming workflow...");
        } else {
          // Fresh start
          setStatusText("Starting new workflow...");
          console.log(
            "[MaintenanceActivateSite] No active workflow — calling start()",
            { maintenanceId: params.maintenanceId, userId: user.id },
          );

          const startRes = await maintenanceWorkflowAPI.start(
            params.maintenanceId,
            user.id,
          );
          workflowId = String(
            startRes.data.data?._id ??
              startRes.data.data?.id ??
              startRes.data._id ??
              startRes.data.id ??
              "",
          );
          currentStatus =
            startRes.data.data?.workflow_status ??
            startRes.data.workflow_status ??
            "initiated";

          console.log(
            "[MaintenanceActivateSite] Created new workflow:",
            workflowId,
          );
        }

        // ── Guard: must have valid ID ─────────────────────────────────────────
        if (
          !workflowId ||
          workflowId === "undefined" ||
          workflowId === "null"
        ) {
          console.error(
            "[MaintenanceActivateSite] Invalid workflowId:",
            workflowId,
          );
          Alert.alert(
            "Error",
            "Could not retrieve workflow ID. Please try again.",
          );
          router.back();
          return;
        }

        // ── Patch activated step (idempotent) ─────────────────────────────────
        await maintenanceWorkflowAPI.updateStatus(workflowId, "activated", {
          activatedAt: new Date().toISOString(),
          technicianId: user.id,
        });

        setStatusText("Loading checklist...");

        // ── Always go straight to the checklist ───────────────────────────────
        router.replace({
          pathname: "/(technician)/maintenance/[id]",
          params: {
            id: params.maintenanceId,
            workflowId,
            siteId: params.siteId ?? "",
            siteName: params.siteName ?? "",
            visitDate: params.visitDate ?? "",
          },
        });
      } catch (err: any) {
        console.error(
          "[MaintenanceActivateSite] error:",
          err?.message,
          err?.response?.data,
        );
        Alert.alert("Error", "Failed to start workflow. Please try again.");
        router.back();
      }
    };

    init();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.status}>{statusText}</Text>
      <Text style={styles.siteName}>{params.siteName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    gap: 16,
  },
  status: { fontSize: 16, color: "#6B7280" },
  siteName: { fontSize: 18, fontWeight: "700", color: "#111827" },
});
