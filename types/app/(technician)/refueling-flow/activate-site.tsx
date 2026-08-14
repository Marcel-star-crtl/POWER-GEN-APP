// app/(technician)/refueling-flow/activate-site.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { activateWorkflow } from "../../../services/offlineWorkflow";
import { useAuth } from "../../../context/AuthContext";

export default function ActivateSiteScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const params = useLocalSearchParams<{
    siteId: string;
    siteCode: string;
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId: string;
  }>();

  const [statusText, setStatusText] = useState("Activating site...");

  useEffect(() => {
    if (!params.siteId || !user?.id) {
      Alert.alert("Error", "Missing site or user info.");
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
      setStatusText("Preparing workflow...");

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

      setStatusText("Resuming from last step...");

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








// // app/(technician)/refueling-flow/activate-site.tsx
// import React, { useEffect, useState } from "react";
// import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import { refuelWorkflowAPI } from "../../../services/refuelWorkflowAPI";
// import { useAuth } from "../../../context/AuthContext";

// export default function ActivateSiteScreen() {
//   const router = useRouter();
//   const { user } = useAuth();

//   const params = useLocalSearchParams<{
//     siteId: string;
//     siteCode: string;
//     siteName: string;
//     tankId: string;
//     capacity: string;
//     currentLevel: string;
//     maintenanceId: string;
//   }>();

//   const [statusText, setStatusText] = useState("Activating site...");

//   useEffect(() => {
//     if (!params.siteId || !user?.id) {
//       Alert.alert("Error", "Missing site or user info.");
//       router.back();
//       return;
//     }

//     const init = async () => {
//       try {
//         setStatusText("Checking for existing workflow...");

//         console.log("[ActivateSite] params on mount:", JSON.stringify(params));

//         // ── Step 1: Look up any active (non-completed) workflow for this site ──
//         // getActiveBySite has no date filter so it finds records from any day.
//         // This is the authoritative source of truth for resume scenarios.
//         let workflowId    = "";
//         let currentStatus = "initiated";

//         const activeRes = await refuelWorkflowAPI.getActiveBySite(params.siteId);
//         const activeRecord = activeRes.data?.data ?? null;

//         if (activeRecord) {
//           // ── Resume: existing in-progress workflow found ───────────────────
//           workflowId    = String(activeRecord._id ?? "");
//           currentStatus = activeRecord.workflow_status ?? "initiated";
//           console.log("[ActivateSite] Found active workflow via getActiveBySite:", workflowId, "status:", currentStatus);
//           setStatusText("Resuming workflow...");
//         } else {
//           // ── Fresh start: no existing record — call start() to create one ──
//           console.log("[ActivateSite] No active workflow found — calling start()", {
//             siteId: params.siteId,
//             userId: user.id,
//             taskId: params.maintenanceId,
//           });
//           setStatusText("Starting new workflow...");

//           const startRes = await refuelWorkflowAPI.start(
//             params.siteId,
//             user.id,
//             params.maintenanceId || undefined
//           );

//           workflowId =
//             String(
//               startRes.data.data?._id ??
//               startRes.data.data?.id  ??
//               startRes.data._id       ??
//               startRes.data.id        ??
//               ""
//             );
//           currentStatus =
//             startRes.data.data?.workflow_status ??
//             startRes.data.workflow_status        ??
//             "initiated";

//           console.log("[ActivateSite] Created new workflow:", workflowId, "status:", currentStatus);
//         }

//         // ── Guard: must have a valid ID before proceeding ─────────────────────
//         if (!workflowId || workflowId === "undefined" || workflowId === "null") {
//           console.error("[ActivateSite] workflowId is invalid after resolution:", workflowId);
//           Alert.alert("Error", "Could not retrieve workflow ID. Please try again.");
//           router.back();
//           return;
//         }

//         // ── Shared params forwarded to every subsequent screen ────────────────
//         const sharedParams = {
//           siteId:        params.siteId,
//           siteCode:      params.siteCode      ?? "",
//           siteName:      params.siteName      ?? "",
//           tankId:        params.tankId        ?? "",
//           capacity:      params.capacity      ?? "5000",
//           currentLevel:  params.currentLevel  ?? "0",
//           maintenanceId: params.maintenanceId ?? "",
//           workflowId,   // ✅ always resolved correctly — from DB or fresh start
//         };

//         // Patch "activated" step — idempotent, safe to call on every entry
//         await refuelWorkflowAPI.updateStatus(workflowId, "activated", {
//           activatedAt:  new Date().toISOString(),
//           technicianId: user.id,
//         });

//         // ── Route to the correct screen based on last known status ────────────
//         setStatusText("Resuming from last step...");

//         console.log("[ActivateSite] Routing for status:", currentStatus, "workflowId:", workflowId);

//         if (
//           currentStatus === "form_opened"    ||
//           currentStatus === "form_submitted" ||
//           currentStatus === "checked_in"
//         ) {
//           router.replace({
//             pathname: "/(technician)/refueling/form",
//             params:   sharedParams,
//           });
//         } else if (currentStatus === "fuel_station") {
//           router.replace({
//             pathname: "/(technician)/refueling-flow/check-in-site",
//             params:   sharedParams,
//           });
//         } else {
//           // "initiated" | "activated" | unknown → first step after activation
//           router.replace({
//             pathname: "/(technician)/refueling-flow/activate-fuel-station",
//             params:   sharedParams,
//           });
//         }

//       } catch (err: any) {
//         console.error("[ActivateSite] error:", err?.message, err?.response?.data);
//         Alert.alert("Error", "Failed to start workflow. Please try again.");
//         router.back();
//       }
//     };

//     init();
//   }, []);

//   return (
//     <View style={styles.container}>
//       <ActivityIndicator size="large" color={Colors_primary} />
//       <Text style={styles.status}>{statusText}</Text>
//       <Text style={styles.siteName}>{params.siteName}</Text>
//     </View>
//   );
// }

// const Colors_primary = "#DC2626";

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent:  "center",
//     alignItems:      "center",
//     backgroundColor: "#fff",
//     gap: 16,
//   },
//   status:   { fontSize: 16, color: "#6B7280" },
//   siteName: { fontSize: 18, fontWeight: "700", color: "#111827" },
// });





