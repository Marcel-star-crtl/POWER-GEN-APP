// app/(technician)/refueling-flow/checkout-site.tsx
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { refuelWorkflowAPI } from "../../../services/refuelWorkflowAPI";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

export default function CheckoutSiteScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{
    siteId: string;
    siteCode: string;
    siteName: string;
    workflowId: string;
  }>();

  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!params.workflowId) {
      Alert.alert("Error", "Workflow ID missing.");
      return;
    }

    try {
      setLoading(true);

      await refuelWorkflowAPI.updateStatus(params.workflowId, "checked_out", {
        checkedOutAt: new Date().toISOString(),
      });

      console.log("[Checkout] Patched checked_out, workflowId:", params.workflowId);

      Alert.alert("Checked Out", "You have successfully checked out of the site.", [
        { text: "OK", onPress: () => router.replace("/(technician)/dashboard") },
      ]);
    } catch (err: any) {
      console.error("[Checkout] error:", err?.message);
      Alert.alert("Error", "Failed to save checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check Out</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <FontAwesome5 name="sign-out-alt" size={48} color={Colors.primary} />
        </View>

        <Text style={styles.siteName}>{params.siteName}</Text>
        <Text style={styles.siteCode}>{params.siteCode}</Text>

        <View style={styles.infoCard}>
          <FontAwesome5 name="info-circle" size={16} color="#92400E" />
          <Text style={styles.infoText}>
            Checking out will mark your visit as complete. Make sure you have submitted the refueling form before checking out.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleCheckout}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Confirm Check Out</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F3F4F6" },
  header: {
    backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  back:        { padding: 4 },
  body:        { padding: 20, gap: 16, alignItems: "center" },
  iconWrap:    { marginTop: 20, marginBottom: 8 },
  siteName:    { fontSize: 22, fontWeight: "700", color: "#111827" },
  siteCode:    { fontSize: 14, color: "#6B7280" },
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#FDE68A", width: "100%",
  },
  infoText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 20 },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: "center", width: "100%", marginTop: 8,
  },
  btnText:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:  { paddingVertical: 12 },
  cancelText: { color: "#6B7280", fontSize: 15 },
});



