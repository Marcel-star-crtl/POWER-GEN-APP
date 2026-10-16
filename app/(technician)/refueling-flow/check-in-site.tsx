// app/(technician)/refueling-flow/check-in-site.tsx
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PhotoCapture, PhotoAttachment } from "../../../components/ui/PhotoCapture";
import { patchWorkflowStatus } from "../../../services/offlineWorkflow";
import { startSharing } from "../../../services/technicianTracking";
import { verifySiteLocation, GeofenceVerification } from "../../../services/locationVerification";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

export default function CheckInSiteScreen() {
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
    workflowClientId: string;
  }>();

  const [photo, setPhoto]     = useState<PhotoAttachment | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<GeofenceVerification | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(true);
  const [acknowledgedMismatch, setAcknowledgedMismatch] = useState(false);

  // Verify the technician is actually at this site as soon as the screen
  // opens — a soft check, not a hard gate: GPS can be flaky (indoors,
  // urban canyon, older devices), so a mismatch warns and requires an
  // explicit acknowledgment rather than silently blocking check-in.
  useEffect(() => {
    if (!params.siteCode) { setCheckingLocation(false); return; }
    let active = true;
    (async () => {
      const result = await verifySiteLocation(params.siteCode);
      if (active) {
        setLocationStatus(result);
        setCheckingLocation(false);
      }
    })();
    return () => { active = false; };
  }, [params.siteCode]);

  const locationMismatch = locationStatus?.verifiable && locationStatus.isInside === false;
  const canProceed = !locationMismatch || acknowledgedMismatch;

  const handleCheckIn = async () => {
    if (locationMismatch && !acknowledgedMismatch) {
      Alert.alert(
        "Confirm Your Location",
        "You appear to be far from this site. Please confirm you're at the correct location before checking in.",
      );
      return;
    }
    setLoading(true);
    try {
      // Photo stays as a raw local uri -- patchWorkflowStatus's underlying
      // submitOrQueue call handles uploading it (online) or persisting it
      // for later upload (offline) automatically, since it recurses into
      // the meta object looking for anything with a `.uri`. No direct
      // upload call here means this never throws just for being offline.
      await patchWorkflowStatus(
        params.siteId,
        params.workflowId,
        params.workflowClientId,
        "checked_in",
        {
          photo: photo ? { uri: photo.uri } : undefined,
          checkedInAt: new Date().toISOString(),
          locationVerification: locationStatus ? {
            verifiable: locationStatus.verifiable,
            isInside: locationStatus.isInside ?? null,
            distanceMeters: locationStatus.distanceMeters ?? null,
            wasAcknowledgedMismatch: !!(locationMismatch && acknowledgedMismatch),
            // Raw GPS reading, so the server can independently recompute
            // isInside/distanceMeters against the site's real coordinates
            // at check-in time instead of just trusting this object's
            // isInside/distanceMeters, which otherwise travel from an
            // earlier, disconnected verify-location call.
            latitude: locationStatus.latitude ?? null,
            longitude: locationStatus.longitude ?? null,
          } : undefined,
        },
      );

      console.log("[CheckIn] Patched checked_in, workflowId:", params.workflowId);

      // Location sharing starts here — only after a successful check-in,
      // only for this specific active workflow. Silently skipped if the
      // workflow hasn't synced to the server yet (offline check-in) since
      // there's no real workflowId to validate a ping against yet.
      if (params.workflowId) {
        startSharing(params.workflowId);
      }

      router.replace({
        pathname: "/(technician)/refueling/form",
        params: { ...params },
      });
    } catch (err: any) {
      // patchWorkflowStatus itself doesn't throw for connectivity reasons --
      // this catch only fires for genuine unexpected errors, so it's safe
      // to surface as a real error here.
      console.error("[CheckIn] error:", err?.message);
      Alert.alert("Error", "Failed to save check-in data.");
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
        <Text style={styles.headerTitle}>Check-In at Site</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.siteName}>{params.siteName}</Text>
        <Text style={styles.siteCode}>{params.siteCode}</Text>

        <View style={styles.infoCard}>
          <FontAwesome5 name="map-marker-alt" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>Take an optional photo when you arrive at the site.</Text>
        </View>

        <View style={styles.sharingNotice}>
          <FontAwesome5 name="location-arrow" size={14} color="#1D4ED8" />
          <Text style={styles.sharingNoticeText}>
            Checking in shares your live location with your manager until you check out — this
            helps them see who's closest to a site that needs attention. Sharing stops the moment
            you check out.
          </Text>
        </View>

        {/* ── Location verification ── */}
        {checkingLocation ? (
          <View style={styles.locationCard}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.locationCheckingText}>Verifying your location…</Text>
          </View>
        ) : locationStatus?.verifiable === false ? (
          <View style={[styles.locationCard, styles.locationUnavailable]}>
            <FontAwesome5 name="map-marker-alt" size={16} color="#6B7280" />
            <Text style={styles.locationUnavailableText}>
              {locationStatus.reason || "Location verification unavailable."}
            </Text>
          </View>
        ) : locationStatus?.isInside ? (
          <View style={[styles.locationCard, styles.locationOk]}>
            <FontAwesome5 name="check-circle" size={16} color="#16A34A" />
            <Text style={styles.locationOkText}>
              You're at this site ({locationStatus.distanceMeters}m from center)
            </Text>
          </View>
        ) : locationMismatch ? (
          <View style={[styles.locationCard, styles.locationWarning]}>
            <FontAwesome5 name="exclamation-triangle" size={16} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationWarningText}>
                You're {locationStatus?.distanceMeters}m from this site's recorded location —
                further than expected. Please confirm you're at the right site.
              </Text>
              <TouchableOpacity
                style={styles.acknowledgeRow}
                onPress={() => setAcknowledgedMismatch(a => !a)}
              >
                <View style={[styles.checkbox, acknowledgedMismatch && styles.checkboxChecked]}>
                  {acknowledgedMismatch && <FontAwesome5 name="check" size={10} color="#fff" />}
                </View>
                <Text style={styles.acknowledgeText}>I confirm I am at the correct site</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <PhotoCapture
          label="Site Arrival Photo (Optional)"
          photos={photo ? [photo] : []}
          onAddPhoto={(p) => setPhoto(p)}
          onRemovePhoto={() => setPhoto(null)}
          required={false}
        />

        <TouchableOpacity
          style={[styles.btn, (loading || !canProceed) && { opacity: 0.6 }]}
          onPress={handleCheckIn}
          disabled={loading || !canProceed}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Check In & Open Form →</Text>}
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
  body:        { padding: 20, gap: 16 },
  siteName:    { fontSize: 20, fontWeight: "700", color: "#111827" },
  siteCode:    { fontSize: 14, color: "#6B7280", marginTop: -8 },
  infoCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoText: { flex: 1, fontSize: 14, color: "#1E40AF" },
  sharingNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 8, padding: 10, marginBottom: 16,
  },
  sharingNoticeText: { flex: 1, fontSize: 12, color: "#1E3A8A", lineHeight: 17 },
  locationCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 10, padding: 14, borderWidth: 1,
  },
  locationCheckingText: { fontSize: 13, color: "#6B7280" },
  locationUnavailable: { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
  locationUnavailableText: { flex: 1, fontSize: 13, color: "#6B7280" },
  locationOk: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  locationOkText: { flex: 1, fontSize: 13, color: "#166534", fontWeight: "600" },
  locationWarning: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", alignItems: "flex-start" },
  locationWarningText: { fontSize: 13, color: "#92400E", marginBottom: 8 },
  acknowledgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: "#D97706",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  checkboxChecked: { backgroundColor: "#D97706" },
  acknowledgeText: { fontSize: 13, color: "#92400E", fontWeight: "600" },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});






