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
import { getWorkflow, patchWorkflowStatus } from "../../../services/offlineWorkflow";
import { cacheGet, cacheSet } from "../../../lib/syncQueue";
import {
  checkOutSite,
  getCurrentVisit,
} from "../../../services/siteVisit";

// NOTE: photos are no longer uploaded here — they stay as local file:// URIs
// in the payload handed to the summary screen. submitOrQueue (called from
// the summary screen) owns uploading them, whether online or via the
// offline sync queue. This is what makes the offline path work: uploading
// here would throw immediately if there's no connection.

export default function RefuelFormScreen() {
  const router = useRouter();
  const { siteId, siteName, checked_out } = useLocalSearchParams();
  console.log('[RefuelForm] siteId:', siteId);
  // ── Photo states ──────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [measurementPhotos, setMeasurementPhotos] = useState<PhotoAttachment[]>([]);
  const [guardPhotos, setGuardPhotos] = useState<PhotoAttachment[]>([]);

  // Persist a photo to stable storage the moment it is picked.
  // ImagePicker cache URIs on Android are evicted quickly — copying immediately
  // ensures the file exists when the upload runs (which may be seconds later).
  const addPhotoPersisted = async (
    setter: React.Dispatch<React.SetStateAction<PhotoAttachment[]>>,
    photo: PhotoAttachment,
  ) => {
    try {
      const { persistLocalPhoto } = await import('../../../services/offlineApi');
      const stableUri = await persistLocalPhoto(photo.uri);
      setter(prev => [...prev, { ...photo, uri: stableUri }]);
    } catch {
      // Fallback: keep the original URI (best effort)
      setter(prev => [...prev, photo]);
    }
  };

  // ── Measurement fields ────────────────────────────────────────────────────
  const [dipStickBefore, setDipStickBefore] = useState("");
  const [dipStickAfter, setDipStickAfter] = useState("");
  // ── Truck Flow Meter fields COMMENTED OUT ────────────────────────────────
  // These duplicate data already captured in the Diesel Information section.
  // Dip Stick measurements (below) are the authoritative tank-level capture.
  // const [truckFlowMeterBefore, setTruckFlowMeterBefore] = useState("");
  // const [truckFlowMeterAfter, setTruckFlowMeterAfter] = useState("");
  const [truckPlateNumber, setTruckPlateNumber] = useState("");

  // ── Guard fields ──────────────────────────────────────────────────────────
  const [guardName, setGuardName] = useState("");
  const [guardNumber, setGuardNumber] = useState("");

  // ── Tank / sensor fields ──────────────────────────────────────────────────
  const [tankObservations, setTankObservations] = useState("");
  const [fuelSensorStatus, setFuelSensorStatus] = useState("");

  // ── Collapsible: guard only (measurement is always expanded) ─────────────
  const [showGuard, setShowGuard] = useState(false);

  // ── Visit date & time (editable — technician may submit after the fact) ───
  const nowDate = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const [visitDate, setVisitDate] = useState(
    () => `${nowDate.getFullYear()}-${pad2(nowDate.getMonth() + 1)}-${pad2(nowDate.getDate())}`,
  ); // YYYY-MM-DD
  const [visitTime, setVisitTime] = useState(
    () => `${pad2(nowDate.getHours())}:${pad2(nowDate.getMinutes())}`,
  ); // HH:mm
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    siteId: string;
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId?: string;
    workflowId?: string;
    workflowClientId?: string;
  }>();

  // ── Tank info — editable when what's shown doesn't match reality on site ──
  const [editingTankInfo, setEditingTankInfo] = useState(false);
  const [tankIdInput, setTankIdInput] = useState(params.tankId || "");
  const [tankCapacityInput, setTankCapacityInput] = useState(params.capacity || "5000");
  const [tankTypeInput, setTankTypeInput] = useState("U/G");
  // Tank physical dimensions (cm) — the backend has always accepted
  // tank_length_cm / tank_height_cm / tank_width_cm (see
  // routes/technicians.js and models/FuelConsumption.js) but this form
  // never actually collected them until now.
  const [tankLengthInput, setTankLengthInput] = useState("");
  const [tankHeightInput, setTankHeightInput] = useState("");
  const [tankWidthInput, setTankWidthInput] = useState("");

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
  // Defaults to true (delivery complete) — matches the common case and
  // preserves prior behavior for the majority of refuels. The technician
  // only needs to actively flip this when they're delivering LESS than
  // was approved because that's all the fuel they had available (e.g.
  // using leftover balance from an existing purchase), not because the
  // tank is actually full — the two situations need very different
  // handling on the backend (see routes/technicians.js's POST /refuel).
  const [deliveryComplete, setDeliveryComplete] = useState(true);

  const [fuelConsumed, setFuelConsumed] = useState("");
  const [runningHours, setRunningHours] = useState("");
  const [currentTotal, setCurrentTotal] = useState("");

  // ── Fuel purchase reference ────────────────────────────────────────────────
  // Read once from the LOCAL workflow cache's "purchase_selected" step
  // (patched back in select-fuel-purchase.tsx / new-fuel-purchase.tsx via
  // patchWorkflowStatus, which always updates the local cache immediately
  // regardless of connectivity). Reading from the local cache instead of a
  // network call means this works identically online or offline -- a raw
  // API call here would just silently fail while offline.
  const [fuelPurchaseId, setFuelPurchaseId] = useState<string | undefined>();
  const [fuelPurchaseClientId, setFuelPurchaseClientId] = useState<string | undefined>();

  // ── Draft save/restore ───────────────────────────────────────────────────────
  // Previously the "Save Draft" button had no onPress handler at all — it
  // was a fully non-functional decoration. Implemented using the same
  // local-cache pattern already established elsewhere in this app
  // (lib/localPurchases.ts's cacheGet/cacheSet), keyed per-site so a
  // technician can have at most one in-progress draft per site at a time.
  const draftKey = `refuel_draft_${siteId}`;
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  function buildDraftPayload() {
    return {
      dipStickBefore, dipStickAfter, truckPlateNumber,
      guardName, guardNumber, showGuard,
      tankObservations, fuelSensorStatus,
      visitDate, visitTime,
      tankIdInput, tankCapacityInput, tankTypeInput,
      tankLengthInput, tankHeightInput, tankWidthInput,
      currMeter, fuelFound, fuelAdded, comments,
      fuelConsumed, runningHours, currentTotal,
      deliveryComplete,
      // Photos are already-persisted local file:// URIs at this point
      // (see the photo-handling note above), so their string paths are
      // safe and cheap to include in the draft.
      photos, measurementPhotos, guardPhotos,
    };
  }

  async function handleSaveDraft() {
    try {
      await cacheSet(draftKey, buildDraftPayload());
      setDraftSavedAt(Date.now());
      Alert.alert(
        t("draft_saved", "Draft Saved"),
        t("draft_saved_message", "Your progress has been saved. You can come back and continue this refueling later.")
      );
    } catch (e) {
      console.warn('[RefuelForm] Failed to save draft:', e);
      Alert.alert(t("error", "Error"), t("draft_save_failed", "Could not save draft. Please try again."));
    }
  }

  async function clearDraft() {
    try { await cacheSet(draftKey, null); } catch { /* non-fatal */ }
  }

  // Offer to restore an existing draft for this site on mount.
  useEffect(() => {
    if (!siteId) return;
    (async () => {
      try {
        const cached = await cacheGet<ReturnType<typeof buildDraftPayload> | null>(draftKey);
        const draft = cached?.data;
        if (!draft) return;
        Alert.alert(
          t("draft_found", "Draft Found"),
          t("draft_found_message", "You have a saved draft for this site. Restore it?"),
          [
            { text: t("discard", "Discard"), style: "destructive", onPress: () => clearDraft() },
            {
              text: t("restore", "Restore"),
              onPress: () => {
                if (draft.dipStickBefore   != null) setDipStickBefore(draft.dipStickBefore);
                if (draft.dipStickAfter    != null) setDipStickAfter(draft.dipStickAfter);
                if (draft.truckPlateNumber != null) setTruckPlateNumber(draft.truckPlateNumber);
                if (draft.guardName        != null) setGuardName(draft.guardName);
                if (draft.guardNumber      != null) setGuardNumber(draft.guardNumber);
                if (draft.showGuard        != null) setShowGuard(draft.showGuard);
                if (draft.tankObservations != null) setTankObservations(draft.tankObservations);
                if (draft.fuelSensorStatus != null) setFuelSensorStatus(draft.fuelSensorStatus);
                if (draft.visitDate        != null) setVisitDate(draft.visitDate);
                if (draft.visitTime        != null) setVisitTime(draft.visitTime);
                if (draft.tankIdInput      != null) setTankIdInput(draft.tankIdInput);
                if (draft.tankCapacityInput != null) setTankCapacityInput(draft.tankCapacityInput);
                if (draft.tankTypeInput    != null) setTankTypeInput(draft.tankTypeInput);
                if (draft.tankLengthInput  != null) setTankLengthInput(draft.tankLengthInput);
                if (draft.tankHeightInput  != null) setTankHeightInput(draft.tankHeightInput);
                if (draft.tankWidthInput   != null) setTankWidthInput(draft.tankWidthInput);
                if (draft.currMeter        != null) setCurrMeter(draft.currMeter);
                if (draft.fuelFound        != null) setFuelFound(draft.fuelFound);
                if (draft.fuelAdded        != null) setFuelAdded(draft.fuelAdded);
                if (draft.comments         != null) setComments(draft.comments);
                if (draft.fuelConsumed     != null) setFuelConsumed(draft.fuelConsumed);
                if (draft.runningHours     != null) setRunningHours(draft.runningHours);
                if (draft.currentTotal     != null) setCurrentTotal(draft.currentTotal);
                if (draft.deliveryComplete != null) setDeliveryComplete(draft.deliveryComplete);
                if (draft.photos           != null) setPhotos(draft.photos);
                if (draft.measurementPhotos != null) setMeasurementPhotos(draft.measurementPhotos);
                if (draft.guardPhotos      != null) setGuardPhotos(draft.guardPhotos);
              },
            },
          ]
        );
      } catch (e) {
        console.warn('[RefuelForm] Failed to check for existing draft:', e);
      }
    })();
    // Intentionally run once on mount only — re-checking on every field
    // change would re-prompt constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    if (!params.siteId) return;
    getWorkflow(params.siteId).then((workflow) => {
      const step = workflow?.workflow_history?.find((h) => h.status === "purchase_selected");
      if (step?.meta?.fuelPurchaseId) setFuelPurchaseId(step.meta.fuelPurchaseId);
      if (step?.meta?.fuelPurchaseClientId) setFuelPurchaseClientId(step.meta.fuelPurchaseClientId);
    });
  }, [params.siteId]);

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
    const cap = parseFloat(tankCapacityInput || params.capacity || "5000");
    const found = parseFloat(fuelFound) || 0;
    const added = parseFloat(fuelAdded) || 0;
    const total = found + added;
    const percent = Math.min((total / cap) * 100, 100);
    return Math.round(percent > 0 ? percent : 0);
  };

  // True regardless of whether the technician actually edited anything —
  // only meaningful when it differs from what was originally displayed.
  const tankInfoWasEdited =
    tankIdInput !== (params.tankId || "") ||
    tankCapacityInput !== (params.capacity || "5000") ||
    tankTypeInput !== "U/G";

  const handleSubmit = async () => {
    const newErrors: { [key: string]: string } = {};
    if (!currMeter)          newErrors.currMeter      = t("required", "Required");
    if (!fuelFound)          newErrors.fuelFound      = t("required", "Required");
    if (!fuelAdded)          newErrors.fuelAdded      = t("required", "Required");
    if (!dipStickBefore)     newErrors.dipStickBefore = t("required", "Dip Stick Before (cm) is required");
    if (!dipStickAfter)      newErrors.dipStickAfter  = t("required", "Dip Stick After (cm) is required");
    if (dipStickBefore && isNaN(Number(dipStickBefore)))
                             newErrors.dipStickBefore = t("invalid_number", "Enter a valid number");
    if (dipStickAfter && isNaN(Number(dipStickAfter)))
                             newErrors.dipStickAfter  = t("invalid_number", "Enter a valid number");
    if (!tankLengthInput)    newErrors.tankLengthInput = t("required", "Tank Length (cm) is required");
    if (!tankHeightInput)    newErrors.tankHeightInput = t("required", "Tank Height (cm) is required");
    if (!tankWidthInput)     newErrors.tankWidthInput  = t("required", "Tank Width (cm) is required");
    if (tankLengthInput && isNaN(Number(tankLengthInput)))
                             newErrors.tankLengthInput = t("invalid_number", "Enter a valid number");
    if (tankHeightInput && isNaN(Number(tankHeightInput)))
                             newErrors.tankHeightInput = t("invalid_number", "Enter a valid number");
    if (tankWidthInput && isNaN(Number(tankWidthInput)))
                             newErrors.tankWidthInput  = t("invalid_number", "Enter a valid number");
    if (photos.length === 0) newErrors.photos         = t("required_photos", "At least one photo required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) newErrors.visitDate = t("invalid_date", "Enter a valid date (YYYY-MM-DD)");
    if (!/^\d{2}:\d{2}$/.test(visitTime))       newErrors.visitTime = t("invalid_time", "Enter a valid time (HH:mm)");

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      Alert.alert(t("missing_fields", "Missing Fields"), t("please_fill_required_fields", "Please fill all required fields."));
      return;
    }

    setLoading(true);
    try {
      // Photos stay as raw local URIs — no upload here. submitOrQueue on the
      // summary screen uploads them (online) or persists+queues them
      // (offline) when the user actually hits SUBMIT & FINISH.
      // Photos were already persisted at pick-time via addPhotoPersisted().
      // This is a second-pass safety net in case any raw URIs slipped through.
      const { persistLocalPhoto } = await import('../../../services/offlineApi');
      const persistUri = async (uri: string) => {
        if (uri.includes('offline_photos')) return uri; // already stable
        try { return await persistLocalPhoto(uri); }
        catch (e) {
          console.warn('[RefuelForm] Could not persist photo URI at submit time:', uri, e);
          return uri;
        }
      };

      const rawPhotos = await Promise.all(
        photos.map(async (p) => ({ uri: await persistUri(p.uri), category: 'general' }))
      );
      const rawMeasurementPhotos = await Promise.all(
        measurementPhotos.map(async (p) => ({ uri: await persistUri(p.uri), category: 'measurement' }))
      );
      const rawGuardPhotos = await Promise.all(
        guardPhotos.map(async (p) => ({ uri: await persistUri(p.uri), category: 'guard' }))
      );

      // The technician-entered date/time of the actual site visit — may be
      // in the past if they're submitting after the fact.
      const visitDateTimeIso = new Date(`${visitDate}T${visitTime}:00`).toISOString();

      // The literal device timestamp at the moment SUBMIT was pressed. This
      // is captured here — before any network attempt — so it survives
      // exactly as-is inside the offline queue and reaches the server
      // unchanged, regardless of how long the device stays offline before
      // syncing. Distinct from visitDateTimeIso above: this is "when the
      // report was filed", that one is "when the technician was on site".
      const submittedAt = new Date().toISOString();

      // PATCH form_opened step on the workflow record. patchWorkflowStatus
      // always succeeds locally and queues the server side -- no try/catch
      // needed for connectivity reasons anymore.
      if (params.workflowId && params.workflowClientId) {
        await patchWorkflowStatus(
          params.siteId,
          params.workflowId,
          params.workflowClientId,
          "form_opened",
          { formOpenedAt: submittedAt },
        );
      }

      // If the technician corrected the tank ID/capacity/type shown on this
      // screen, carry both the original and corrected values through as
      // metadata rather than silently overwriting — useful for supervisors
      // reviewing why a site's tank record changed.
      const tankInfoOverride = tankInfoWasEdited
        ? {
            original: {
              tank_id: params.tankId || "",
              capacity: params.capacity || "5000",
              type: "U/G",
            },
            updated: {
              tank_id: tankIdInput,
              capacity: tankCapacityInput,
              type: tankTypeInput,
            },
            edited_by: undefined, // filled in by backend from the auth token
            edited_at: submittedAt,
          }
        : undefined;

      // Build payload — encode as JSON string to pass through router params
      const formPayload = JSON.stringify({
        site_id:                params.siteId,
        site_name:              params.siteName,
        maintenanceId:          params.maintenanceId,
        opening_level:          parseFloat(prevQty),
        closing_level:          parseFloat(fuelFound),
        fuel_added:             parseFloat(fuelAdded),
        delivery_complete:      deliveryComplete,
        tank_capacity:          parseFloat(tankCapacityInput || params.capacity || "5000"),
        tank_id:                toStr(tankIdInput),
        tank_type:              toStr(tankTypeInput),
        tank_length_cm:         toNum(tankLengthInput),
        tank_height_cm:         toNum(tankHeightInput),
        tank_width_cm:          toNum(tankWidthInput),
        tank_info_override:     tankInfoOverride,
        closing_hours:          toNum(currMeter),
        comments:               toStr(comments),
        photos:                 rawPhotos,
        // Editable visit date/time (when the technician was actually on
        // site — may be a prior day) and the true device submission time
        // (captured now, survives the offline queue untouched).
        date_of_refuel:         visitDateTimeIso,
        visit_date:             visitDate,
        visit_time:             visitTime,
        submitted_at:           submittedAt,
        guard_name:             toStr(guardName),
        guard_number:           toStr(guardNumber),
        guard_photos:           rawGuardPhotos.length > 0 ? rawGuardPhotos : undefined,
        tank_observations:      toStr(tankObservations),
        fuel_sensor_status:     toStr(fuelSensorStatus),
        dip_stick_before_cm:    toNum(dipStickBefore),
        dip_stick_after_cm:     toNum(dipStickAfter),
        // truck_flow_meter_before_l: toNum(truckFlowMeterBefore),  // COMMENTED — duplicates Diesel Information section
        // truck_flow_meter_after_l:  toNum(truckFlowMeterAfter),   // COMMENTED — duplicates Diesel Information section
        truck_plate_number:     toStr(truckPlateNumber),
        measurement_photos:     rawMeasurementPhotos.length > 0 ? rawMeasurementPhotos : undefined,
        // The shared fuel purchase this site's usage draws down — see the
        // useEffect above that reads it from the workflow.
        fuel_purchase_id:          fuelPurchaseId,
        fuel_purchase_client_id:   fuelPurchaseClientId,
      });

      // Navigate to summary for final review before submitting
      // This step (reaching the summary screen) marks the form itself as
      // complete, so any saved draft for this site is no longer needed.
      await clearDraft();
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
                siteCode: params.siteCode,
                tankId: tankIdInput || params.tankId,
                capacity: tankCapacityInput || params.capacity,
                maintenanceId: params.maintenanceId,
                workflowId: params.workflowId,
                workflowClientId: params.workflowClientId,
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
        <View style={{ flex: 1 }}>
          <Text style={styles.tankTitle}>Tank Information</Text>
          <Text style={styles.tankId}>{tankIdInput || "TANK-001-A"}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setEditingTankInfo((v) => !v)}
          style={styles.editTankBtn}
        >
          <Ionicons
            name={editingTankInfo ? "checkmark" : "create-outline"}
            size={16}
            color="white"
          />
          <Text style={styles.editTankBtnText}>
            {editingTankInfo ? "Done" : "Correct Info"}
          </Text>
        </TouchableOpacity>
      </View>

      {editingTankInfo ? (
        <View style={styles.tankEditSection}>
          <Text style={styles.sectionLabelDark}>
            Not the actual tank for this site? Update it below.
          </Text>
          <InputField
            label="Tank ID"
            value={tankIdInput}
            onChangeText={setTankIdInput}
          />
          <InputField
            label="Capacity (L)"
            value={tankCapacityInput}
            onChangeText={setTankCapacityInput}
            keyboardType="numeric"
          />
          <InputField
            label="Tank Type"
            value={tankTypeInput}
            onChangeText={setTankTypeInput}
            placeholder="e.g. U/G, Above Ground"
          />
        </View>
      ) : (
        <View style={styles.tankInfoSection}>
          <Text style={styles.sectionLabel}>
            {tankInfoWasEdited ? "Corrected Tank Info" : "Default Tank Info"}
          </Text>
          <View style={styles.tankStatsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{tankCapacityInput || "5000"}L</Text>
              <Text style={styles.statLabel}>Capacity</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{calculateFullPercentage()}%</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{tankTypeInput}</Text>
              <Text style={styles.statLabel}>Type</Text>
            </View>
          </View>
          {tankInfoWasEdited && (
            <View style={styles.correctionNotice}>
              <Ionicons name="alert-circle-outline" size={13} color="#92400E" />
              <Text style={styles.correctionNoticeText}>
                Corrected from what was on file — saved with this report.
              </Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.sectionDivider} />
    </View>
  );

  const renderVisitDateTime = () => (
    <FormSection title={t("visit_date_time", "Visit Date & Time")} icon="calendar-outline">
      <Text style={styles.helperNote}>
        {t(
          "visit_date_time_helper",
          "Submitting after the fact? Set the date and time you were actually on site.",
        )}
      </Text>
      <InputField
        label={t("visit_date", "Visit Date")}
        value={visitDate}
        onChangeText={setVisitDate}
        placeholder="YYYY-MM-DD"
        style={errors.visitDate ? styles.inputError : undefined}
      />
      {errors.visitDate && <Text style={styles.errorText}>{errors.visitDate}</Text>}
      <InputField
        label={t("visit_time", "Visit Time")}
        value={visitTime}
        onChangeText={setVisitTime}
        placeholder="HH:mm"
        style={errors.visitTime ? styles.inputError : undefined}
      />
      {errors.visitTime && <Text style={styles.errorText}>{errors.visitTime}</Text>}
    </FormSection>
  );

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
          onAddPhoto={(p) => addPhotoPersisted(setGuardPhotos, p)}
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

  const renderMeasurementSection = () => (
    <FormSection
      title={t("measurement_information", "Measurement Information")}
      icon="analytics-outline"
    >
      {/* ── Dip Stick Measurements — COMPULSORY ─────────────────────────── */}
      <View style={styles.requiredBanner}>
        <Ionicons name="alert-circle" size={14} color={Colors.danger} />
        <Text style={styles.requiredBannerText}>
          {t("dip_stick_required_note", "Dip Stick measurements are compulsory — they are the primary tank-level record for this visit.")}
        </Text>
      </View>

      <InputField
        label={t("dip_stick_before", "Dip Stick Measurement Before (cm) *")}
        value={dipStickBefore}
        onChangeText={setDipStickBefore}
        keyboardType="numeric"
        required
        placeholder={t("dip_stick_before_placeholder", "e.g. 45 — measured before adding fuel")}
        style={errors.dipStickBefore ? styles.inputError : undefined}
        error={errors.dipStickBefore}
      />
      {errors.dipStickBefore && (
        <Text style={styles.errorText}>{errors.dipStickBefore}</Text>
      )}

      <InputField
        label={t("dip_stick_after", "Dip Stick Measurement After (cm) *")}
        value={dipStickAfter}
        onChangeText={setDipStickAfter}
        keyboardType="numeric"
        required
        placeholder={t("dip_stick_after_placeholder", "e.g. 87 — measured after adding fuel")}
        style={errors.dipStickAfter ? styles.inputError : undefined}
        error={errors.dipStickAfter}
      />
      {errors.dipStickAfter && (
        <Text style={styles.errorText}>{errors.dipStickAfter}</Text>
      )}

      {/* Auto-calculated dip stick delta */}
      {dipStickBefore && dipStickAfter && !isNaN(Number(dipStickBefore)) && !isNaN(Number(dipStickAfter)) && (
        <View style={[styles.calcBox, styles.successBox]}>
          <Ionicons name="trending-up" size={18} color={Colors.success} />
          <Text style={styles.calcLabel}>
            {t("dip_stick_delta", "Dip Stick Rise")}
          </Text>
          <Text style={[styles.calcValue, { color: Colors.success }]}>
            +{(Number(dipStickAfter) - Number(dipStickBefore)).toFixed(1)} cm
          </Text>
        </View>
      )}

      {/* ── Tank Dimensions — collected every visit, same as dip stick ─────── */}
      <View style={styles.requiredBanner}>
        <Ionicons name="alert-circle" size={14} color={Colors.danger} />
        <Text style={styles.requiredBannerText}>
          {t("tank_dimensions_required_note", "Tank dimensions are compulsory — length, height, and width, measured in centimeters.")}
        </Text>
      </View>

      <InputField
        label={t("tank_length", "Tank Length (cm) *")}
        value={tankLengthInput}
        onChangeText={setTankLengthInput}
        keyboardType="numeric"
        required
        placeholder={t("tank_length_placeholder", "e.g. 200")}
        style={errors.tankLengthInput ? styles.inputError : undefined}
        error={errors.tankLengthInput}
      />
      {errors.tankLengthInput && (
        <Text style={styles.errorText}>{errors.tankLengthInput}</Text>
      )}

      <InputField
        label={t("tank_height", "Tank Height (cm) *")}
        value={tankHeightInput}
        onChangeText={setTankHeightInput}
        keyboardType="numeric"
        required
        placeholder={t("tank_height_placeholder", "e.g. 120")}
        style={errors.tankHeightInput ? styles.inputError : undefined}
        error={errors.tankHeightInput}
      />
      {errors.tankHeightInput && (
        <Text style={styles.errorText}>{errors.tankHeightInput}</Text>
      )}

      <InputField
        label={t("tank_width", "Tank Width (cm) *")}
        value={tankWidthInput}
        onChangeText={setTankWidthInput}
        keyboardType="numeric"
        required
        placeholder={t("tank_width_placeholder", "e.g. 150")}
        style={errors.tankWidthInput ? styles.inputError : undefined}
        error={errors.tankWidthInput}
      />
      {errors.tankWidthInput && (
        <Text style={styles.errorText}>{errors.tankWidthInput}</Text>
      )}

      {/* ── Truck Plate ────────────────────────────────────────────────────── */}
      <InputField
        label={t("truck_plate_number", "Truck Plate Number")}
        value={truckPlateNumber}
        onChangeText={setTruckPlateNumber}
        placeholder={t("truck_plate_placeholder", "e.g. LT 1234 AB")}
      />

      {/* ── Truck Flow Meter — COMMENTED (duplicates Diesel Information) ───── */}
      {/*
        Truck Flow Meter Before (L) and Truck Flow Meter After (L) have been
        removed from this form. The same data is already captured in the
        "Diesel Information" section (Fuel Found / Fuel Added). Dip Stick
        measurements above are the authoritative physical tank-level record.
      */}

      <PhotoCapture
        label={t("measurement_photos", "Measurement Photos (Optional)")}
        photos={measurementPhotos}
        onAddPhoto={(p) => addPhotoPersisted(setMeasurementPhotos, p)}
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
        onAddPhoto={(p) => addPhotoPersisted(setPhotos, p)}
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

  const renderDeliveryStatus = () => {
    const approvedL = parseFloat(String(params.approvedLiters || "")) || null;
    const addedNum   = parseFloat(fuelAdded) || 0;
    const showPrompt = approvedL != null && addedNum > 0 && addedNum < approvedL;

    return (
      <FormSection
        title={t("delivery_status", "Delivery Status")}
        icon="checkmark-done-outline"
      >
        {showPrompt && (
          <View style={styles.deliveryWarningBox}>
            <Text style={styles.deliveryWarningText}>
              {t(
                "delivery_shortfall_warning",
                `You've entered ${addedNum}L, but ${approvedL}L was approved for this site — ${(approvedL - addedNum).toFixed(1)}L short.`
              )}
            </Text>
          </View>
        )}
        <Text style={styles.deliveryQuestion}>
          {t("delivery_status_question", "Is this delivery complete?")}
        </Text>
        <View style={styles.deliveryOptionsRow}>
          <TouchableOpacity
            style={[styles.deliveryOption, deliveryComplete && styles.deliveryOptionActiveComplete]}
            onPress={() => setDeliveryComplete(true)}
            accessibilityRole="button"
            accessibilityState={{ selected: deliveryComplete }}
          >
            <Ionicons name="checkmark-circle" size={18} color={deliveryComplete ? "#fff" : "#16A34A"} />
            <Text style={[styles.deliveryOptionText, deliveryComplete && styles.deliveryOptionTextActive]}>
              {t("delivery_complete_yes", "Yes — tank is full / delivery complete")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deliveryOption, !deliveryComplete && styles.deliveryOptionActivePartial]}
            onPress={() => setDeliveryComplete(false)}
            accessibilityRole="button"
            accessibilityState={{ selected: !deliveryComplete }}
          >
            <Ionicons name="time" size={18} color={!deliveryComplete ? "#fff" : "#D97706"} />
            <Text style={[styles.deliveryOptionText, !deliveryComplete && styles.deliveryOptionTextActive]}>
              {t("delivery_complete_no", "No — I'll return to add the rest")}
            </Text>
          </TouchableOpacity>
        </View>
        {!deliveryComplete && (
          <Text style={styles.deliveryPartialNote}>
            {t(
              "delivery_partial_note",
              "This request will stay open and visible on your dashboard until the remaining fuel is delivered. The unused approved litres stay reserved for this site — they won't be released to other requests."
            )}
          </Text>
        )}
      </FormSection>
    );
  };

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
        onPress={handleSaveDraft}
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

  if (params.siteId && activeVisit && activeVisit.site_id === params.siteId) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderTankCard()}
          {renderVisitDateTime()}
          {renderGuardSection(true)}
          {renderMeasurementSection()}
          {renderMeterReadings()}
          {renderDieselInfo()}
          {renderDocumentationPhotos()}
          {renderDeliveryStatus()}
          {renderComments()}
        </ScrollView>
        {renderFooter()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderTankCard()}
        {renderVisitDateTime()}
        {renderGuardSection(false)}
        {renderMeasurementSection()}
        {renderMeterReadings()}
        {renderDieselInfo()}
        {renderDocumentationPhotos()}
        {renderTankObservations()}
        {renderDeliveryStatus()}
        {renderComments()}
      </ScrollView>
      {renderFooter()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  deliveryWarningBox: {
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A",
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  deliveryWarningText: { fontSize: 13, color: "#92400E", lineHeight: 18 },
  deliveryQuestion: { fontSize: 14, fontWeight: "600", color: Colors.text, marginBottom: 10 },
  deliveryOptionsRow: { gap: 10 },
  deliveryOption: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#fff",
  },
  deliveryOptionActiveComplete: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  deliveryOptionActivePartial:  { backgroundColor: "#D97706", borderColor: "#D97706" },
  deliveryOptionText: { fontSize: 13, fontWeight: "600", color: Colors.text, flex: 1 },
  deliveryOptionTextActive: { color: "#fff" },
  deliveryPartialNote: {
    fontSize: 12, color: "#6B7280", marginTop: 10, lineHeight: 17, fontStyle: "italic",
  },
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
  editTankBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editTankBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
  tankEditSection: { marginTop: 4, marginBottom: 4, gap: 4 },
  sectionLabelDark: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    marginBottom: 8,
  },
  correctionNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  correctionNoticeText: { color: "#FEF3C7", fontSize: 11, flex: 1 },
  helperNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },

  collapsibleToggle: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
  },

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

  totalBox: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  totalLabel: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginBottom: 2 },
  totalValue: { color: "white", fontSize: 24, fontWeight: "700" },

  row: { flexDirection: "row" },

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

  // ── Dip stick required banner ────────────────────────────────────────────
  requiredBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF5F5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  requiredBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.danger,
    lineHeight: 17,
  },
});









