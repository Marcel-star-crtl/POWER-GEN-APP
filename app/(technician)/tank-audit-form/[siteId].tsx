import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DateField } from "../../../components/ui/DateField";
import { PhotoAttachment, PhotoCapture } from "../../../components/ui/PhotoCapture";
import { Colors } from "../../../constants/Colors";
import { api, siteAPI } from "../../../services/api";
import { submitOrQueue, generateClientId } from "../../../services/offlineApi";
import { buildInitialTankAuditForm, emptyCheckItem, TANK_AUDIT_CHECK_AREAS } from "../../../types/tank-audit.types";
import type { CheckItem, CheckStatus, Severity, TankAuditForm } from "../../../types/tank-audit.types";

// ─────────────────────────────────────────────
// Reusable field components — same visual language as audit-form
// ─────────────────────────────────────────────
const TextField = ({
  label,
  value,
  onChange,
  keyboardType = "default",
  editable = true,
  multiline = false,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
  multiline?: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, !editable && styles.inputReadOnly, multiline && styles.textArea]}
      value={value ?? ""}
      onChangeText={onChange}
      keyboardType={keyboardType}
      placeholder="Enter value"
      placeholderTextColor={Colors.textSecondary}
      editable={editable}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? "top" : "center"}
    />
  </View>
);

const YesNoField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (val: boolean) => void;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.toggleRow}>
      <TouchableOpacity style={[styles.toggleButton, value === true && styles.toggleActive]} onPress={() => onChange(true)}>
        <Text style={[styles.toggleText, value === true && styles.toggleTextActive]}>Yes</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.toggleButton, value === false && styles.toggleActiveDanger]} onPress={() => onChange(false)}>
        <Text style={[styles.toggleText, value === false && styles.toggleTextActive]}>No</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// Three-way status control — OK / Issue / N/A, matching the plan's own
// "Status (OK / Issue / N/A)" column exactly, not a simplified two-way toggle.
const StatusField = ({
  value,
  onChange,
}: {
  value: CheckStatus | null;
  onChange: (val: CheckStatus) => void;
}) => (
  <View style={styles.statusRow}>
    <TouchableOpacity style={[styles.statusButton, value === "ok" && styles.statusOk]} onPress={() => onChange("ok")}>
      <Text style={[styles.statusText, value === "ok" && styles.statusTextActive]}>OK</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.statusButton, value === "issue" && styles.statusIssue]} onPress={() => onChange("issue")}>
      <Text style={[styles.statusText, value === "issue" && styles.statusTextActive]}>Issue</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.statusButton, value === "na" && styles.statusNa]} onPress={() => onChange("na")}>
      <Text style={[styles.statusText, value === "na" && styles.statusTextActive]}>N/A</Text>
    </TouchableOpacity>
  </View>
);

// Severity picker — only shown once a check is marked "issue", per the
// plan's own FINDINGS CLASSIFICATION (Critical / Major / Minor).
const SeverityField = ({
  value,
  onChange,
}: {
  value: Severity | null;
  onChange: (val: Severity) => void;
}) => (
  <View style={styles.severityRow}>
    <TouchableOpacity style={[styles.severityButton, value === "critical" && styles.severityCritical]} onPress={() => onChange("critical")}>
      <Text style={[styles.severityText, value === "critical" && styles.severityTextActive]}>Critical</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.severityButton, value === "major" && styles.severityMajor]} onPress={() => onChange("major")}>
      <Text style={[styles.severityText, value === "major" && styles.severityTextActive]}>Major</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.severityButton, value === "minor" && styles.severityMinor]} onPress={() => onChange("minor")}>
      <Text style={[styles.severityText, value === "minor" && styles.severityTextActive]}>Minor</Text>
    </TouchableOpacity>
  </View>
);

