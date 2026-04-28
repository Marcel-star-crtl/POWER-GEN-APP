import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { refuelWorkflowAPI } from "../../../services/refuelWorkflowAPI";
import { api } from "../../../services/api";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

export default function RefuelSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workflowId: string;
    siteId: string;
    siteName: string;
    maintenanceId: string;
    formPayload: string;
  }>();

  const [workflow, setWorkflow]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!params.workflowId) { setLoading(false); return; }
    refuelWorkflowAPI.get(params.workflowId)
      .then(res => setWorkflow(res.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.workflowId]);

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

      // Include workflowId so backend updates the existing record
      const response = await api.post("/technician/refuel", {
        ...payload,
        workflowId: params.workflowId,
      });

      if (response.data.success) {
        // Patch form_submitted + checked_out on workflow record
        if (params.workflowId) {
          await refuelWorkflowAPI.updateStatus(params.workflowId, "form_submitted", {
            submittedAt: new Date().toISOString(),
          });
          const alreadyCheckedOut = workflow?.workflow_history?.some(
            (h: any) => h.status === "checked_out"
          );
          if (!alreadyCheckedOut) {
            await refuelWorkflowAPI.updateStatus(params.workflowId, "checked_out", {
              checkedOutAt: new Date().toISOString(),
            });
          }
        }
        Alert.alert("Success", "Refueling submitted successfully!", [
          { text: "OK", onPress: () => router.replace("/(technician)/refueling") },
        ]);
      }
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

        {/* Fuel Station */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fuel Station</Text>
          <Text style={styles.row}>Date/Time: {fmt(getStep("fuel_station")?.timestamp)}</Text>
          <Text style={styles.row}>Photo: {getStep("fuel_station")?.meta?.photo ? "✓ Yes" : "No"}</Text>
          <Text style={styles.row}>Quantity: {getStep("fuel_station")?.meta?.fuelQty ?? "-"} L</Text>
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


