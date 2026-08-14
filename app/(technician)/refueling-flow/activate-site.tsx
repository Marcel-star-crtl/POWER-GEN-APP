// app/(technician)/refueling-flow/activate-site.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { activateWorkflow } from "../../../services/offlineWorkflow";
import { useAuth } from "../../../context/AuthContext";

export default function ActivateSiteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    siteId: string;
    siteCode: string;
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId: string;
  }>();

  const [statusText, setStatusText] = useState(t("activating_site", "Activating site..."));

  useEffect(() => {
    if (!params.siteId || !user?.id) {
      Alert.alert(t("error", "Error"), t("missing_site_or_user_info", "Missing site or user info."));
      router.back();
      return;
    }

    const init = async () => {
      // activateWorkflow ALWAYS succeeds -- online it tries to find/create
      // the real server workflow, offline (or if that attempt fails for any
      // reason) it falls back to the local cache and queues the server
      // side for later. Either way we get a usable workflow back and can
      // proceed immediately -- no error path that backs the user out just
      // because there's no connection.
      setStatusText(t("preparing_workflow", "Preparing workflow..."));

      const { workflowId, workflowClientId, workflow } = await activateWorkflow(
        params.siteId,
        user.id,
        params.maintenanceId || undefined,
      );

      const sharedParams = {
        siteId:        params.siteId,
        siteCode:      params.siteCode      ?? "",
        siteName:      params.siteName      ?? "",
        tankId:        params.tankId        ?? "",
        capacity:      params.capacity      ?? "5000",
        currentLevel:  params.currentLevel  ?? "0",
        maintenanceId: params.maintenanceId ?? "",
        workflowId,
        workflowClientId,
      };

      setStatusText(t("resuming_last_step", "Resuming from last step..."));

      const currentStatus = workflow.workflow_status;

      if (
        currentStatus === "form_opened"    ||
        currentStatus === "form_submitted" ||
        currentStatus === "checked_in"
      ) {
        router.replace({
          pathname: "/(technician)/refueling/form",
          params:   sharedParams,
        });
      } else if (currentStatus === "purchase_selected") {
        router.replace({
          pathname: "/(technician)/refueling-flow/check-in-site",
          params:   sharedParams,
        });
      } else {
        // "initiated" | "activated" | unknown -> must pick (or create) a
        // fuel purchase to draw from before continuing.
        router.replace({
          pathname: "/(technician)/refueling-flow/select-fuel-purchase",
          params:   sharedParams,
        });
      }
    };

    init();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors_primary} />
      <Text style={styles.status}>{statusText}</Text>
      <Text style={styles.siteName}>{params.siteName}</Text>
    </View>
  );
}

const Colors_primary = "#DC2626";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: "#fff",
    gap: 16,
  },
  status:   { fontSize: 16, color: "#6B7280" },
  siteName: { fontSize: 18, fontWeight: "700", color: "#111827" },
});