interface SiteDetails {
  Site_Name?: string;
  IHS_ID_SITE?: string;
  Region?: string;
  Sites_Power_Topology?: string;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function TankAuditFormScreen() {
  const { siteId, siteName: siteNameParam } = useLocalSearchParams<{ siteId: string; siteName?: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [siteDetails, setSiteDetails] = useState<SiteDetails | null>(null);
  const [form, setForm] = useState<TankAuditForm>(() => buildInitialTankAuditForm(siteId || ""));
  const [sectionPhotos, setSectionPhotos] = useState<Record<string, PhotoAttachment[]>>({});
  // Log file attachments from on-site equipment, keyed by equipment
  // type (power_cabinet / generator / other) — same photo-capture
  // mechanism as check-area evidence, since a photo of the display or
  // printout is the practical way to "submit" an equipment log here.
  const [logFiles, setLogFiles] = useState<Record<string, PhotoAttachment[]>>({});

  const draftKey = useMemo(() => `tank_audit_draft_${siteId}`, [siteId]);

  const checkLabels: Record<string, string> = useMemo(
    () => ({
      check_tank_capacity_verification: t("tank_capacity_verification", "Tank Capacity Verification"),
      check_fuel_level: t("fuel_level_check", "Fuel Level (Dip vs. CMS vs. Theoretical)"),
      check_structural_condition: t("structural_condition", "Structural Condition"),
      check_leakage: t("leakage_checks", "Leakage Checks"),
      check_caps_locking_security: t("caps_locking_security", "Caps, Locking and Security"),
      check_pipe_passage_earthing: t("pipe_passage_earthing", "Pipe Passage / Earthing"),
      check_sensor_hardware: t("sensor_hardware", "Sensor Hardware"),
      check_gen_cards_faulty: t("gen_cards_faulty", "Gen Cards Faulty"),
      general: t("general", "General"),
    }),
    [t],
  );

  const checkDescriptions: Record<string, string> = useMemo(
    () => ({
      check_tank_capacity_verification: t("tank_capacity_verification_desc", "Matched physical dimension to declared capacity"),
      check_fuel_level: t("fuel_level_check_desc", "Manual dip reading vs. CMS vs. theoretical stock level"),
      check_structural_condition: t("structural_condition_desc", "Rust, cracks, weld integrity, base/stand stability"),
      check_leakage: t("leakage_checks_desc", "Visual inspection of tank body, fittings, valves"),
      check_caps_locking_security: t("caps_locking_security_desc", "Filler cap security and lockability, padlock condition, anti-siphon device present"),
      check_pipe_passage_earthing: t("pipe_passage_earthing_desc", "Tank and pipework properly earthed"),
      check_sensor_hardware: t("sensor_hardware_desc", "Fuel sensor wiring intact, sensor calibrated, no tampering"),
      check_gen_cards_faulty: t("gen_cards_faulty_desc", "Check for generators with faulty gen cards — to be replaced with a mechanical counter meter"),
    }),
    [t],
  );

  const getCurrentUserId = useCallback(async (): Promise<string | undefined> => {
    try {
      const userStr = await AsyncStorage.getItem("user");
      if (!userStr) return undefined;
      const user = JSON.parse(userStr);
      return user?.id || user?._id;
    } catch {
      return undefined;
    }
  }, []);

  const updateField = useCallback((key: keyof TankAuditForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateCheck = useCallback((key: keyof TankAuditForm, patch: Partial<CheckItem>) => {
    setForm((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as CheckItem), ...patch },
    }));
  }, []);

  const addSectionPhoto = useCallback((sectionKey: string, photo: PhotoAttachment) => {
    setSectionPhotos((prev) => ({ ...prev, [sectionKey]: [...(prev[sectionKey] || []), photo] }));
  }, []);

  const removeSectionPhoto = useCallback((sectionKey: string, uri: string) => {
    setSectionPhotos((prev) => ({ ...prev, [sectionKey]: (prev[sectionKey] || []).filter((p) => p.uri !== uri) }));
  }, []);

  const renderSectionPhotos = useCallback(
    (sectionKey: string) => (
      <PhotoCapture
        label={`Photos — ${checkLabels[sectionKey] || sectionKey}`}
        photos={sectionPhotos[sectionKey] || []}
        onAddPhoto={(photo) => addSectionPhoto(sectionKey, photo)}
        onRemovePhoto={(uri) => removeSectionPhoto(sectionKey, uri)}
      />
    ),
    [addSectionPhoto, removeSectionPhoto, checkLabels, sectionPhotos],
  );

  const addLogFile = useCallback((equipment: string, photo: PhotoAttachment) => {
    setLogFiles((prev) => ({ ...prev, [equipment]: [...(prev[equipment] || []), photo] }));
  }, []);

  const removeLogFile = useCallback((equipment: string, uri: string) => {
    setLogFiles((prev) => ({ ...prev, [equipment]: (prev[equipment] || []).filter((p) => p.uri !== uri) }));
  }, []);

  const renderLogFiles = useCallback(
    (equipment: string, label: string) => (
      <PhotoCapture
        label={label}
        photos={logFiles[equipment] || []}
        onAddPhoto={(photo) => addLogFile(equipment, photo)}
        onRemovePhoto={(uri) => removeLogFile(equipment, uri)}
      />
    ),
    [addLogFile, removeLogFile, logFiles],
  );

  // ── Load site details + any saved draft ─────────────────
  // Converts a server TankAudit document back into this screen's form
  // state + sectionPhotos + logFiles — the inverse of buildPayload.
  // Needed so a draft saved earlier (on this device or, importantly,
  // any other device) can always be resumed, not just one still sitting
  // in this device's local storage.
  // Resolves the existing audit record's id for this site, if one
  // exists — local storage first (fast, works offline), then a server
  // query as a fallback. Used by both saveDraft and submitAudit so
  // neither one can accidentally create a duplicate record just
  // because the local auditId was lost (app data cleared, a different
  // device, or the original local write itself failed) while a real
  // record still exists on the server.
  const resolveExistingAuditId = useCallback(async (): Promise<string | undefined> => {
    try {
      const existingDraft = await AsyncStorage.getItem(draftKey);
      if (existingDraft) {
        const parsed = JSON.parse(existingDraft);
        if (parsed.auditId) return parsed.auditId;
      }
    } catch {
      // corrupt local entry — fall through to the server check below
    }

    // No usable local id — check the server before assuming there's
    // nothing to update. Best-effort: any failure here (offline, auth,
    // etc.) just means we fall back to creating a new record, exactly
    // like before this fallback existed.
    try {
      const currentUserId = await getCurrentUserId();
      if (currentUserId && siteId) {
        const res = await api.get("/technician/tank-audits", {
          params: { siteId, createdBy: currentUserId, limit: 5 },
        });
        const results: any[] = res.data?.data || [];
        const existing = results.find((r) => r.status === "draft") || results[0];
        if (existing?._id) return existing._id;
      }
    } catch {
      // offline or the lookup failed — no id to resolve this time
    }

    return undefined;
  }, [draftKey, getCurrentUserId, siteId]);

  const hydrateFromServerAudit = useCallback((audit: any) => {
    const hydratedForm: TankAuditForm = {
      site_id_ihs: audit.site_id_ihs || siteId || "",
      site_name: audit.site_name || "",
      region: audit.region || "",
      cluster: audit.cluster || "",
      site_priority: audit.site_priority || "",
      tank_capacity_l: audit.tank_capacity_l != null ? String(audit.tank_capacity_l) : "",
      tank_length_m: audit.tank_length_m != null ? String(audit.tank_length_m) : "",
      tank_width_m: audit.tank_width_m != null ? String(audit.tank_width_m) : "",
      tank_height_m: audit.tank_height_m != null ? String(audit.tank_height_m) : "",
      tank_base_type: audit.tank_base_type || "",
      functional_topology: audit.functional_topology || "",
      audit_date: audit.audit_date ? String(audit.audit_date).slice(0, 10) : "",
      auditor_name: audit.auditor_name || "",
      dip_reading_l: audit.dip_reading_l != null ? String(audit.dip_reading_l) : "",
      cms_reading_l: audit.cms_reading_l != null ? String(audit.cms_reading_l) : "",
      theoretical_stock_l: audit.theoretical_stock_l != null ? String(audit.theoretical_stock_l) : "",
      check_tank_capacity_verification: audit.check_tank_capacity_verification || emptyCheckItem(),
      check_fuel_level: audit.check_fuel_level || emptyCheckItem(),
      check_structural_condition: audit.check_structural_condition || emptyCheckItem(),
      check_leakage: audit.check_leakage || emptyCheckItem(),
      check_caps_locking_security: audit.check_caps_locking_security || emptyCheckItem(),
      check_pipe_passage_earthing: audit.check_pipe_passage_earthing || emptyCheckItem(),
      check_sensor_hardware: audit.check_sensor_hardware || emptyCheckItem(),
      check_gen_cards_faulty: audit.check_gen_cards_faulty || emptyCheckItem(),
      logs_collected: audit.logs_collected ?? null,
      gen_card_faulty: audit.gen_card_faulty ?? null,
      general_notes: audit.general_notes || "",
    };

    const hydratedSectionPhotos: Record<string, PhotoAttachment[]> = {};
    for (const area of TANK_AUDIT_CHECK_AREAS) {
      const key = area.key as string;
      const photos = audit[key]?.photos || [];
      if (photos.length) hydratedSectionPhotos[key] = photos.map((p: any) => ({ uri: p.uri, name: p.name, type: p.type }));
    }
    if (audit.general_photos?.length) {
      hydratedSectionPhotos.general = audit.general_photos.map((p: any) => ({ uri: p.uri, name: p.name, type: p.type }));
    }

    const hydratedLogFiles: Record<string, PhotoAttachment[]> = {};
    for (const f of audit.log_files || []) {
      const eq = f.equipment || "other";
      hydratedLogFiles[eq] = [...(hydratedLogFiles[eq] || []), { uri: f.uri, name: f.name, type: f.type }];
    }

    return { hydratedForm, hydratedSectionPhotos, hydratedLogFiles };
  }, [siteId]);

  const loadSiteAndDraft = useCallback(async () => {
    try {
      const [siteDetailRes, draftStr] = await Promise.all([
        siteAPI.getSiteWithGenerators(siteId || "").catch(() => null),
        AsyncStorage.getItem(draftKey),
      ]);

      if (siteDetailRes) {
        const details: SiteDetails = siteDetailRes.data?.data || siteDetailRes.data || null;
        setSiteDetails(details);
      }

      if (draftStr) {
        // Fast path — a draft already exists on this device.
        const draft = JSON.parse(draftStr);
        setForm(draft.payload || buildInitialTankAuditForm(siteId || ""));
        setSectionPhotos(draft.sectionPhotos || {});
        setLogFiles(draft.logFiles || {});
        return;
      }

      // No local draft — check the server before assuming there's
      // nothing to resume. Covers: app data cleared, a different
      // device, or a draft saved in an earlier session that never
      // wrote a local copy (e.g. the local write itself failed).
      try {
        const currentUserId = await getCurrentUserId();
        if (currentUserId && siteId) {
          const res = await api.get("/technician/tank-audits", {
            params: { siteId, createdBy: currentUserId, limit: 5 },
          });
          // Prefer a draft if one exists; otherwise fall back to the
          // most recent audit for this site (still useful as a
          // starting point even if already submitted).
          const results: any[] = res.data?.data || [];
          const existing = results.find((r) => r.status === "draft") || results[0];
          if (existing) {
            const { hydratedForm, hydratedSectionPhotos, hydratedLogFiles } = hydrateFromServerAudit(existing);
            setForm(hydratedForm);
            setSectionPhotos(hydratedSectionPhotos);
            setLogFiles(hydratedLogFiles);
            // Mirror it locally so the next load (and offline access)
            // is fast, and so saveDraft/submitAudit find the right
            // auditId without needing their own server round-trip.
            await AsyncStorage.setItem(
              draftKey,
              JSON.stringify({
                siteId, updatedAt: new Date().toISOString(), payload: hydratedForm,
                sectionPhotos: hydratedSectionPhotos, logFiles: hydratedLogFiles,
                auditId: existing._id, createdBy: currentUserId,
              }),
            );
            return;
          }
        }
      } catch {
        // Offline, or the lookup failed — fall through to a blank form.
        // This is a best-effort convenience, not a hard requirement to
        // start a new audit.
      }

      // Genuinely nothing to resume — a fresh form for this site, not a
      // patch on top of whatever was previously in state. Spreading
      // `prev` here was the actual bug: if Expo Router reuses this
      // component instance when navigating between different sites on
      // this same dynamic route (a real, observed behavior, not
      // hypothetical), `prev` could be the previous site's full form —
      // check statuses, notes, readings, all of it — with only
      // site_name overwritten.
      setForm({ ...buildInitialTankAuditForm(siteId || ""), site_name: siteNameParam || "" });
    } catch (error) {
      console.error("Failed to load site or draft:", error);
    } finally {
      setLoading(false);
    }
  }, [draftKey, getCurrentUserId, hydrateFromServerAudit, siteId, siteNameParam]);

  useEffect(() => {
    if (!siteId) {
      router.replace("/(technician)/dashboard");
      return;
    }
    // Reset immediately, before the async load even starts — otherwise
    // whatever was in state from a previously-viewed site (if this
    // component instance is reused rather than remounted for the new
    // siteId, which Expo Router does for same-pattern dynamic routes)
    // stays visible on screen for the entire loading window, not just
    // until loadSiteAndDraft's own setForm calls resolve.
    setLoading(true);
    setForm(buildInitialTankAuditForm(siteId));
    setSectionPhotos({});
    setLogFiles({});
    setSiteDetails(null);
    loadSiteAndDraft();
  }, [loadSiteAndDraft, router, siteId]);

  useEffect(() => {
    if (siteDetails && !form.region) {
      setForm((prev) => ({
        ...prev,
        site_name: prev.site_name || siteDetails.Site_Name || "",
        region: siteDetails.Region || "",
        functional_topology: siteDetails.Sites_Power_Topology || "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteDetails]);

  const buildSectionedPhotos = useCallback(() => {
    return Object.entries(sectionPhotos).flatMap(([section, items]) =>
      items.map((photo) => ({ ...photo, __section: section })),
    );
  }, [sectionPhotos]);

  // ── Build the API payload ─────────────────────────────────
  const buildPayload = useCallback(
    (status: "draft" | "submitted") => {
      const sectionedPhotos = buildSectionedPhotos();
      const rawPhotos = sectionedPhotos.map((p) => ({
        uri: p.uri,
        category: p.__section || "general",
        description: checkLabels[p.__section as string] || (p.__section as string) || "",
      }));

      // Attach each section's photos onto its own check object, and
      // route "general" photos separately — matches how the backend
      // model stores photos per check item plus a top-level general_photos.
      const checksWithPhotos: Record<string, CheckItem & { photos: any[] }> = {};
      for (const area of TANK_AUDIT_CHECK_AREAS) {
        const key = area.key as string;
        checksWithPhotos[key] = {
          ...(form[area.key as keyof TankAuditForm] as CheckItem),
          photos: rawPhotos.filter((p) => p.category === key),
        };
      }
      const generalPhotos = rawPhotos.filter((p) => p.category === "general");
      const flattenedLogFiles = Object.entries(logFiles).flatMap(([equipment, items]) =>
        items.map((f) => ({ uri: f.uri, equipment })),
      );

      return {
        site_id_ihs: siteId,
        site_name: form.site_name,
        region: form.region,
        cluster: form.cluster,
        site_priority: form.site_priority,
        tank_capacity_l: form.tank_capacity_l ? Number(form.tank_capacity_l) : null,
        tank_length_m: form.tank_length_m ? Number(form.tank_length_m) : null,
        tank_width_m: form.tank_width_m ? Number(form.tank_width_m) : null,
        tank_height_m: form.tank_height_m ? Number(form.tank_height_m) : null,
        tank_base_type: form.tank_base_type,
        functional_topology: form.functional_topology,
        audit_date: form.audit_date,
        auditor_name: form.auditor_name,
        dip_reading_l: form.dip_reading_l ? Number(form.dip_reading_l) : null,
        cms_reading_l: form.cms_reading_l ? Number(form.cms_reading_l) : null,
        theoretical_stock_l: form.theoretical_stock_l ? Number(form.theoretical_stock_l) : null,
        ...checksWithPhotos,
        logs_collected: form.logs_collected,
        gen_card_faulty: form.gen_card_faulty,
        log_files: flattenedLogFiles,
        general_notes: form.general_notes,
        general_photos: generalPhotos,
        status,
      };
    },
    [buildSectionedPhotos, checkLabels, form, logFiles, siteId],
  );

  // ── Save draft ────────────────────────────────
  const saveDraft = useCallback(async () => {
    const currentUserId = await getCurrentUserId();
    let auditId: string | undefined = await resolveExistingAuditId();

    try {
      const payload = buildPayload("draft");
      let result;
      if (auditId) {
        try {
          result = await submitOrQueue("tank_audit_draft", `/technician/tank-audits/${auditId}`, "PUT", payload);
          if (result.data?._id) auditId = result.data._id;
        } catch (updateErr: any) {
          const status = updateErr?.response?.status;
          if (status === 403 || status === 404) {
            const createClientId = generateClientId();
            result = await submitOrQueue("tank_audit_draft", "/technician/tank-audit", "POST", { ...payload, client_id: createClientId });
            if (result.data?._id) auditId = result.data._id;
          } else {
            throw updateErr;
          }
        }
      } else {
        const createClientId = generateClientId();
        result = await submitOrQueue("tank_audit_draft", "/technician/tank-audit", "POST", { ...payload, client_id: createClientId });
        if (result.data?._id) auditId = result.data._id;
      }

      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({ siteId, updatedAt: new Date().toISOString(), payload: form, sectionPhotos, logFiles, auditId, createdBy: currentUserId }),
      );

      Alert.alert(
        t("draft_saved", "Draft Saved"),
        result?.queued
          ? t("draft_saved_offline", "No connection — draft saved locally and will sync automatically.")
          : t("draft_saved_synced", "Draft saved and synced to server."),
      );
    } catch (error) {
      console.warn("Draft server save failed, saving locally only:", error);
      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({ siteId, updatedAt: new Date().toISOString(), payload: form, sectionPhotos, logFiles, auditId, createdBy: currentUserId }),
      );
      Alert.alert(t("draft_saved", "Draft Saved"), t("saved_locally", "Saved locally."));
    }
  }, [buildPayload, draftKey, form, getCurrentUserId, resolveExistingAuditId, sectionPhotos, logFiles, siteId, t]);

  // ── Submit ────────────────────────────────────
  const submitAudit = useCallback(async () => {
    if (form.logs_collected === null) {
      Alert.alert(t("missing_field", "Missing Field"), t("please_specify_logs_collected", "Please specify whether generator logs were collected on this visit."));
      return;
    }

    setSubmitting(true);
    try {
      const auditId: string | undefined = await resolveExistingAuditId();

      const payload = buildPayload("submitted");
      let result;
      if (auditId) {
        try {
          result = await submitOrQueue("tank_audit_submit", `/technician/tank-audits/${auditId}`, "PUT", payload);
        } catch (updateError: any) {
          const status = updateError?.response?.status;
          if (status === 403 || status === 404) {
            const createClientId = generateClientId();
            result = await submitOrQueue("tank_audit_submit", "/technician/tank-audit", "POST", { ...payload, client_id: createClientId });
          } else {
            throw updateError;
          }
        }
      } else {
        const createClientId = generateClientId();
        result = await submitOrQueue("tank_audit_submit", "/technician/tank-audit", "POST", { ...payload, client_id: createClientId });
      }

      await AsyncStorage.removeItem(draftKey);

      Alert.alert(
        t("audit_submitted", "Tank Audit Submitted"),
        result?.queued
          ? t("submitted_offline", "No connection — saved locally and will sync automatically when you're back online.")
          : t("submitted_synced", "Tank audit submitted successfully."),
        [{ text: "OK", onPress: () => router.replace("/(technician)/dashboard") }],
      );
    } catch (error: any) {
      console.error("Submit tank audit failed:", error);
      Alert.alert(t("submit_failed", "Submit Failed"), error?.response?.data?.error || t("something_went_wrong", "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }, [buildPayload, draftKey, form.logs_collected, resolveExistingAuditId, router, t]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t("loading", "Loading...")}</Text>
      </View>
    );
  }

  // Reusable renderer for one of the seven check areas
  const renderCheckArea = (key: keyof TankAuditForm, label: string, description: string) => {
    const item = form[key] as CheckItem;
    return (
      <View style={styles.checkAreaBlock} key={key as string}>
        <Text style={styles.checkAreaTitle}>{label}</Text>
        <Text style={styles.checkAreaDesc}>{description}</Text>
        <StatusField value={item.status} onChange={(v) => updateCheck(key, { status: v })} />
        {item.status === "issue" && (
          <>
            <Text style={styles.subLabel}>{t("severity", "Severity")}</Text>
            <SeverityField value={item.severity} onChange={(v) => updateCheck(key, { severity: v })} />
          </>
        )}
        <TextField
          label={t("notes_comments", "Notes / Comments")}
          value={item.notes}
          onChange={(v) => updateCheck(key, { notes: v })}
          multiline
        />
        {renderSectionPhotos(key as string)}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("site_tank_audit", "Site Tank Audit")}</Text>
        <Text style={styles.subtitle}>{form.site_name || siteId} · {siteId}</Text>

        {/* ══════════════ SITE INFORMATION ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("site_information", "Site Information")}</Text>
          <TextField label={t("site_name", "Site Name")} value={form.site_name} onChange={(v) => updateField("site_name", v)} />
          <TextField label={t("region_cluster", "Region / Cluster")} value={form.region} onChange={(v) => updateField("region", v)} />
          <TextField label={t("cluster", "Cluster")} value={form.cluster} onChange={(v) => updateField("cluster", v)} />
          <TextField label={t("site_priority", "Site Priority (P1-P5 / TIS)")} value={form.site_priority} onChange={(v) => updateField("site_priority", v)} />
          <TextField label={t("tank_capacity_l", "Tank Capacity (Litres)")} value={form.tank_capacity_l} onChange={(v) => updateField("tank_capacity_l", v)} keyboardType="numeric" />
          <TextField label={t("tank_length_m", "Tank Length (m)")} value={form.tank_length_m} onChange={(v) => updateField("tank_length_m", v)} keyboardType="numeric" />
          <TextField label={t("tank_width_m", "Tank Width (m)")} value={form.tank_width_m} onChange={(v) => updateField("tank_width_m", v)} keyboardType="numeric" />
          <TextField label={t("tank_height_m", "Tank Height (m)")} value={form.tank_height_m} onChange={(v) => updateField("tank_height_m", v)} keyboardType="numeric" />
          <TextField label={t("tank_base_type", "Tank Base")} value={form.tank_base_type} onChange={(v) => updateField("tank_base_type", v)} />
          <TextField label={t("functional_topology", "Functional Topology")} value={form.functional_topology} onChange={(v) => updateField("functional_topology", v)} />
          <DateField label={t("audit_date", "Audit Date")} value={form.audit_date} onChange={(v) => updateField("audit_date", v)} />
          <TextField label={t("auditor_name", "Auditor Name")} value={form.auditor_name} onChange={(v) => updateField("auditor_name", v)} />
        </View>

        {/* ══════════════ FUEL LEVEL CROSS-CHECK ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("fuel_level_cross_check", "Fuel Level Cross-Check")}</Text>
          <Text style={styles.checkAreaDesc}>{t("fuel_level_cross_check_desc", "Physical dipstick vs. CMS reading vs. theoretical stock — the plan's central objective.")}</Text>
          <TextField label={t("dip_reading_l", "Manual Dip Reading (L)")} value={form.dip_reading_l} onChange={(v) => updateField("dip_reading_l", v)} keyboardType="numeric" />
          <TextField label={t("cms_reading_l", "CMS Reading (L)")} value={form.cms_reading_l} onChange={(v) => updateField("cms_reading_l", v)} keyboardType="numeric" />
          <TextField label={t("theoretical_stock_l", "Theoretical Stock Level (L)")} value={form.theoretical_stock_l} onChange={(v) => updateField("theoretical_stock_l", v)} keyboardType="numeric" />
        </View>

        {/* ══════════════ ON-SITE PHYSICAL CHECKS ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("on_site_physical_checks", "On-Site Physical Checks")}</Text>
          {TANK_AUDIT_CHECK_AREAS.map((area) =>
            renderCheckArea(area.key, checkLabels[area.key as string], checkDescriptions[area.key as string]),
          )}
        </View>

        {/* ══════════════ QUICK SUMMARY QUESTIONS ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("quick_summary_questions", "Quick Summary Questions")}</Text>
          <YesNoField
            label={t("logs_collected_question", "Were generator run-hour / consumption logs collected on this visit?")}
            value={form.logs_collected}
            onChange={(v) => updateField("logs_collected", v)}
          />
          <YesNoField
            label={t("gen_card_faulty_question", "Is the Gen Card faulty?")}
            value={form.gen_card_faulty}
            onChange={(v) => updateField("gen_card_faulty", v)}
          />
        </View>

        {/* ══════════════ EQUIPMENT LOG FILES ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("equipment_log_files", "Equipment Log Files")}</Text>
          <Text style={styles.checkAreaDesc}>
            {t("equipment_log_files_desc", "Attach the actual log evidence from on-site equipment — a photo of the display or printout works if the equipment has no direct file export.")}
          </Text>
          {renderLogFiles("power_cabinet", t("power_cabinet_logs", "Power Cabinet Logs"))}
          {renderLogFiles("generator", t("generator_logs", "Generator Logs"))}
        </View>

        {/* ══════════════ GENERAL NOTES & PHOTOS ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("general_photos_notes", "General Photos & Notes")}</Text>
          {renderSectionPhotos("general")}
          <TextField label={t("additional_notes", "Additional Notes")} value={form.general_notes} onChange={(v) => updateField("general_notes", v)} multiline />
        </View>

        {/* ══════════════ ACTIONS ══════════════ */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={saveDraft} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>{t("save_draft", "Save Draft")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={submitAudit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t("submit_audit", "Submit Audit")}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  title: { marginTop: 12, fontSize: 22, fontWeight: "700", color: Colors.text },
  subtitle: { marginTop: 4, marginBottom: 4, fontSize: 14, color: Colors.textSecondary },
  section: { marginTop: 20, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: Colors.text, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: Colors.text, marginBottom: 6 },
  subLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: Colors.text, backgroundColor: Colors.background },
  inputReadOnly: { backgroundColor: Colors.surface, color: Colors.textSecondary },
  textArea: { height: 80, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleActiveDanger: { backgroundColor: Colors.danger ?? "#EF4444", borderColor: Colors.danger ?? "#EF4444" },
  toggleText: { color: Colors.text, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  checkAreaBlock: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkAreaTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  checkAreaDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, marginBottom: 10 },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statusButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  statusOk: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  statusIssue: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  statusNa: { backgroundColor: "#6B7280", borderColor: "#6B7280" },
  statusText: { color: Colors.text, fontWeight: "600", fontSize: 13 },
  statusTextActive: { color: "#fff" },
  severityRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  severityButton: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  severityCritical: { backgroundColor: "#991B1B", borderColor: "#991B1B" },
  severityMajor: { backgroundColor: "#C2410C", borderColor: "#C2410C" },
  severityMinor: { backgroundColor: "#CA8A04", borderColor: "#CA8A04" },
  severityText: { color: Colors.text, fontWeight: "600", fontSize: 12 },
  severityTextActive: { color: "#fff" },
  actions: { marginTop: 20, marginBottom: 40, gap: 12 },
  primaryButton: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: { backgroundColor: Colors.surface, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  loadingText: { marginTop: 10, color: Colors.textSecondary },
});
