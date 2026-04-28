// app/(technician)/refueling-flow/activate-fuel-station.tsx
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PhotoCapture, PhotoAttachment } from "../../../components/ui/PhotoCapture";
import { refuelWorkflowAPI } from "../../../services/refuelWorkflowAPI";
import { uploadAPI } from "../../../services/api";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ActivateFuelStationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    siteId: string;
    siteCode: string;
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId: string;
    workflowId: string;
  }>();

  const [photo, setPhoto]         = useState<PhotoAttachment | null>(null);
  const [fuelQty, setFuelQty]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [resuming, setResuming]   = useState(true); // loading prior data on mount

  // ── On mount: restore previously saved fuel_station data if resuming ──────
  useEffect(() => {
    if (!params.workflowId) {
      setResuming(false);
      return;
    }

    refuelWorkflowAPI.get(params.workflowId)
      .then((res) => {
        const record = res.data?.data;
        const fuelStationStep = record?.workflow_history?.find(
          (h: any) => h.status === "fuel_station"
        );
        if (fuelStationStep?.meta?.fuelQty) {
          setFuelQty(String(fuelStationStep.meta.fuelQty));
        }
        if (fuelStationStep?.meta?.photo) {
          setPhoto({ uri: fuelStationStep.meta.photo });
        }
      })
      .catch(() => {
        // Non-fatal — user can re-enter values
      })
      .finally(() => setResuming(false));
  }, [params.workflowId]);

  const handleNext = async () => {
    // ✅ Guard uses params.workflowId directly — never undefined anymore
    if (!params.workflowId) {
      Alert.alert("Error", "Workflow ID missing. Please go back and re-enter the site.");
      router.back();
      return;
    }
    if (!photo) {
      Alert.alert("Required", "Please take a photo at the fuel station.");
      return;
    }
    if (!fuelQty || isNaN(Number(fuelQty))) {
      Alert.alert("Required", "Please enter a valid fuel quantity.");
      return;
    }

    try {
      setLoading(true);

      // Upload photo
      const uploaded = await uploadAPI.processAndUploadData([photo.uri]);
      const photoUrl = uploaded?.[0] ?? photo.uri;

      // PATCH fuel_station step — first-write-wins on backend, safe to retry
      await refuelWorkflowAPI.updateStatus(params.workflowId, "fuel_station", {
        photo:         photoUrl,
        fuelQty:       Number(fuelQty),
        fuelStationAt: new Date().toISOString(),
      });

      console.log("[FuelStation] Patched fuel_station step, workflowId:", params.workflowId);

      router.replace({
        pathname: "/(technician)/refueling-flow/check-in-site",
        params: { ...params }, // workflowId flows through automatically
      });
    } catch (err: any) {
      console.error("[FuelStation] error:", err?.message);
      Alert.alert("Error", "Failed to save fuel station data.");
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
        <Text style={styles.headerTitle}>At Fuel Station</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.siteName}>{params.siteName}</Text>
        <Text style={styles.siteCode}>{params.siteCode}</Text>

        {resuming ? (
          // Show spinner while restoring prior session data
          <View style={styles.resumeRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.resumeText}>Restoring session...</Text>
          </View>
        ) : (
          <>
            <PhotoCapture
              label="Photo at Fuel Station *"
              photos={photo ? [photo] : []}
              onAddPhoto={(p) => setPhoto(p)}
              onRemovePhoto={() => setPhoto(null)}
              required
            />

            <Text style={styles.label}>Fuel Quantity Leaving Station (L) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 120"
              keyboardType="numeric"
              value={fuelQty}
              onChangeText={setFuelQty}
            />

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleNext}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Next: Check-In at Site →</Text>}
            </TouchableOpacity>
          </>
        )}
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
  body:        { padding: 20, gap: 16 },
  siteName:    { fontSize: 20, fontWeight: "700", color: "#111827" },
  siteCode:    { fontSize: 14, color: "#6B7280", marginTop: -8 },
  label:       { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 10, padding: 12, fontSize: 16, color: "#111827",
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  btnText:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  resumeRow:  { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 24 },
  resumeText: { fontSize: 14, color: "#6B7280" },
});




