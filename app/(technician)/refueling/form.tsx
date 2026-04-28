import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormSection } from "../../../components/ui/FormSection";
import { InputField } from "../../../components/ui/InputField";
import {
  PhotoAttachment,
  PhotoCapture,
} from "../../../components/ui/PhotoCapture";
import { Colors } from "../../../constants/Colors";
import { api, uploadAPI } from "../../../services/api";
import { refuelWorkflowAPI } from "../../../services/refuelWorkflowAPI";
import {
  checkOutSite,
  getCurrentVisit,
} from "../../../services/siteVisit";

export default function RefuelFormScreen() {
  const router = useRouter();
  const { siteId, siteName, checked_out } = useLocalSearchParams();
  // Debug log for siteId
  console.log('[RefuelForm] siteId:', siteId);
  // ── Photo states ──────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [measurementPhotos, setMeasurementPhotos] = useState<PhotoAttachment[]>([]);
  const [guardPhotos, setGuardPhotos] = useState<PhotoAttachment[]>([]);

  // ── Measurement fields ────────────────────────────────────────────────────
  const [dipStickBefore, setDipStickBefore] = useState("");
  const [dipStickAfter, setDipStickAfter] = useState("");
  const [truckFlowMeterBefore, setTruckFlowMeterBefore] = useState("");
  const [truckFlowMeterAfter, setTruckFlowMeterAfter] = useState("");
  const [truckPlateNumber, setTruckPlateNumber] = useState("");

  // ── Guard fields ──────────────────────────────────────────────────────────
  const [guardName, setGuardName] = useState("");
  const [guardNumber, setGuardNumber] = useState("");

  // ── Tank / sensor fields ──────────────────────────────────────────────────
  const [tankObservations, setTankObservations] = useState("");
  const [fuelSensorStatus, setFuelSensorStatus] = useState("");

  // ── Collapsible: guard only (measurement is always expanded) ─────────────
  const [showGuard, setShowGuard] = useState(false);

  const [dateOfRefuel] = useState(() => new Date().toISOString());
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    siteId: string;
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [visitLoading, setVisitLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);

  const [prevMeter] = useState("");
  const [currMeter, setCurrMeter] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [prevQty] = useState(params.currentLevel || "0");
  const [fuelFound, setFuelFound] = useState("");
  const [fuelAdded, setFuelAdded] = useState("");
  const [comments, setComments] = useState("");

  const [fuelConsumed, setFuelConsumed] = useState("");
  const [runningHours, setRunningHours] = useState("");
  const [currentTotal, setCurrentTotal] = useState("");

  // ── Visit ─────────────────────────────────────────────────────────────────
  const refreshVisit = async () => {
    try {
      setVisitLoading(true);
      const visit = await getCurrentVisit();
      setActiveVisit(visit);
    } catch (error) {
      console.error("Failed to load active visit", error);
      setActiveVisit(null);
    } finally {
      setVisitLoading(false);
    }
  };

  useEffect(() => {
    if (params.siteId) {
      refreshVisit();
    } else {
      setVisitLoading(false);
    }
  }, [params.siteId]);

  // ── Auto-calculations ─────────────────────────────────────────────────────
  useEffect(() => {
    const found = parseFloat(fuelFound) || 0;
    const added = parseFloat(fuelAdded) || 0;
    const total = found + added;
    setCurrentTotal(
      total > 0 ? `${total} L` : t("auto_calculated", "Auto-calculated"),
    );
    const prev = parseFloat(prevQty.replace(/,/g, "")) || 0;
    if (fuelFound && found >= 0) {
      const consumed = prev - found;
      setFuelConsumed(`${parseFloat(consumed.toFixed(1))} L`);
    } else {
      setFuelConsumed(t("auto_calculated", "Auto-calculated"));
    }
  }, [fuelFound, fuelAdded, prevQty, t]);

  useEffect(() => {
    const prev = parseFloat(prevMeter.replace(/[^0-9.]/g, "")) || 0;
    const curr = parseFloat(currMeter) || 0;
    if (curr > 0) {
      const diff = curr - prev;
      setRunningHours(
        diff >= 0
          ? `+${diff} ${t("hours_short", "hrs")}`
          : t("error_current_less_than_previous", "Error: Current < Previous"),
      );
    } else {
      setRunningHours(t("auto_calculated", "Auto-calculated"));
    }
  }, [currMeter, prevMeter, t]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toStr = (v: string): string | undefined =>
    v.trim() === "" ? undefined : v.trim();

  const toNum = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (trimmed === "") return undefined;
    const n = parseFloat(trimmed);
    return isNaN(n) ? undefined : n;
  };

  const calculateFullPercentage = () => {
    const cap = parseFloat(params.capacity || "5000");
    const found = parseFloat(fuelFound) || 0;
    const added = parseFloat(fuelAdded) || 0;
    const total = found + added;
    const percent = Math.min((total / cap) * 100, 100);
    return Math.round(percent > 0 ? percent : 0);
  };


  const handleSubmit = async () => {
  const newErrors: { [key: string]: string } = {};
  if (!currMeter)          newErrors.currMeter = t("required", "Required");
  if (!fuelFound)          newErrors.fuelFound = t("required", "Required");
  if (!fuelAdded)          newErrors.fuelAdded = t("required", "Required");
  if (photos.length === 0) newErrors.photos    = t("required_photos", "At least one photo required");

  setErrors(newErrors);
  if (Object.keys(newErrors).length > 0) {
    Alert.alert(t("missing_fields", "Missing Fields"), t("please_fill_required_fields", "Please fill all required fields."));
    return;
  }

  setLoading(true);
  try {
    // Upload photos first
    const processedPhotos = photos.length > 0
      ? await uploadAPI.processAndUploadData(photos.map(p => p.uri))
      : [];
    const processedMeasurementPhotos = measurementPhotos.length > 0
      ? await uploadAPI.processAndUploadData(measurementPhotos.map(p => p.uri))
      : [];
    const processedGuardPhotos = guardPhotos.length > 0
      ? await uploadAPI.processAndUploadData(guardPhotos.map(p => p.uri))
      : [];

    // PATCH form_opened step on the workflow record
    if (params.workflowId) {
      await refuelWorkflowAPI.updateStatus(params.workflowId, "form_opened", {
        formOpenedAt: new Date().toISOString(),
      });
    }

    // Build payload — encode as JSON string to pass through router params
    const formPayload = JSON.stringify({
      site_id:                params.siteId,
      site_name:              params.siteName,
      maintenanceId:          params.maintenanceId,
      opening_level:          parseFloat(prevQty),
      closing_level:          parseFloat(fuelFound),
      fuel_added:             parseFloat(fuelAdded),
      tank_capacity:          parseFloat(params.capacity || "5000"),
      closing_hours:          toNum(currMeter),
      comments:               toStr(comments),
      photos:                 processedPhotos,
      date_of_refuel:         dateOfRefuel,
      guard_name:             toStr(guardName),
      guard_number:           toStr(guardNumber),
      guard_photos:           processedGuardPhotos.length > 0 ? processedGuardPhotos : undefined,
      tank_observations:      toStr(tankObservations),
      fuel_sensor_status:     toStr(fuelSensorStatus),
      dip_stick_before_cm:    toNum(dipStickBefore),
      dip_stick_after_cm:     toNum(dipStickAfter),
      truck_flow_meter_before_l: toNum(truckFlowMeterBefore),
      truck_flow_meter_after_l:  toNum(truckFlowMeterAfter),
      truck_plate_number:     toStr(truckPlateNumber),
      measurement_photos:     processedMeasurementPhotos.length > 0 ? processedMeasurementPhotos : undefined,
    });

    // Navigate to summary for final review before submitting
    router.push({
      pathname: "/(technician)/refueling-flow/summary",
      params: {
        workflowId:   params.workflowId,
        siteId:       params.siteId,
        siteName:     params.siteName,
        maintenanceId: params.maintenanceId,
        formPayload,  // carry form data as encoded string
      },
    });
  } catch (error: any) {
    Alert.alert(t("error", "Error"), error?.message || t("failed_submit_refuel", "Failed to prepare submission"));
  } finally {
    setLoading(false);
  }
};

  // ── Check out ─────────────────────────────────────────────────────────────
  const handleCheckOut = async () => {
    try {
      const res = await checkOutSite();
      if (res.data?.success) {
        Alert.alert("Success", "Checked out successfully.");
        await refreshVisit();
        router.push("/(technician)/dashboard");
      } else {
        Alert.alert("Error", res.data?.error || "Check-out failed.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Check-out failed.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Shared render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>
      <View>
        <Text style={styles.headerTitle}>Refueling Entry</Text>
        <Text style={styles.subTitle}>
          {params.siteName || "Site A - Lagos"}
        </Text>
      </View>
      {!params.checked_out && (
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(technician)/refueling-flow/checkout-site",
              params: {
                siteId: params.siteId,
                siteName: params.siteName,
                tankId: params.tankId,
                capacity: params.capacity,
                maintenanceId: params.maintenanceId,
              },
            })
          }
          style={{ padding: 4 }}
        >
          <Ionicons name="log-out-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTankCard = () => (
    <View style={styles.tankCard}>
      <View style={styles.tankHeader}>
        <View style={styles.iconBox}>
          <Ionicons name="water" size={24} color="white" />
        </View>
        <View>
          <Text style={styles.tankTitle}>Tank Information</Text>
          <Text style={styles.tankId}>{params.tankId || "TANK-001-A"}</Text>
        </View>
      </View>
      <View style={styles.tankInfoSection}>
        <Text style={styles.sectionLabel}>Default Tank Info</Text>
        <View style={styles.tankStatsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{params.capacity || "5000L"}</Text>
            <Text style={styles.statLabel}>Capacity</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{calculateFullPercentage()}%</Text>
            <Text style={styles.statLabel}>Current</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>U/G</Text>
            <Text style={styles.statLabel}>Type</Text>
          </View>
        </View>
      </View>
      <View style={styles.sectionDivider} />
    </View>
  );

  /**
   * Guard section.
   * Pass collapsible=true for the checked-in view,
   * collapsible=false (default) for the plain view.
   */
  const renderGuardSection = (collapsible = false) => {
    const fields = (
      <>
        <InputField
          label={t("guard_name", "Guard Name")}
          value={guardName}
          onChangeText={setGuardName}
        />
        <InputField
          label={t("guard_number", "Guard Number")}
          value={guardNumber}
          onChangeText={setGuardNumber}
          keyboardType="phone-pad"
        />
        <PhotoCapture
          label={t("guard_photo_optional", "Guard Photo (Optional)")}
          photos={guardPhotos}
          onAddPhoto={(p) => setGuardPhotos((prev) => [...prev, p])}
          onRemovePhoto={(uri) =>
            setGuardPhotos((prev) => prev.filter((p) => p.uri !== uri))
          }
          required={false}
        />
      </>
    );

    if (collapsible) {
      return (
        <>
          <TouchableOpacity
            onPress={() => setShowGuard((v) => !v)}
            style={styles.collapsibleToggle}
          >
            <Ionicons
              name={showGuard ? "chevron-down" : "chevron-forward"}
              size={18}
              color={Colors.primary}
            />
            <Text style={[styles.sectionLabel, { marginLeft: 4 }]}>
              {t("guard_information", "Guard Information")}
            </Text>
          </TouchableOpacity>
          {showGuard && (
            <FormSection
              title={t("guard_information", "Guard Information")}
              icon="shield-outline"
            >
              {fields}
            </FormSection>
          )}
        </>
      );
    }

    return (
      <FormSection
        title={t("guard_information", "Guard Information")}
        icon="shield-outline"
      >
        {fields}
      </FormSection>
    );
  };

  /**
   * Measurement Information section.
   * ALWAYS rendered — never hidden behind a collapsible.
   * PhotoCapture is always visible at the bottom.
   */
  const renderMeasurementSection = () => (
    <FormSection
      title={t("measurement_information", "Measurement Information")}
      icon="analytics-outline"
    >
      <InputField
        label={t("dip_stick_before", "Dip Stick Measurement Before (cm)")}
        value={dipStickBefore}
        onChangeText={setDipStickBefore}
        keyboardType="numeric"
        error={
          dipStickBefore !== "" && isNaN(Number(dipStickBefore))
            ? t("invalid_number", "Enter a valid number")
            : undefined
        }
      />
      <InputField
        label={t("dip_stick_after", "Dip Stick Measurement After (cm)")}
        value={dipStickAfter}
        onChangeText={setDipStickAfter}
        keyboardType="numeric"
        error={
          dipStickAfter !== "" && isNaN(Number(dipStickAfter))
            ? t("invalid_number", "Enter a valid number")
            : undefined
        }
      />
      <InputField
        label={t("truck_flow_meter_before", "Truck Flow Meter Before (L)")}
        value={truckFlowMeterBefore}
        onChangeText={setTruckFlowMeterBefore}
        keyboardType="numeric"
        error={
          truckFlowMeterBefore !== "" && isNaN(Number(truckFlowMeterBefore))
            ? t("invalid_number", "Enter a valid number")
            : undefined
        }
      />
      <InputField
        label={t("truck_flow_meter_after", "Truck Flow Meter After (L)")}
        value={truckFlowMeterAfter}
        onChangeText={setTruckFlowMeterAfter}
        keyboardType="numeric"
        error={
          truckFlowMeterAfter !== "" && isNaN(Number(truckFlowMeterAfter))
            ? t("invalid_number", "Enter a valid number")
            : undefined
        }
      />
      <InputField
        label={t("truck_plate_number", "Truck Plate Number")}
        value={truckPlateNumber}
        onChangeText={setTruckPlateNumber}
      />

      {/* ── Measurement Photos — always visible ───────────────────────────── */}
      <PhotoCapture
        label={t("measurement_photos", "Measurement Photos (Optional)")}
        photos={measurementPhotos}
        onAddPhoto={(p) => setMeasurementPhotos((prev) => [...prev, p])}
        onRemovePhoto={(uri) =>
          setMeasurementPhotos((prev) => prev.filter((p) => p.uri !== uri))
        }
        required={false}
      />
    </FormSection>
  );

  const renderMeterReadings = () => (
    <FormSection
      title={t("meter_readings", "Meter Readings")}
      icon="speedometer-outline"
    >
      <View style={styles.readOnlyField}>
        <Text style={styles.readOnlyLabel}>
          {t("previous_reading", "Previous Reading")}
        </Text>
        <Text style={styles.readOnlyValue}>
          {prevMeter} {t("hours_short", "hrs")}
        </Text>
      </View>
      <InputField
        label={t("current_meter_reading", "Current Meter Reading")}
        value={currMeter}
        onChangeText={setCurrMeter}
        unit={t("hours_short", "hrs")}
        keyboardType="numeric"
        required
        accessibilityLabel={t("current_meter_reading", "Current Meter Reading")}
        style={errors.currMeter ? styles.inputError : undefined}
      />
      {errors.currMeter && (
        <Text style={styles.errorText}>{errors.currMeter}</Text>
      )}
      <View
        style={[
          styles.calcBox,
          runningHours.startsWith(t("error", "Error"))
            ? styles.errorBox
            : styles.successBox,
        ]}
      >
        <Ionicons
          name="trending-up"
          size={20}
          color={
            runningHours.startsWith(t("error", "Error"))
              ? Colors.danger
              : Colors.success
          }
        />
        <Text style={styles.calcLabel}>
          {t("running_hours", "Running Hours")}
        </Text>
        <Text
          style={[
            styles.calcValue,
            {
              color: runningHours.startsWith(t("error", "Error"))
                ? Colors.danger
                : Colors.success,
            },
          ]}
        >
          {runningHours}
        </Text>
      </View>
    </FormSection>
  );

  const renderDieselInfo = () => (
    <FormSection
      title={t("diesel_information", "Diesel Information")}
      icon="water-outline"
    >
      <View style={styles.row}>
        <View style={[styles.readOnlyField, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.readOnlyLabel}>
            {t("previous_qty", "Previous QTY")}
          </Text>
          <Text style={styles.readOnlyValue}>{prevQty} L</Text>
        </View>
        <View style={{ flex: 1 }}>
          <InputField
            label={t("fuel_found", "Fuel Found")}
            value={fuelFound}
            onChangeText={setFuelFound}
            unit="L"
            keyboardType="numeric"
            required
            accessibilityLabel={t("fuel_found", "Fuel Found")}
            style={errors.fuelFound ? styles.inputError : undefined}
          />
          {errors.fuelFound && (
            <Text style={styles.errorText}>{errors.fuelFound}</Text>
          )}
        </View>
      </View>

      <View style={[styles.calcBox, styles.warningBox]}>
        <Text style={styles.calcLabel}>
          {t("fuel_consumed", "Fuel Consumed")}
        </Text>
        <Text style={[styles.calcValue, { color: "#ea580c" }]}>
          {fuelConsumed}
        </Text>
      </View>

      <InputField
        label={t("fuel_added", "Fuel Added")}
        value={fuelAdded}
        onChangeText={setFuelAdded}
        unit="L"
        keyboardType="numeric"
        required
        accessibilityLabel={t("fuel_added", "Fuel Added")}
        style={errors.fuelAdded ? styles.inputError : undefined}
      />
      {errors.fuelAdded && (
        <Text style={styles.errorText}>{errors.fuelAdded}</Text>
      )}

      <View style={styles.totalBox}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="checkmark-circle" size={24} color="white" />
          <View>
            <Text style={styles.totalLabel}>
              {t("current_total", "Current Total")}
            </Text>
            <Text style={styles.totalValue}>{currentTotal}</Text>
          </View>
        </View>
      </View>
    </FormSection>
  );

  const renderDocumentationPhotos = () => (
    <FormSection
      title={t("documentation_photos", "Documentation Photos")}
      icon="camera-outline"
    >
      <PhotoCapture
        label={t(
          "required_meter_tank_receipt",
          "Required: Meter, Tank Level, Receipt",
        )}
        photos={photos}
        onAddPhoto={(p) => setPhotos((prev) => [...prev, p])}
        onRemovePhoto={(uri) =>
          setPhotos((prev) => prev.filter((p) => p.uri !== uri))
        }
        required
      />
      {errors.photos && (
        <Text style={styles.errorText}>{errors.photos}</Text>
      )}
    </FormSection>
  );

  const renderTankObservations = () => (
    <FormSection
      title={t("tank_observation_sensor", "Tank Observation & Sensor Status")}
      icon="eye-outline"
    >
      <InputField
        label={t("tank_observations", "Tank Observations")}
        value={tankObservations}
        onChangeText={setTankObservations}
        multiline
        numberOfLines={3}
        style={styles.observationInput}
        placeholder="Describe any tank observations..."
      />
      <InputField
        label={t("fuel_sensor_status", "Fuel Sensor Status")}
        value={fuelSensorStatus}
        onChangeText={setFuelSensorStatus}
        style={styles.sensorInput}
        placeholder="Enter sensor status or select"
      />
    </FormSection>
  );

  const renderComments = () => (
    <FormSection
      title={t("additional_comments", "Additional Comments")}
      icon="create-outline"
    >
      <InputField
        label=""
        placeholder={t(
          "refuel_comments_placeholder",
          "Any observations, delivery issues, or special notes...",
        )}
        value={comments}
        onChangeText={setComments}
        multiline
        numberOfLines={4}
        style={{ minHeight: 100, textAlignVertical: "top" }}
      />
    </FormSection>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <TouchableOpacity
        style={styles.saveDraftBtn}
        disabled={loading}
        accessibilityLabel={
          t("save_draft", "Save Draft") + (loading ? " (disabled)" : "")
        }
      >
        <Text style={styles.saveDraftText}>{t("save_draft", "Save Draft")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityLabel={
          t("submit_refueling", "Submit Refueling") +
          (loading ? " (loading)" : "")
        }
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitBtnText}>
            {t("submit_refueling", "Submit Refueling")}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────
  if (visitLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Text>Checking site entry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Checked-in view  (activeVisit matches this site)
  // ─────────────────────────────────────────────────────────────────────────
  if (params.siteId && activeVisit && activeVisit.site_id === params.siteId) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderTankCard()}
          {renderGuardSection(true)}
          {renderMeasurementSection()}
          {renderMeterReadings()}
          {renderDieselInfo()}
          {renderDocumentationPhotos()}
          {renderComments()}
        </ScrollView>
        {renderFooter()}
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Default view  (no active visit / wrong site)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderTankCard()}
        {renderGuardSection(false)}
        {renderMeasurementSection()}
        {renderMeterReadings()}
        {renderDieselInfo()}
        {renderDocumentationPhotos()}
        {renderTankObservations()}
        {renderComments()}
      </ScrollView>
      {renderFooter()}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: Colors.text },
  subTitle: { fontSize: 12, color: Colors.textSecondary },
  backButton: { padding: 4 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  // Tank card
  tankCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tankHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tankTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  tankId: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  tankInfoSection: { marginBottom: 8, paddingBottom: 4 },
  tankStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statChip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
  statValue: { color: "white", fontWeight: "700", fontSize: 16 },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  sectionLabel: {
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 4,
    marginTop: 4,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  sectionDivider: {
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },

  // Collapsible toggle (guard only)
  collapsibleToggle: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
  },

  // Read-only fields
  readOnlyField: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readOnlyLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { fontSize: 16, fontWeight: "600", color: Colors.text },

  // Calc boxes
  calcBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  successBox: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  errorBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  warningBox: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  calcLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "500",
    flex: 1,
    marginLeft: 8,
  },
  calcValue: { fontWeight: "700", fontSize: 16 },

  // Total box
  totalBox: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  totalLabel: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginBottom: 2 },
  totalValue: { color: "white", fontSize: 24, fontWeight: "700" },

  row: { flexDirection: "row" },

  // Observation / sensor inputs
  observationInput: {
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sensorInput: {
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  // Validation
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 1.5,
    backgroundColor: "#fef2f2",
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 8,
    marginLeft: 2,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    gap: 12,
  },
  saveDraftBtn: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveDraftText: {
    color: Colors.textSecondary,
    fontWeight: "600",
    fontSize: 16,
  },
  submitBtn: {
    flex: 1.5,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnText: { color: "white", fontWeight: "600", fontSize: 16 },
});




