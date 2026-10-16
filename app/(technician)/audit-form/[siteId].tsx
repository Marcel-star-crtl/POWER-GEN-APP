import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from 'react-i18next';
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
import { FormSection } from "../../../components/ui/FormSection";
import {
  PhotoAttachment,
  PhotoCapture,
} from "../../../components/ui/PhotoCapture";
import { Colors } from "../../../constants/Colors";
import { siteAPI } from "../../../services/api";
import { submitOrQueue, generateClientId } from "../../../services/offlineApi";
import { useAutoSaveDraft } from "../../../hooks/useAutoSaveDraft";
import { TechnicianSiteAuditForm as TechnicianSiteAuditFormType } from "../../../types/technician-audit.types";

// ─────────────────────────────────────────────
// Local interfaces
// ─────────────────────────────────────────────
interface GeneratorInfo {
  model?: string;
  serial_number?: string;
  status?: string;
  specifications?: Record<string, any>;
  current_stats?: Record<string, any>;
}

interface SiteDetails {
  Site_Name?: string;
  IHS_ID_SITE?: string;
  Region?: string;
  Sites_Type?: string;
  Sites_Configuration_Outdoor_Indoor?: string;
  Sites_Power_Topology?: string;
  Technician_Name?: string;
  Technician_Contact?: string;
  SBC_Supervisor?: string;
  SBC_Supervisor_contact?: string;
  IHS_supervisor_name?: string;
  Current_Generators?: GeneratorInfo[];
  Rectifier_Type?: string;
  Rectifier_Brand?: string;
  Rectifier_Module_size?: string;
  Rectifier_Module_count?: string;
  Rectifier_Capacity?: string;
  Battery_Brand?: string;
  Battery_Capacity?: string;
  Battery_Type?: string;
  Battery_Count?: string;
  AC_Brand?: string;
  AC_Capacity?: string;
  Solar_Panel_Brand?: string;
  Solar_Panel_Count?: string;
  Solar_Panel_Capacity?: string;
}

// ─────────────────────────────────────────────
// Initial form
// ─────────────────────────────────────────────
const buildInitialForm = (siteId: string): TechnicianSiteAuditFormType => ({
  site_id_ihs: siteId,
  id_operator: "",
  name_site: "",
  topology: "",
  indoor_outdoor: "",
  sbc: "",
  number_of_gen: "1",
  generators: [
    { brand: "", engine_brand: "", alternator_brand: "", capacity_kva: "" },
  ],
  power_cabinets: [
    {
      rectifier_type: "",
      module_size_kw: "",
      rectifier_number: "",
      brand: "",
      capacity_kw: "",
    },
  ],
  additional_power_cabinet_count: "0",
  batteries: [
    { brand: "", capacity_v_ah: "", type: "", number: "", statut: null },
  ],
  aircons: [{ brand: "", capacity_v_w: "", statut: null }],
  solar_panels_number: "",
  solar_panels_brand: "",
  solar_panels_capacity: "",
  solar_panels_working: null,
  environnement_leakage: null,
  environnement_abandoned_equipment: null,
  environnement_site_cleaning: null,
  environnement_light_statut: null,
  shelter_statut: null,
  comments: "",
  timeline_to_close_issues: "",
  overall_site_status: "",
  sbc_feedback: "",
  final_site_status: "",
  date: "",
  photos: [],
  notes: "",
  section_scores: {},
});

