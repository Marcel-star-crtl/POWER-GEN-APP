// app/(technician)/maintenance-flow/activate-site.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../../constants/Colors";
import { useAuth } from "../../../context/AuthContext";
import { activateMaintenanceWorkflow } from "../../../services/offlineMaintenanceWorkflow";

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
      // activateMaintenanceWorkflow ALWAYS succeeds -- online it tries to
      // sync the real server-side workflow state, offline (or if that
      // attempt fails for any reason) it falls back to the local cache and
      // queues the server side for later. Either way we can proceed to the
      // checklist immediately -- no error path that backs the technician
      // out just because there's no connection.
      setStatusText("Preparing workflow...");

      const { workflowId } = await activateMaintenanceWorkflow(params.maintenanceId, user.id);

      setStatusText("Loading checklist...");

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






