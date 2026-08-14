import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getWorkflow, patchWorkflowStatus } from "../../../services/offlineWorkflow";
import { stopSharing } from "../../../services/technicianTracking";
import { clearLocalWorkflow } from "../../../lib/workflowCache";
import { drawDownLocalPurchase } from "../../../lib/localPurchases";
import { submitOrQueue, generateClientId } from "../../../services/offlineApi";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

export default function RefuelSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workflowId: string;
    workflowClientId: string;
    siteId: string;
    siteName: string;
    maintenanceId: string;
    formPayload: string;
  }>();

  const [workflow, setWorkflow]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!params.siteId) { setLoading(false); return; }
    // Read from the local workflow cache -- always populated regardless of
    // connectivity, since every step in this flow writes through it first.
    getWorkflow(params.siteId)
      .then((w) => setWorkflow(w))
      .finally(() => setLoading(false));
  }, [params.siteId]);

  const getStep = (status: string) =>
    workflow?.workflow_history?.find((h: any) => h.status === status);

  const fmt = (ts?: string) =>
    ts ? new Date(ts).toLocaleString() : "-";

  const handleSubmit = async () => {
    if (!params.formPayload) {
      Alert.alert("Error", "Form data missing. Please go back and re-fill the form.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = JSON.parse(params.formPayload);

      // Stable id so a retried offline sync can't create a duplicate record.
      const clientId = generateClientId();

      const result = await submitOrQueue(
        "refuel_submit",
        "/technician/refuel",
        "POST",
        { ...payload, workflowId: params.workflowId, client_id: clientId },
      );

      // Reflect the draw-down locally too, immediately -- so if the
      // technician picks the SAME purchase again for another site before
      // this submission has synced, the remaining balance shown is
      // accurate rather than stale.
      if (payload.fuel_purchase_client_id && payload.fuel_added) {
        await drawDownLocalPurchase(payload.fuel_purchase_client_id, Number(payload.fuel_added)).catch(() => {});
      }

      if (params.siteId && params.workflowId && params.workflowClientId) {
        // Small status pings -- patchWorkflowStatus always succeeds locally
        // and queues the server side.
        await patchWorkflowStatus(
          params.siteId, params.workflowId, params.workflowClientId,
          "form_submitted", { submittedAt: new Date().toISOString() },
        );

        // Only fully check out (and clear the local workflow cache) when
        // the technician said this delivery is actually complete. If
        // they said "no, I'll return to add the rest" (delivery_complete
        // === false), the visit isn't over — checking them out and
        // wiping the cache here was the actual bug: it made the site
        // impossible to correctly resume later, on top of its fuel
        // request still genuinely needing more fuel. Leave the workflow
        // at form_submitted and the cache intact so a return visit to
        // this exact site picks up where it left off instead of looking
        // like nothing is pending here at all.
        if (payload.delivery_complete !== false) {
          const alreadyCheckedOut = workflow?.workflow_history?.some(
            (h: any) => h.status === "checked_out"
          );
          if (!alreadyCheckedOut) {
            await patchWorkflowStatus(
              params.siteId, params.workflowId, params.workflowClientId,
              "checked_out", { checkedOutAt: new Date().toISOString() },
            );
          }
          // Stops location sharing (see services/technicianTracking.ts) —
          // this checkout path bypasses the dedicated checkout-site.tsx
          // screen entirely, so without this call sharing would never
          // actually stop for a technician who completes their visit by
          // submitting the form here rather than through that screen.
          stopSharing();
          // This site's visit is fully wrapped up -- clear the local workflow
          // cache so the NEXT visit to this site starts clean rather than
          // resuming a completed one.
          await clearLocalWorkflow(params.siteId).catch(() => {});
        }
      }

      Alert.alert(
        "Success",
        result.queued
          ? "No connection — refueling saved and will sync automatically."
          : "Refueling submitted successfully!",
        [{ text: "OK", onPress: () => router.replace("/(technician)/refueling") }],
      );
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || err?.message || "Submission failed.");
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Summary Before Submission</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.siteName}>{params.siteName}</Text>
        <Text style={styles.siteId}>Site ID: {params.siteId}</Text>

        {/* Activation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activation</Text>
          <Text style={styles.row}>
            Date/Time: {fmt(getStep("activated")?.timestamp)}
          </Text>
        </View>

        {/* Fuel Purchase */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fuel Purchase</Text>
          <Text style={styles.row}>Date/Time: {fmt(getStep("purchase_selected")?.timestamp)}</Text>
          <Text style={styles.row}>
            Purchase: {getStep("purchase_selected")?.meta?.fuelPurchaseId
              || getStep("purchase_selected")?.meta?.fuelPurchaseClientId
              || "-"}
          </Text>
        </View>

        {/* Check-In */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Check-In</Text>
          <Text style={styles.row}>Date/Time: {fmt(getStep("checked_in")?.timestamp)}</Text>
          <Text style={styles.row}>Photo: {getStep("checked_in")?.meta?.photo ? "✓ Yes" : "No"}</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Form</Text>
          <Text style={styles.row}>Date/Time: {fmt(getStep("form_opened")?.timestamp)}</Text>
          {params.formPayload && (() => {
            try {
              const d = JSON.parse(params.formPayload);
              return (
                <>
                  <Text style={styles.row}>Visit Date: {d.visit_date} {d.visit_time}</Text>
                  <Text style={styles.row}>Opening Level: {d.opening_level} L</Text>
                  <Text style={styles.row}>Closing Level: {d.closing_level} L</Text>
                  <Text style={styles.row}>Fuel Added: {d.fuel_added} L</Text>
                  <Text style={styles.row}>Closing Hours: {d.closing_hours ?? "-"} hrs</Text>
                  <Text style={styles.row}>Photos: {d.photos?.length ?? 0} attached</Text>
                </>
              );
            } catch { return null; }
          })()}
        </View>

        {/* Checkout */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Checkout</Text>
          <Text style={styles.row}>Date/Time: {fmt(getStep("checked_out")?.timestamp)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>SUBMIT & FINISH</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flexGrow: 1, backgroundColor: "#F3F4F6" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  header: {
    backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  back:        { padding: 4 },
  body:        { padding: 16, gap: 12 },
  siteName:    { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center" },
  siteId:      { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: -4 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB", gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  row:        { fontSize: 13, color: "#374151" },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: "center", marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});