// ─────────────────────────────────────────────
// Reusable field components
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
      style={[
        styles.input,
        !editable && styles.inputReadOnly,
        multiline && styles.textArea,
      ]}
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
      <TouchableOpacity
        style={[styles.toggleButton, value === true && styles.toggleActive]}
        onPress={() => onChange(true)}
      >
        <Text
          style={[styles.toggleText, value === true && styles.toggleTextActive]}
        >
          Yes
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleButton, value === false && styles.toggleActive]}
        onPress={() => onChange(false)}
      >
        <Text
          style={[
            styles.toggleText,
            value === false && styles.toggleTextActive,
          ]}
        >
          No
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const OkNokField = ({
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
      <TouchableOpacity
        style={[styles.toggleButton, value === true && styles.toggleActive]}
        onPress={() => onChange(true)}
      >
        <Text
          style={[styles.toggleText, value === true && styles.toggleTextActive]}
        >
          OK
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          value === false && styles.toggleActiveDanger,
        ]}
        onPress={() => onChange(false)}
      >
        <Text
          style={[
            styles.toggleText,
            value === false && styles.toggleTextActive,
          ]}
        >
          NOK
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─────────────────────────────────────────────
// Flatten nested equipment arrays for the API
// ─────────────────────────────────────────────
function flattenEquipment(
  form: TechnicianSiteAuditFormType,
): Record<string, any> {
  const flat: Record<string, any> = { ...form };

  (form.generators || []).forEach((gen, i) => {
    flat[`generator_${i + 1}_brand`] = gen.brand;
    flat[`generator_${i + 1}_engine_brand`] = gen.engine_brand;
    flat[`generator_${i + 1}_alternator_brand`] = gen.alternator_brand;
    flat[`generator_${i + 1}_capacity_kva`] = gen.capacity_kva;
  });

  (form.power_cabinets || []).forEach((cab, i) => {
    const prefix = i === 0 ? "mains_power_cabinet" : `power_cabinet_${i + 1}`;
    flat[`${prefix}_rectifier_type`] = cab.rectifier_type;
    flat[`${prefix}_module_size_kw`] = cab.module_size_kw;
    flat[`${prefix}_rectifier_number`] = cab.rectifier_number;
    flat[`${prefix}_brand`] = cab.brand;
    flat[`${prefix}_capacity_kw`] = cab.capacity_kw;
  });

  (form.batteries || []).forEach((bat, i) => {
    flat[`battery_set_${i + 1}_brand`] = bat.brand;
    flat[`battery_set_${i + 1}_capacity_v_ah`] = bat.capacity_v_ah;
    flat[`battery_set_${i + 1}_type`] = bat.type;
    flat[`battery_set_${i + 1}_number`] = bat.number;
    flat[`battery_set_${i + 1}_statut`] = bat.statut;
  });

  (form.aircons || []).forEach((air, i) => {
    flat[`aircon_${i + 1}_brand`] = air.brand;
    flat[`aircon_${i + 1}_capacity_v_w`] = air.capacity_v_w;
    flat[`aircon_${i + 1}_statut`] = air.statut;
  });

  flat.generator_count = (form.generators || []).length;
  flat.power_cabinet_count = (form.power_cabinets || []).length;
  flat.battery_set_count = (form.batteries || []).length;
  flat.aircon_count = (form.aircons || []).length;

  delete flat.generators;
  delete flat.power_cabinets;
  delete flat.batteries;
  delete flat.aircons;

  return flat;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function TechnicianSiteAuditForm() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [siteDetails, setSiteDetails] = useState<SiteDetails | null>(null);
  const [form, setForm] = useState<TechnicianSiteAuditFormType>(() =>
    buildInitialForm(siteId || ""),
  );
  const [sectionPhotos, setSectionPhotos] = useState<
    Record<string, PhotoAttachment[]>
  >({});

  const draftKey = useMemo(() => `technician_audit_draft_${siteId}`, [siteId]);

  const sectionLabels: Record<string, string> = useMemo(
    () => ({
      site_details: t('site_details'),
      generator1: t('generator1'),
      generator2: t('generator2'),
      generator3: t('generator3'),
      mains_power_cabinet: t('mains_power_cabinet'),
      additional_power_cabinet: t('additional_power_cabinet'),
      batteries: t('batteries'),
      batteries2: t('batteries2'),
      aircon1: t('aircon1'),
      aircon2: t('aircon2'),
      solar: t('solar'),
      environment: t('environment'),
      shelter: t('shelter'),
      comments_status: t('comments_status'),
      general: t('general'),
    }),
    [t],
  );

  const generatorDefaults = useMemo(() => {
    const gens = siteDetails?.Current_Generators || [];
    return [0, 1, 2].map((i) => {
      const g = gens[i] || {};
      return {
        model: g?.model || "",
        serial: g?.serial_number || "",
        status: g?.status || "",
        capacity:
          g?.specifications?.capacity ||
          g?.specifications?.power ||
          g?.specifications?.rating ||
          "",
      };
    });
  }, [siteDetails]);

  // ── FIX: Read ALL possible ID fields from stored user ──────────────────────
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

  const updateField = useCallback(
    (key: keyof TechnicianSiteAuditFormType, value: any) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addSectionPhoto = useCallback(
    (sectionKey: string, photo: PhotoAttachment) => {
      setSectionPhotos((prev) => ({
        ...prev,
        [sectionKey]: [...(prev[sectionKey] || []), photo],
      }));
    },
    [],
  );

  const removeSectionPhoto = useCallback((sectionKey: string, uri: string) => {
    setSectionPhotos((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).filter((p) => p.uri !== uri),
    }));
  }, []);

  const renderSectionPhotos = useCallback(
    (sectionKey: string) => (
      <PhotoCapture
        label={`Photos — ${sectionLabels[sectionKey] || sectionKey}`}
        photos={sectionPhotos[sectionKey] || []}
        onAddPhoto={(photo) => addSectionPhoto(sectionKey, photo)}
        onRemovePhoto={(uri) => removeSectionPhoto(sectionKey, uri)}
      />
    ),
    [addSectionPhoto, removeSectionPhoto, sectionLabels, sectionPhotos],
  );

  const renderSectionNotes = useCallback(
    (sectionKey: string) => (
      <View style={styles.field}>
        <Text
          style={styles.label}
        >{`Notes — ${sectionLabels[sectionKey] || sectionKey}`}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={(form.section_scores as any)?.[`notes_${sectionKey}`] || ""}
          onChangeText={(v) =>
            setForm((prev) => ({
              ...prev,
              section_scores: {
                ...(prev.section_scores || {}),
                [`notes_${sectionKey}`]: v,
              },
            }))
          }
          placeholder="Write notes for this section"
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={3}
        />
      </View>
    ),
    [form.section_scores, sectionLabels],
  );

  // ── Load site details + draft ─────────────────
  const loadSiteAndDraft = useCallback(async () => {
    try {
      const [siteDetailRes, draftStr] = await Promise.all([
        siteAPI.getSiteWithGenerators(siteId || "").catch(() => null),
        AsyncStorage.getItem(draftKey),
      ]);

      if (siteDetailRes) {
        const details: SiteDetails =
          siteDetailRes.data?.data || siteDetailRes.data || null;
        setSiteDetails(details);
      }

      if (draftStr) {
        const draft = JSON.parse(draftStr);
        // Anyone who has this draft key on their device can edit it.
        // Ownership is enforced server-side; locally we just restore the form.
        setForm(draft.payload || buildInitialForm(siteId || ""));
        setSectionPhotos(draft.sectionPhotos || {});
      }
    } catch (error) {
      console.error("Failed to load site or draft:", error);
    } finally {
      setLoading(false);
    }
  }, [draftKey, siteId]);

  useEffect(() => {
    if (!siteId) {
      router.replace("/(technician)/dashboard");
      return;
    }
    // Reset immediately, before the async load even starts. Expo Router can
    // reuse this component instance when navigating between different
    // sites on this same dynamic route (a real, observed behavior — see the
    // identical fix in tank-audit-form/[siteId].tsx) rather than remounting
    // it, so without this reset a technician who opens Site B's audit right
    // after Site A's would see — and could submit — Site A's generator,
    // cabinet, battery, etc. data under Site B until the async load below
    // happens to overwrite every field (which it won't if the new site has
    // no draft and the site-details fetch fails, per loadSiteAndDraft above).
    setLoading(true);
    setForm(buildInitialForm(siteId));
    setSectionPhotos({});
    setSiteDetails(null);
    loadSiteAndDraft();
  }, [loadSiteAndDraft, router, siteId]);

  const buildSectionedPhotos = useCallback(() => {
    return Object.entries(sectionPhotos).flatMap(([section, items]) =>
      items.map((photo) => ({ ...photo, __section: section })),
    );
  }, [sectionPhotos]);

  // ── Reset form helper ────────────────────
  const resetForm = useCallback(async () => {
    setForm(buildInitialForm(siteId || ""));
    setSectionPhotos({});
    await AsyncStorage.removeItem(draftKey);
  }, [draftKey, siteId]);

  // ── Save draft ────────────────────────────────
  // NOTE: photos are sent RAW (local uri, category, description) — submitOrQueue
  // owns uploading them, whether online or via the offline sync queue.
  // Local-only draft persist, no network call, no Alert — preserves whatever
  // auditId/createdBy the last manual save already resolved (if any) rather
  // than re-resolving them, since this runs unattended on a timer and
  // getCurrentUserId() shouldn't fire every 2 min. Matches the identical
  // pattern in tank-audit-form/[siteId].tsx.
  const saveLocalDraftOnly = useCallback(async () => {
    let auditId: string | undefined;
    let createdBy: string | undefined;
    try {
      const existingStr = await AsyncStorage.getItem(draftKey);
      if (existingStr) {
        const existing = JSON.parse(existingStr);
        auditId = existing.auditId;
        createdBy = existing.createdBy;
      }
    } catch {
      /* fall through without auditId/createdBy — next manual save resolves them */
    }
    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify({
        siteId,
        updatedAt: new Date().toISOString(),
        payload: form,
        sectionPhotos,
        auditId,
        createdBy,
      }),
    );
  }, [draftKey, form, sectionPhotos, siteId]);

  // Periodic silent local autosave (every 2 min) — protects in-progress site
  // audit entries even if the technician never taps "Save Draft" themselves.
  // See hooks/useAutoSaveDraft.ts for the full rationale.
  useAutoSaveDraft(saveLocalDraftOnly, { enabled: !loading });

  const saveDraft = useCallback(async () => {
    const currentUserId = await getCurrentUserId();
    let auditId: string | undefined;

    try {
      const existingDraft = await AsyncStorage.getItem(draftKey);
      if (existingDraft) {
        const parsed = JSON.parse(existingDraft);
        auditId = parsed.auditId;
      }

      const sectionedPhotos = buildSectionedPhotos();
      const rawPhotos = sectionedPhotos.map((p) => ({
        uri: p.uri,
        category: p.__section || "general",
        description: sectionLabels[p.__section] || p.__section || "",
      }));

      const payload = {
        ...flattenEquipment(form),
        site_id_ihs: siteId,
        status: "draft",
        photos: rawPhotos,
      };

      let result;
      if (auditId) {
        try {
          result = await submitOrQueue(
            "site_audit_draft",
            `/technician/site-audits/${auditId}`,
            "PUT",
            payload,
          );
          if (result.data?._id) auditId = result.data._id;
        } catch (updateErr: any) {
          const status = updateErr?.response?.status;
          if (status === 403 || status === 404) {
            // Draft on server belongs to someone else or was deleted — create fresh
            const createClientId = generateClientId();
            result = await submitOrQueue(
              "site_audit_draft",
              "/technician/site-audit",
              "POST",
              { ...payload, client_id: createClientId },
            );
            if (result.data?._id) auditId = result.data._id;
          } else {
            throw updateErr;
          }
        }
      } else {
        const createClientId = generateClientId();
        result = await submitOrQueue(
          "site_audit_draft",
          "/technician/site-audit",
          "POST",
          { ...payload, client_id: createClientId },
        );
        if (result.data?._id) auditId = result.data._id;
      }

      // Always persist locally regardless of server outcome
      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({
          siteId,
          updatedAt: new Date().toISOString(),
          payload: form,
          sectionPhotos,
          auditId,
          createdBy: currentUserId,
        }),
      );

      Alert.alert(
        "Draft Saved",
        result?.queued
          ? "No connection — draft saved locally and will sync automatically."
          : "Draft saved and synced to server.",
      );
    } catch (error) {
      console.warn("Draft server save failed, saving locally only:", error);
      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({
          siteId,
          updatedAt: new Date().toISOString(),
          payload: form,
          sectionPhotos,
          auditId,
          createdBy: currentUserId,
        }),
      );
      Alert.alert("Draft Saved", "Saved locally.");
    }
  }, [
    buildSectionedPhotos,
    draftKey,
    form,
    getCurrentUserId,
    sectionLabels,
    sectionPhotos,
    siteId,
  ]);

  // ── Submit ────────────────────────────────────
  const submitAudit = useCallback(async () => {
    setSubmitting(true);
    try {
      let auditId: string | undefined;

      const existingDraft = await AsyncStorage.getItem(draftKey);
      if (existingDraft) {
        const parsed = JSON.parse(existingDraft);
        auditId = parsed.auditId;
      }

      const sectionedPhotos = buildSectionedPhotos();
      const rawPhotos = sectionedPhotos.map((p) => ({
        uri: p.uri,
        category: p.__section || "general",
        description: sectionLabels[p.__section] || p.__section || "",
      }));

      const submitPayload = {
        ...flattenEquipment(form),
        site_id_ihs: siteId,
        status: "submitted",
        photos: rawPhotos,
      };

      let result;
      if (auditId) {
        try {
          result = await submitOrQueue(
            "site_audit_submit",
            `/technician/site-audits/${auditId}`,
            "PUT",
            submitPayload,
          );
        } catch (updateError: any) {
          const status = updateError?.response?.status;

          if (status === 403 || status === 404) {
            // Draft owned by another user, or was deleted server-side — create fresh
            const createClientId = generateClientId();
            result = await submitOrQueue(
              "site_audit_submit",
              "/technician/site-audit",
              "POST",
              { ...submitPayload, client_id: createClientId },
            );
          } else {
            const data = updateError?.response?.data;
            const message = data?.error || data?.message || "Unable to submit. Please try again.";
            Alert.alert("Submission failed", message);
            return;
          }
        }
      } else {
        const createClientId = generateClientId();
        result = await submitOrQueue(
          "site_audit_submit",
          "/technician/site-audit",
          "POST",
          { ...submitPayload, client_id: createClientId },
        );
      }

      // Clear draft + reset form on success (including "queued" success)
      await resetForm();

      Alert.alert(
        "Submitted",
        result?.queued
          ? "No connection — audit saved and will sync automatically."
          : "Audit submitted successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(technician)/dashboard"),
          },
        ],
      );
    } catch (error) {
      console.error("Audit submission error:", error);
      Alert.alert(
        "Submission failed",
        "An unexpected error occurred. Your data has been saved as a draft.",
      );
      await saveDraft();
    } finally {
      setSubmitting(false);
    }
  }, [
    buildSectionedPhotos,
    draftKey,
    form,
    resetForm,
    router,
    saveDraft,
    sectionLabels,
    siteId,
  ]);

  // ── Loading state ─────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('loading_form')}</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('technician_site_audit')}</Text>
        <Text style={styles.subtitle}>
          {siteDetails?.Site_Name || siteId || t('site')}
        </Text>

        {/* ══════════════ SITE DETAILS ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('site_details')}</Text>
          <FormSection
            title={t('default_site_info')}
            icon="information-circle-outline"
            collapsible
            defaultOpen={false}
          >
            <TextField label={t('site_name')} value={siteDetails?.Site_Name || ""} onChange={() => null} editable={false} />
            <TextField label={t('site_id_ihs')} value={siteDetails?.IHS_ID_SITE || siteId || ""} onChange={() => null} editable={false} />
            <TextField label={t('region')} value={siteDetails?.Region || ""} onChange={() => null} editable={false} />
            <TextField label={t('site_type')} value={siteDetails?.Sites_Type || ""} onChange={() => null} editable={false} />
            <TextField label={t('outdoor_indoor_config')} value={siteDetails?.Sites_Configuration_Outdoor_Indoor || ""} onChange={() => null} editable={false} />
            <TextField label={t('power_topology')} value={siteDetails?.Sites_Power_Topology || ""} onChange={() => null} editable={false} />
            <TextField label={t('assigned_technician')} value={siteDetails?.Technician_Name || ""} onChange={() => null} editable={false} />
            <TextField label={t('sbc_supervisor')} value={siteDetails?.SBC_Supervisor || siteDetails?.IHS_supervisor_name || ""} onChange={() => null} editable={false} />
          </FormSection>

          <TextField label={t('operator_id')} value={form.id_operator} onChange={(v) => updateField("id_operator", v)} />
          <TextField label={t('topology_editable')} value={form.topology} onChange={(v) => updateField("topology", v)} />
          <TextField label={t('indoor_outdoor')} value={form.indoor_outdoor} onChange={(v) => updateField("indoor_outdoor", v)} />
          <TextField label={t('sbc_reference')} value={form.sbc} onChange={(v) => updateField("sbc", v)} />
          <TextField label={t('number_of_generators_on_site')} value={form.number_of_gen} onChange={(v) => updateField("number_of_gen", v)} keyboardType="numeric" />
          <DateField label={t('date')} value={form.date} onChange={(v) => updateField("date", v)} />
        </View>

        {/* ══════════════ GENERATORS ══════════════ */}
        {form.generators.map((gen, i) => (
          <View style={styles.section} key={`generator${i + 1}`}>
            <Text style={styles.sectionTitle}>{t('generator', { number: i + 1 })}</Text>
            <FormSection title={t('default_generator_info', { number: i + 1 })} icon="information-circle-outline" collapsible defaultOpen={false}>
              <TextField label={t('brand_model')} value={generatorDefaults[i]?.model} onChange={() => null} editable={false} />
              <TextField label={t('serial_number')} value={generatorDefaults[i]?.serial} onChange={() => null} editable={false} />
              <TextField label={t('capacity')} value={generatorDefaults[i]?.capacity} onChange={() => null} editable={false} />
              <TextField label={t('status')} value={generatorDefaults[i]?.status} onChange={() => null} editable={false} />
            </FormSection>
            <TextField label={t('generator_brand')} value={gen.brand} onChange={(v) => { const arr = [...form.generators]; arr[i].brand = v; updateField("generators", arr); }} />
            <TextField label={t('engine_brand')} value={gen.engine_brand} onChange={(v) => { const arr = [...form.generators]; arr[i].engine_brand = v; updateField("generators", arr); }} />
            <TextField label={t('alternator_brand')} value={gen.alternator_brand} onChange={(v) => { const arr = [...form.generators]; arr[i].alternator_brand = v; updateField("generators", arr); }} />
            <TextField label={t('capacity_kva')} value={gen.capacity_kva} onChange={(v) => { const arr = [...form.generators]; arr[i].capacity_kva = v; updateField("generators", arr); }} keyboardType="numeric" />
            {renderSectionPhotos(`generator${i + 1}`)}
            {renderSectionNotes(`generator${i + 1}`)}
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={() => { const arr = [...form.generators, { brand: "", engine_brand: "", alternator_brand: "", capacity_kva: "" }]; updateField("generators", arr); updateField("number_of_gen", String(arr.length)); }}>
          <Text style={styles.addButtonText}>{t('add_generator')}</Text>
        </TouchableOpacity>

        {/* ══════════════ POWER CABINETS ══════════════ */}
        {form.power_cabinets.map((cab, i) => (
          <View style={styles.section} key={`powercabinet${i + 1}`}>
            <Text style={styles.sectionTitle}>{i === 0 ? t('mains_power_cabinet') : t('additional_power_cabinet', { number: i })}</Text>
            <FormSection title={i === 0 ? t('default_rectifier_info') : t('default_additional_power_cabinet_info', { number: i })} icon="information-circle-outline" collapsible defaultOpen={false}>
              <TextField label={t('rectifier_type')} value={i === 0 ? siteDetails?.Rectifier_Type || "" : ""} onChange={() => null} editable={false} />
              <TextField label={t('brand')} value={i === 0 ? siteDetails?.Rectifier_Brand || "" : ""} onChange={() => null} editable={false} />
              <TextField label={t('module_size_kw')} value={i === 0 ? siteDetails?.Rectifier_Module_size || "" : ""} onChange={() => null} editable={false} />
              <TextField label={t('module_count')} value={i === 0 ? siteDetails?.Rectifier_Module_count || "" : ""} onChange={() => null} editable={false} />
              <TextField label={t('total_capacity')} value={i === 0 ? siteDetails?.Rectifier_Capacity || "" : ""} onChange={() => null} editable={false} />
            </FormSection>
            <TextField label={t('rectifier_module_type')} value={cab.rectifier_type} onChange={(v) => { const arr = [...form.power_cabinets]; arr[i].rectifier_type = v; updateField("power_cabinets", arr); }} />
            <TextField label={t('brand')} value={cab.brand} onChange={(v) => { const arr = [...form.power_cabinets]; arr[i].brand = v; updateField("power_cabinets", arr); }} />
            <TextField label={t('module_size_kw')} value={cab.module_size_kw} onChange={(v) => { const arr = [...form.power_cabinets]; arr[i].module_size_kw = v; updateField("power_cabinets", arr); }} keyboardType="numeric" />
            <TextField label={t('rectifier_module_count')} value={cab.rectifier_number} onChange={(v) => { const arr = [...form.power_cabinets]; arr[i].rectifier_number = v; updateField("power_cabinets", arr); }} keyboardType="numeric" />
            <TextField label={t('capacity_kw')} value={cab.capacity_kw} onChange={(v) => { const arr = [...form.power_cabinets]; arr[i].capacity_kw = v; updateField("power_cabinets", arr); }} keyboardType="numeric" />
            {renderSectionPhotos(i === 0 ? "mains_power_cabinet" : `power_cabinet_${i + 1}`)}
            {renderSectionNotes(i === 0 ? "mains_power_cabinet" : `power_cabinet_${i + 1}`)}
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={() => { const arr = [...form.power_cabinets, { rectifier_type: "", module_size_kw: "", rectifier_number: "", brand: "", capacity_kw: "" }]; updateField("power_cabinets", arr); updateField("additional_power_cabinet_count", String(arr.length - 1)); }}>
          <Text style={styles.addButtonText}>{t('add_power_cabinet')}</Text>
        </TouchableOpacity>

        {/* ══════════════ BATTERIES ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('batteries')}</Text>
          {form.batteries.map((bat, idx) => (
            <FormSection key={idx} title={t('battery_set', { number: idx + 1 })} icon="information-circle-outline" collapsible defaultOpen={false}>
              <TextField label={t('brand')} value={bat.brand} onChange={(v) => { const arr = [...form.batteries]; arr[idx].brand = v; updateField("batteries", arr); }} />
              <TextField label={t('capacity_v_ah')} value={bat.capacity_v_ah} onChange={(v) => { const arr = [...form.batteries]; arr[idx].capacity_v_ah = v; updateField("batteries", arr); }} />
              <TextField label={t('type')} value={bat.type} onChange={(v) => { const arr = [...form.batteries]; arr[idx].type = v; updateField("batteries", arr); }} />
              <TextField label={t('number_of_batteries')} value={bat.number} onChange={(v) => { const arr = [...form.batteries]; arr[idx].number = v; updateField("batteries", arr); }} keyboardType="numeric" />
              <OkNokField label={t('battery_set_status', { number: idx + 1 })} value={bat.statut ?? null} onChange={(v) => { const arr = [...form.batteries]; arr[idx].statut = v; updateField("batteries", arr); }} />
              {renderSectionPhotos(`batteries${idx + 1}`)}
              {renderSectionNotes(`batteries${idx + 1}`)}
            </FormSection>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={() => { const arr = [...form.batteries, { brand: "", capacity_v_ah: "", type: "", number: "", statut: null }]; updateField("batteries", arr); }}>
            <Text style={styles.addButtonText}>{t('add_another_battery_set')}</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════ AIRCONS ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('air_conditioners')}</Text>
          {form.aircons.map((air, idx) => (
            <FormSection key={idx} title={t('aircon', { number: idx + 1 })} icon="information-circle-outline" collapsible defaultOpen={false}>
              <TextField label={t('brand')} value={air.brand} onChange={(v) => { const arr = [...form.aircons]; arr[idx].brand = v; updateField("aircons", arr); }} />
              <TextField label={t('capacity_btu_w')} value={air.capacity_v_w} onChange={(v) => { const arr = [...form.aircons]; arr[idx].capacity_v_w = v; updateField("aircons", arr); }} />
              <OkNokField label={t('aircon_status', { number: idx + 1 })} value={air.statut ?? null} onChange={(v) => { const arr = [...form.aircons]; arr[idx].statut = v; updateField("aircons", arr); }} />
              {renderSectionPhotos(`aircon${idx + 1}`)}
              {renderSectionNotes(`aircon${idx + 1}`)}
            </FormSection>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={() => { const arr = [...form.aircons, { brand: "", capacity_v_w: "", statut: null }]; updateField("aircons", arr); }}>
            <Text style={styles.addButtonText}>{t('add_another_aircon')}</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════ SOLAR ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('solar_system')}</Text>
          <FormSection title={t('default_solar_info')} icon="information-circle-outline" collapsible defaultOpen={false}>
            <TextField label={t('brand')} value={siteDetails?.Solar_Panel_Brand || ""} onChange={() => null} editable={false} />
            <TextField label={t('panel_count')} value={siteDetails?.Solar_Panel_Count || ""} onChange={() => null} editable={false} />
            <TextField label={t('capacity')} value={siteDetails?.Solar_Panel_Capacity || ""} onChange={() => null} editable={false} />
          </FormSection>
          <TextField label={t('number_of_panels')} value={form.solar_panels_number} onChange={(v) => updateField("solar_panels_number", v)} keyboardType="numeric" />
          <TextField label={t('brand')} value={form.solar_panels_brand} onChange={(v) => updateField("solar_panels_brand", v)} />
          <TextField label={t('capacity')} value={form.solar_panels_capacity} onChange={(v) => updateField("solar_panels_capacity", v)} />
          <OkNokField label={t('solar_system_working')} value={form.solar_panels_working ?? null} onChange={(v) => updateField("solar_panels_working", v)} />
          {renderSectionPhotos("solar")}
          {renderSectionNotes("solar")}
        </View>

        {/* ══════════════ ENVIRONMENT ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('environment')}</Text>
          <OkNokField label={t('leakage_status')} value={form.environnement_leakage ?? null} onChange={(v) => updateField("environnement_leakage", v)} />
          <YesNoField label={t('abandoned_equipment_on_site')} value={form.environnement_abandoned_equipment ?? null} onChange={(v) => updateField("environnement_abandoned_equipment", v)} />
          <OkNokField label={t('site_cleaning')} value={form.environnement_site_cleaning ?? null} onChange={(v) => updateField("environnement_site_cleaning", v)} />
          <OkNokField label={t('light_status')} value={form.environnement_light_statut ?? null} onChange={(v) => updateField("environnement_light_statut", v)} />
          {renderSectionPhotos("environment")}
          {renderSectionNotes("environment")}
        </View>

        {/* ══════════════ SHELTER ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('shelter')}</Text>
          <OkNokField label={t('shelter_status')} value={form.shelter_statut ?? null} onChange={(v) => updateField("shelter_statut", v)} />
          {renderSectionPhotos("shelter")}
          {renderSectionNotes("shelter")}
        </View>

        {/* ══════════════ COMMENTS & STATUS ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('comments_status')}</Text>
          <TextField label={t('comments_issues_on_site')} value={form.comments} onChange={(v) => updateField("comments", v)} multiline />
          <DateField label={t('timeline_to_close_issues')} value={form.timeline_to_close_issues} onChange={(v) => updateField("timeline_to_close_issues", v)} />
          <OkNokField
            label={t('overall_site_status')}
            value={form.overall_site_status === "true" ? true : form.overall_site_status === "false" ? false : null}
            onChange={(v) => updateField("overall_site_status", v)}
          />
          <TextField label={t('sbc_feedback')} value={form.sbc_feedback} onChange={(v) => updateField("sbc_feedback", v)} multiline />
          <OkNokField
            label={t('final_site_status_ss')}
            value={form.final_site_status === "true" ? true : form.final_site_status === "false" ? false : null}
            onChange={(v) => updateField("final_site_status", v)}
          />
          {renderSectionPhotos("comments_status")}
        </View>

        {/* ══════════════ GENERAL PHOTOS & NOTES ══════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('general_photos_notes')}</Text>
          {renderSectionPhotos("general")}
          <TextField label={t('additional_notes')} value={form.notes} onChange={(v) => updateField("notes", v)} multiline />
        </View>

        {/* ══════════════ ACTIONS ══════════════ */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={saveDraft} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>{t('save_draft')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={submitAudit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('submit_audit')}</Text>
            )}
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
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: Colors.text, backgroundColor: Colors.background },
  inputReadOnly: { backgroundColor: Colors.surface, color: Colors.textSecondary },
  textArea: { height: 80, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleActiveDanger: { backgroundColor: Colors.danger ?? "#EF4444", borderColor: Colors.danger ?? "#EF4444" },
  toggleText: { color: Colors.text, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  actions: { marginTop: 20, marginBottom: 40, gap: 12 },
  primaryButton: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: { backgroundColor: Colors.surface, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  loadingText: { marginTop: 10, color: Colors.textSecondary },
  addButton: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: "center", marginVertical: 8 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});




