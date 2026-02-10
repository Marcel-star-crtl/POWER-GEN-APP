import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../../constants/Colors';
import { operationsAPI, siteAPI, uploadAPI } from '../../../services/api';
import { PhotoAttachment, PhotoCapture } from '../../../components/ui/PhotoCapture';
import { FormSection } from '../../../components/ui/FormSection';
import { SiteAuditChecklist } from '../../../types/operations.types';

interface SiteItem {
  _id: string;
  Site_Name?: string;
  IHS_ID_SITE?: string;
  Region?: string;
  Sites_Type?: string;
}

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
}

const emptyBoolean = null as boolean | null;

const buildInitialForm = (siteId: string): SiteAuditChecklist => ({
  site: siteId,
  janitorial: {
    inside_clean: emptyBoolean,
    outside_perimeter_clean: emptyBoolean,
    shelter_cleaned: emptyBoolean,
    outdoor_equipment_cleaned: emptyBoolean,
    air_blower_used: emptyBoolean,
  },
  fumigation: {
    rat_mice_signs_checked: emptyBoolean,
    chemicals_applied: emptyBoolean,
  },
  generator: {
    capacity: '',
    generator_brand: '',
    engine_brand: '',
    alternator_brand: '',
    controller_brand: '',
    running_hours: '',
    clean_inside_outside: emptyBoolean,
    fuel_filter_changed: emptyBoolean,
    oil_filter_changed: emptyBoolean,
    air_filter_changed: emptyBoolean,
    oil_leakage_checked: emptyBoolean,
    oil_level_max: emptyBoolean,
    oil_quality_checked: emptyBoolean,
    radiator_status_checked: emptyBoolean,
    fan_belt_checked: emptyBoolean,
    thermostat_checked: emptyBoolean,
    radiator_hoses_checked: emptyBoolean,
    coolant_level_checked: emptyBoolean,
    water_pump_checked: emptyBoolean,
    fuel_leakage_checked: emptyBoolean,
    fuel_piping_status_checked: emptyBoolean,
    water_separator_filter_checked: emptyBoolean,
    battery_and_charger_checked: emptyBoolean,
    dc_charge_alternator_belt_checked: emptyBoolean,
    kick_starter_checked: emptyBoolean,
    controller_status_checked: emptyBoolean,
    alarms_status_checked: emptyBoolean,
    temp_oil_sensors_checked: emptyBoolean,
    exhaust_system_checked: emptyBoolean,
    silencer_checked: emptyBoolean,
  },
  ats_system: {
    loose_connections_checked: emptyBoolean,
    components_checked: emptyBoolean,
    test_functioning_done: emptyBoolean,
  },
  grid: {
    grid_index: '',
    grid_connected_operational: emptyBoolean,
    grid_stable: emptyBoolean,
  },
  avr: {
    physical_status_ok: emptyBoolean,
    input_output_measured: emptyBoolean,
  },
  fuel_tank: {
    capacity_height_cm: '',
    capacity_width_cm: '',
    capacity_depth_cm: '',
    quantity_found: '',
    quantity_refueled: '',
    cap_closed_attached: emptyBoolean,
    water_separator_filter_changed: emptyBoolean,
    fuel_pipes_leak_checked: emptyBoolean,
    connected_to_earthing: emptyBoolean,
    fuel_certificate_issued: emptyBoolean,
  },
  air_conditioning: {
    ac_type: '',
    internal_filter_cleaned: emptyBoolean,
    outdoor_compressor_cleaned: emptyBoolean,
    high_low_pressure_measured: emptyBoolean,
    temperature_recorded: '',
    amps_measured: emptyBoolean,
    condenser_evaporator_cleaned: emptyBoolean,
    outdoor_fan_checked: emptyBoolean,
  },
  canopy: {
    rust_checked: emptyBoolean,
    lighting_sockets_working: emptyBoolean,
    roofing_sheets_good: emptyBoolean,
    connected_to_earthing: emptyBoolean,
    structure_stable: emptyBoolean,
    foundation_no_cracks: emptyBoolean,
    foundation_cracks_rectified: emptyBoolean,
  },
  cable_tray: {
    rust_checked: emptyBoolean,
    fixed_firmly: emptyBoolean,
    cable_section_checked: emptyBoolean,
    connected_to_earthing: emptyBoolean,
    cables_tightened: emptyBoolean,
    cables_have_lugs: emptyBoolean,
  },
  fence: {
    fence_type: '',
    rust_checked: emptyBoolean,
    no_anomaly_access: emptyBoolean,
    gate_locking_operational: emptyBoolean,
    razor_wire_available: emptyBoolean,
    connected_to_earthing: emptyBoolean,
  },
  power_rectifiers: {
    modules_found: '',
    modules_missing: '',
    rectifier_type_capacity: '',
    breakers_checked: emptyBoolean,
    output_voltage: '',
    cabling_status_good: emptyBoolean,
  },
  power_batteries: {
    batteries_count: '',
    unit_battery_capacity: '',
    output_checked: emptyBoolean,
    autonomy_test_done: emptyBoolean,
    autonomy_estimated: '',
  },
  cooling_system_cabinet: {
    temperature_checked: emptyBoolean,
    water_accumulation_signs: emptyBoolean,
  },
  solar_batteries: {
    batteries_count: '',
    unit_capacity: '',
    output_checked: emptyBoolean,
    autonomy_test_done: emptyBoolean,
    autonomy_estimated: '',
  },
  solar_panels: {
    output_checked_before_clean: emptyBoolean,
    panels_cleaned: emptyBoolean,
    connections_checked: emptyBoolean,
  },
  earthing_system: {
    earth_resistance_measured: emptyBoolean,
    earth_resistance_value: '',
    less_than_5_ohms: emptyBoolean,
    action_if_above_5: '',
  },
  alarms_system: {
    temp_sensor_ok: emptyBoolean,
    power_sensor_ok: emptyBoolean,
    gate_lock_sensor_ok: emptyBoolean,
    fuel_sensor_ok: emptyBoolean,
    fuel_tank_sensors_ok: emptyBoolean,
    external_alarms_wired: emptyBoolean,
    alarms_reporting: emptyBoolean,
    alarms_not_reporting_reason: '',
  },
  signatures: {
    subcontractor_signature: '',
    audit_technician_signature: '',
    regional_manager_signature: '',
  },
  section_notes: {
    janitorial: '',
    fumigation: '',
    generator: '',
    ats_system: '',
    grid: '',
    avr: '',
    fuel_tank: '',
    air_conditioning: '',
    canopy: '',
    cable_tray: '',
    fence: '',
    power_rectifiers: '',
    power_batteries: '',
    cooling_system_cabinet: '',
    solar_batteries: '',
    solar_panels: '',
    earthing_system: '',
    alarms_system: '',
    signatures: '',
    general: '',
  },
  section_scores: {
    janitorial: 0,
    fumigation: 0,
    generator: 0,
    ats_system: 0,
    grid: 0,
    avr: 0,
    fuel_tank: 0,
    air_conditioning: 0,
    canopy: 0,
    cable_tray: 0,
    fence: 0,
    power_rectifiers: 0,
    power_batteries: 0,
    cooling_system_cabinet: 0,
    solar_batteries: 0,
    solar_panels: 0,
    earthing_system: 0,
    alarms_system: 0,
    signatures: 0,
    general: 0,
  },
  total_score: 0,
  notes: '',
});

const setByPath = (obj: any, path: string, value: any) => {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    current[key] = { ...(current[key] || {}) };
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
};

const YesNoField = ({ label, value, onChange }: { label: string; value: boolean | null; onChange: (val: boolean) => void }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleButton, value === true && styles.toggleActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.toggleText, value === true && styles.toggleTextActive]}>Yes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleButton, value === false && styles.toggleActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.toggleText, value === false && styles.toggleTextActive]}>No</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const TextField = ({
  label,
  value,
  onChange,
  keyboardType = 'default',
  editable = true,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  keyboardType?: 'default' | 'numeric';
  editable?: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, !editable && styles.inputReadOnly]}
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      placeholder="Enter value"
      placeholderTextColor={Colors.textSecondary}
      editable={editable}
    />
  </View>
);

export default function OperationsAuditForm() {
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<SiteItem | null>(null);
  const [siteDetails, setSiteDetails] = useState<SiteDetails | null>(null);
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [sectionPhotos, setSectionPhotos] = useState<Record<string, PhotoAttachment[]>>({});
  const [form, setForm] = useState<SiteAuditChecklist>(() => buildInitialForm(siteId || ''));

  const draftKey = useMemo(() => `operations_audit_draft_${siteId}`, [siteId]);

  const sectionLabels: Record<string, string> = useMemo(
    () => ({
      site_details: 'Site Details',
      janitorial: 'Site Janitorial / Hygiene',
      fumigation: 'Fumigation',
      generator: 'Generator',
      ats_system: 'ATS System',
      grid: 'Grid (ENEO)',
      avr: 'AVR (Automatic Voltage Regulator)',
      fuel_tank: 'Fuel Tank',
      air_conditioning: 'Air Conditioning',
      canopy: 'Canopy Status',
      cable_tray: 'Cable & Cable Tray',
      fence: 'Fence',
      power_rectifiers: 'Power System - Rectifiers',
      power_batteries: 'Power System - Batteries',
      cooling_system_cabinet: 'Cooling System for Power Cabinet',
      solar_batteries: 'Solar System - Batteries',
      solar_panels: 'Solar Panels',
      earthing_system: 'Earthing System',
      alarms_system: 'Alarms System',
      signatures: 'Signatures',
      general: 'General Photos',
    }),
    []
  );

  const updateField = useCallback((path: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev } as any;
      setByPath(next, path, value);
      return next;
    });
  }, []);

  const addSectionPhoto = useCallback((sectionKey: string, photo: PhotoAttachment) => {
    setSectionPhotos((prev) => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] || []), photo],
    }));
  }, []);

  const removeSectionPhoto = useCallback((sectionKey: string, uri: string) => {
    setSectionPhotos((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).filter((p) => p.uri !== uri),
    }));
  }, []);

  const renderSectionPhotos = useCallback(
    (sectionKey: string) => (
      <PhotoCapture
        label={`Photos - ${sectionLabels[sectionKey] || sectionKey}`}
        photos={sectionPhotos[sectionKey] || []}
        onAddPhoto={(photo) => addSectionPhoto(sectionKey, photo)}
        onRemovePhoto={(uri) => removeSectionPhoto(sectionKey, uri)}
      />
    ),
    [addSectionPhoto, removeSectionPhoto, sectionLabels, sectionPhotos]
  );

  const renderSectionNotes = useCallback(
    (sectionKey: string) => (
      <View style={styles.field}>
        <Text style={styles.label}>{`Notes - ${sectionLabels[sectionKey] || sectionKey}`}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.section_notes?.[sectionKey] || ''}
          onChangeText={(v) => updateField(`section_notes.${sectionKey}`, v)}
          placeholder="Write notes for this section"
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={3}
        />
      </View>
    ),
    [form.section_notes, sectionLabels, updateField]
  );

  const renderSectionScore = useCallback(
    (sectionKey: string) => (
      <View style={styles.field}>
        <Text style={styles.label}>{`Score (0-5) - ${sectionLabels[sectionKey] || sectionKey}`}</Text>
        <TextInput
          style={styles.input}
          value={
            form.section_scores?.[sectionKey] !== undefined
              ? String(form.section_scores?.[sectionKey])
              : ''
          }
          onChangeText={(v) => {
            const numeric = Number.parseFloat(v);
            updateField(`section_scores.${sectionKey}`, Number.isNaN(numeric) ? 0 : numeric);
          }}
          placeholder="0 - 5"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="numeric"
        />
      </View>
    ),
    [form.section_scores, sectionLabels, updateField]
  );

  const totalScore = useMemo(() => {
    const scores = form.section_scores || {};
    const values = Object.values(scores).filter((v) => typeof v === 'number' && !Number.isNaN(v));
    return values.reduce((sum, v) => sum + v, 0);
  }, [form.section_scores]);

  const getCurrentUserId = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return undefined;
      const user = JSON.parse(userStr);
      return user?.id || user?._id;
    } catch {
      return undefined;
    }
  }, []);

  const loadSiteAndDraft = useCallback(async () => {
    try {
      const [siteResponse, draftStr, currentUserId] = await Promise.all([
        operationsAPI.getSites(),
        AsyncStorage.getItem(draftKey),
        getCurrentUserId(),
      ]);

      const sites: SiteItem[] = siteResponse.data?.data || [];
      const siteInfo = sites.find((s) => s._id === siteId) || null;
      setSite(siteInfo || null);

      if (siteInfo?.IHS_ID_SITE) {
        try {
          const siteDetailRes = await siteAPI.getSiteWithGenerators(siteInfo.IHS_ID_SITE);
          setSiteDetails(siteDetailRes.data?.data || siteDetailRes.data || null);
        } catch (error) {
          console.warn('Failed to fetch site details:', error);
        }
      }

      if (draftStr) {
        const draft = JSON.parse(draftStr);
        const draftOwner = draft.createdBy;
        if (!draftOwner || !currentUserId || draftOwner === currentUserId) {
          setForm(draft.payload || buildInitialForm(siteId));
          setPhotos(draft.photos || []);
          setSectionPhotos(draft.sectionPhotos || {});
        }
      }
    } catch (error) {
      console.error('Failed to load site or draft:', error);
    } finally {
      setLoading(false);
    }
  }, [draftKey, getCurrentUserId, siteId]);

  const generatorDefaults = useMemo(() => {
    const generators = siteDetails?.Current_Generators || [];
    const primary = generators[0];
    return {
      model: primary?.model || '',
      serial: primary?.serial_number || '',
      status: primary?.status || '',
      capacity:
        primary?.specifications?.capacity ||
        primary?.specifications?.power ||
        primary?.specifications?.rating ||
        '',
    };
  }, [siteDetails]);

  useEffect(() => {
    if (!siteId) {
      router.replace('/(operations)/select-site');
      return;
    }
    loadSiteAndDraft();
  }, [loadSiteAndDraft, router, siteId]);

  const saveDraft = async () => {
    const payload = {
      ...form,
      site: siteId,
      site_name: site?.Site_Name,
      site_code: site?.IHS_ID_SITE,
      region: site?.Region,
      status: 'draft',
    };

    let auditId: string | undefined;
    const currentUserId = await getCurrentUserId();
    try {
      const existingDraft = await AsyncStorage.getItem(draftKey);
      if (existingDraft) {
        const parsed = JSON.parse(existingDraft);
        if (!parsed.createdBy || !currentUserId || parsed.createdBy === currentUserId) {
          auditId = parsed.auditId;
        }
      }

      const sectionedPhotos = [
        ...photos.map((photo) => ({ ...photo, __section: 'general' })),
        ...Object.entries(sectionPhotos).flatMap(([section, items]) =>
          items.map((photo) => ({ ...photo, __section: section }))
        ),
      ];

      const processedPhotos = sectionedPhotos.length > 0
        ? await uploadAPI.processAndUploadData(sectionedPhotos)
        : [];

      const serverPayload = {
        ...payload,
        photos: (processedPhotos || []).map((p: any) => ({
          url: p.uri || p.url || p,
          category: 'general',
          description: sectionLabels[p.__section] || p.__section || '',
        })),
      };

      if (auditId) {
        try {
          const res = await operationsAPI.updateAudit(auditId, serverPayload);
          auditId = res.data?.data?._id || auditId;
        } catch (updateError) {
          const status = (updateError as any)?.response?.status;
          console.warn('Draft update failed, creating a new draft instead:', updateError);
          if (status === 403) {
            auditId = undefined;
          }
          const res = await operationsAPI.createAudit(serverPayload);
          auditId = res.data?.data?._id;
        }
      } else {
        const res = await operationsAPI.createAudit(serverPayload);
        auditId = res.data?.data?._id;
      }
    } catch (error) {
      console.warn('Draft save to server failed, saving locally only:', error);
    }

    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify({
        siteId,
        siteName: site?.Site_Name,
        updatedAt: new Date().toISOString(),
        payload,
        photos,
        sectionPhotos,
        auditId,
        createdBy: currentUserId,
      })
    );

    Alert.alert('Draft Saved', auditId ? 'Draft saved and synced.' : 'Your audit draft has been saved locally.');
  };

  const submitAudit = async () => {
    try {
      let auditId: string | undefined;
      const currentUserId = await getCurrentUserId();
      const existingDraft = await AsyncStorage.getItem(draftKey);
      if (existingDraft) {
        const parsed = JSON.parse(existingDraft);
        if (!parsed.createdBy || !currentUserId || parsed.createdBy === currentUserId) {
          auditId = parsed.auditId;
        }
      }

      const sectionedPhotos = [
        ...photos.map((photo) => ({ ...photo, __section: 'general' })),
        ...Object.entries(sectionPhotos).flatMap(([section, items]) =>
          items.map((photo) => ({ ...photo, __section: section }))
        ),
      ];

      const processedPhotos = await uploadAPI.processAndUploadData(sectionedPhotos);
      const payload = {
        ...form,
        site: siteId,
        site_name: site?.Site_Name,
        site_code: site?.IHS_ID_SITE,
        region: site?.Region,
        status: 'submitted',
        total_score: totalScore,
        photos: (processedPhotos || []).map((p: any) => ({
          url: p.uri || p.url || p,
          category: 'general',
          description: sectionLabels[p.__section] || p.__section || '',
        }))
      };

      if (auditId) {
        try {
          await operationsAPI.updateAudit(auditId, payload);
        } catch (updateError) {
          const status = (updateError as any)?.response?.status;
          const message = (updateError as any)?.response?.data?.error
            || (updateError as any)?.response?.data?.message
            || 'Unable to submit this draft. Please try again.';

          console.warn('Submit update failed:', updateError);

          if (status === 403) {
            Alert.alert('Submission failed', 'This draft belongs to another user. Please start a new audit.');
            return;
          }

          Alert.alert('Submission failed', message);
          return;
        }
      } else {
        await operationsAPI.createAudit(payload);
      }

      await AsyncStorage.removeItem(draftKey);
      Alert.alert('Submitted', 'Audit submitted successfully.');
      router.replace('/(operations)/dashboard');
    } catch (error) {
      console.error('Audit submission error:', error);
      Alert.alert('Submission failed', 'Saved as draft. Please sync when online.');
      await saveDraft();
    }
  };

  const addPhoto = (photo: PhotoAttachment) => {
    setPhotos((prev) => [...prev, photo]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading form...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={styles.title}>Site Audit Checklist</Text>
        <Text style={styles.subtitle}>{site?.Site_Name || 'Site'}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Details</Text>
          <FormSection title="Default Site Info" icon="information-circle-outline" collapsible defaultOpen={false}>
            <TextField label="Site Name" value={siteDetails?.Site_Name || site?.Site_Name || ''} onChange={() => null} editable={false} />
            <TextField label="Site ID" value={siteDetails?.IHS_ID_SITE || site?.IHS_ID_SITE || ''} onChange={() => null} editable={false} />
            <TextField label="Region" value={siteDetails?.Region || site?.Region || ''} onChange={() => null} editable={false} />
            <TextField label="Site Type" value={siteDetails?.Sites_Type || site?.Sites_Type || ''} onChange={() => null} editable={false} />
            <TextField label="Outdoor/Indoor Config" value={siteDetails?.Sites_Configuration_Outdoor_Indoor || ''} onChange={() => null} editable={false} />
            <TextField label="Power Topology" value={siteDetails?.Sites_Power_Topology || ''} onChange={() => null} editable={false} />
            <TextField
              label="Assigned Technician"
              value={siteDetails?.Technician_Name || ''}
              onChange={() => null}
              editable={false}
            />
            <TextField
              label="Assigned Supervisor"
              value={siteDetails?.SBC_Supervisor || siteDetails?.IHS_supervisor_name || ''}
              onChange={() => null}
              editable={false}
            />
          </FormSection>
          <TextField label="Sub-Region" value={form.sub_region || ''} onChange={(v) => updateField('sub_region', v)} />
          <TextField label="Access REF" value={form.access_ref || ''} onChange={(v) => updateField('access_ref', v)} />
          <TextField label="Time In" value={form.time_in || ''} onChange={(v) => updateField('time_in', v)} />
          <TextField label="Time Out" value={form.time_out || ''} onChange={(v) => updateField('time_out', v)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Janitorial / Hygiene</Text>
          <YesNoField label="Is the inside of the site clean (papers, herbs, plantations)?" value={form.janitorial.inside_clean} onChange={(v) => updateField('janitorial.inside_clean', v)} />
          <YesNoField label="Is the outside perimeter of the site clean at 4m around?" value={form.janitorial.outside_perimeter_clean} onChange={(v) => updateField('janitorial.outside_perimeter_clean', v)} />
          <YesNoField label="Is the inside and outside of the shelter cleaned from dust?" value={form.janitorial.shelter_cleaned} onChange={(v) => updateField('janitorial.shelter_cleaned', v)} />
          <YesNoField label="Did the contractor clean dust on the outdoor equipment?" value={form.janitorial.outdoor_equipment_cleaned} onChange={(v) => updateField('janitorial.outdoor_equipment_cleaned', v)} />
          <YesNoField label="Did they use air blower within shelter to clean all dusts?" value={form.janitorial.air_blower_used} onChange={(v) => updateField('janitorial.air_blower_used', v)} />
          {renderSectionPhotos('janitorial')}
          {renderSectionNotes('janitorial')}
          {renderSectionScore('janitorial')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fumigation</Text>
          <YesNoField label="Did the contractor check for any signs of rat/mice activity within site?" value={form.fumigation.rat_mice_signs_checked} onChange={(v) => updateField('fumigation.rat_mice_signs_checked', v)} />
          <YesNoField label="Did the contractor apply chemicals on site within its internal perimeter?" value={form.fumigation.chemicals_applied} onChange={(v) => updateField('fumigation.chemicals_applied', v)} />
          {renderSectionPhotos('fumigation')}
          {renderSectionNotes('fumigation')}
          {renderSectionScore('fumigation')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generator</Text>
          <FormSection title="Default Generator Info" icon="information-circle-outline" collapsible defaultOpen={false}>
            <TextField label="Generator capacity" value={generatorDefaults.capacity || form.generator.capacity} onChange={() => null} editable={false} />
            <TextField label="Generator brand/model" value={generatorDefaults.model || form.generator.generator_brand} onChange={() => null} editable={false} />
            <TextField label="Generator serial" value={generatorDefaults.serial || ''} onChange={() => null} editable={false} />
            <TextField label="Generator status" value={generatorDefaults.status || ''} onChange={() => null} editable={false} />
          </FormSection>
          <TextField label="Engine brand" value={form.generator.engine_brand} onChange={(v) => updateField('generator.engine_brand', v)} />
          <TextField label="Alternator brand" value={form.generator.alternator_brand} onChange={(v) => updateField('generator.alternator_brand', v)} />
          <TextField label="Board controller brand" value={form.generator.controller_brand} onChange={(v) => updateField('generator.controller_brand', v)} />
          <TextField label="Running hour counter" value={form.generator.running_hours} onChange={(v) => updateField('generator.running_hours', v)} />
          <YesNoField label="Generator clean inside and outside" value={form.generator.clean_inside_outside} onChange={(v) => updateField('generator.clean_inside_outside', v)} />
          <YesNoField label="Fuel filter changed" value={form.generator.fuel_filter_changed} onChange={(v) => updateField('generator.fuel_filter_changed', v)} />
          <YesNoField label="Oil filter changed (each 200-250 hours)" value={form.generator.oil_filter_changed} onChange={(v) => updateField('generator.oil_filter_changed', v)} />
          <YesNoField label="Air filter changed" value={form.generator.air_filter_changed} onChange={(v) => updateField('generator.air_filter_changed', v)} />
          <YesNoField label="Oil leakage checked" value={form.generator.oil_leakage_checked} onChange={(v) => updateField('generator.oil_leakage_checked', v)} />
          <YesNoField label="Oil level at maximum" value={form.generator.oil_level_max} onChange={(v) => updateField('generator.oil_level_max', v)} />
          <YesNoField label="Oil quality checked" value={form.generator.oil_quality_checked} onChange={(v) => updateField('generator.oil_quality_checked', v)} />
          <YesNoField label="Radiator status checked" value={form.generator.radiator_status_checked} onChange={(v) => updateField('generator.radiator_status_checked', v)} />
          <YesNoField label="Fan belt checked" value={form.generator.fan_belt_checked} onChange={(v) => updateField('generator.fan_belt_checked', v)} />
          <YesNoField label="Thermostat status checked" value={form.generator.thermostat_checked} onChange={(v) => updateField('generator.thermostat_checked', v)} />
          <YesNoField label="Radiator hoses checked" value={form.generator.radiator_hoses_checked} onChange={(v) => updateField('generator.radiator_hoses_checked', v)} />
          <YesNoField label="Water/coolant level checked" value={form.generator.coolant_level_checked} onChange={(v) => updateField('generator.coolant_level_checked', v)} />
          <YesNoField label="Water pump system checked" value={form.generator.water_pump_checked} onChange={(v) => updateField('generator.water_pump_checked', v)} />
          <YesNoField label="Fuel leakage checked" value={form.generator.fuel_leakage_checked} onChange={(v) => updateField('generator.fuel_leakage_checked', v)} />
          <YesNoField label="Fuel piping status checked" value={form.generator.fuel_piping_status_checked} onChange={(v) => updateField('generator.fuel_piping_status_checked', v)} />
          <YesNoField label="Water separator filter checked" value={form.generator.water_separator_filter_checked} onChange={(v) => updateField('generator.water_separator_filter_checked', v)} />
          <YesNoField label="Battery and charger checked" value={form.generator.battery_and_charger_checked} onChange={(v) => updateField('generator.battery_and_charger_checked', v)} />
          <YesNoField label="DC charge alternator belt checked" value={form.generator.dc_charge_alternator_belt_checked} onChange={(v) => updateField('generator.dc_charge_alternator_belt_checked', v)} />
          <YesNoField label="Kick starter checked" value={form.generator.kick_starter_checked} onChange={(v) => updateField('generator.kick_starter_checked', v)} />
          <YesNoField label="Controller status checked" value={form.generator.controller_status_checked} onChange={(v) => updateField('generator.controller_status_checked', v)} />
          <YesNoField label="Alarm status checked (low fuel, oil pressure, voltage)" value={form.generator.alarms_status_checked} onChange={(v) => updateField('generator.alarms_status_checked', v)} />
          <YesNoField label="Temperature and oil sensors checked" value={form.generator.temp_oil_sensors_checked} onChange={(v) => updateField('generator.temp_oil_sensors_checked', v)} />
          <YesNoField label="Exhaust system checked" value={form.generator.exhaust_system_checked} onChange={(v) => updateField('generator.exhaust_system_checked', v)} />
          <YesNoField label="Silencer checked" value={form.generator.silencer_checked} onChange={(v) => updateField('generator.silencer_checked', v)} />
          {renderSectionPhotos('generator')}
          {renderSectionNotes('generator')}
          {renderSectionScore('generator')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ATS System</Text>
          <YesNoField label="ATS loose connections checked" value={form.ats_system.loose_connections_checked} onChange={(v) => updateField('ats_system.loose_connections_checked', v)} />
          <YesNoField label="ATS components checked" value={form.ats_system.components_checked} onChange={(v) => updateField('ats_system.components_checked', v)} />
          <YesNoField label="ATS test functioning done" value={form.ats_system.test_functioning_done} onChange={(v) => updateField('ats_system.test_functioning_done', v)} />
          {renderSectionPhotos('ats_system')}
          {renderSectionNotes('ats_system')}
          {renderSectionScore('ats_system')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grid (ENEO)</Text>
          <TextField label="Grid index" value={form.grid.grid_index} onChange={(v) => updateField('grid.grid_index', v)} />
          <YesNoField label="Grid connected and operational" value={form.grid.grid_connected_operational} onChange={(v) => updateField('grid.grid_connected_operational', v)} />
          <YesNoField label="Grid stable" value={form.grid.grid_stable} onChange={(v) => updateField('grid.grid_stable', v)} />
          {renderSectionPhotos('grid')}
          {renderSectionNotes('grid')}
          {renderSectionScore('grid')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AVR (Automatic Voltage Regulator)</Text>
          <YesNoField label="AVR physical status OK" value={form.avr.physical_status_ok} onChange={(v) => updateField('avr.physical_status_ok', v)} />
          <YesNoField label="AVR input/output measured" value={form.avr.input_output_measured} onChange={(v) => updateField('avr.input_output_measured', v)} />
          {renderSectionPhotos('avr')}
          {renderSectionNotes('avr')}
          {renderSectionScore('avr')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fuel Tank</Text>
          <TextField label="Tank height (cm)" value={form.fuel_tank.capacity_height_cm} onChange={(v) => updateField('fuel_tank.capacity_height_cm', v)} keyboardType="numeric" />
          <TextField label="Tank width (cm)" value={form.fuel_tank.capacity_width_cm} onChange={(v) => updateField('fuel_tank.capacity_width_cm', v)} keyboardType="numeric" />
          <TextField label="Tank depth (cm)" value={form.fuel_tank.capacity_depth_cm} onChange={(v) => updateField('fuel_tank.capacity_depth_cm', v)} keyboardType="numeric" />
          <TextField label="Quantity found" value={form.fuel_tank.quantity_found} onChange={(v) => updateField('fuel_tank.quantity_found', v)} keyboardType="numeric" />
          <TextField label="Quantity refueled" value={form.fuel_tank.quantity_refueled} onChange={(v) => updateField('fuel_tank.quantity_refueled', v)} keyboardType="numeric" />
          <YesNoField label="Fuel tank cap firmly closed and attached to NOC monitoring" value={form.fuel_tank.cap_closed_attached} onChange={(v) => updateField('fuel_tank.cap_closed_attached', v)} />
          <YesNoField label="Water separator available and filter changed" value={form.fuel_tank.water_separator_filter_changed} onChange={(v) => updateField('fuel_tank.water_separator_filter_changed', v)} />
          <YesNoField label="Fuel pipes checked for leakage" value={form.fuel_tank.fuel_pipes_leak_checked} onChange={(v) => updateField('fuel_tank.fuel_pipes_leak_checked', v)} />
          <YesNoField label="Fuel tank connected to earthing system" value={form.fuel_tank.connected_to_earthing} onChange={(v) => updateField('fuel_tank.connected_to_earthing', v)} />
          <YesNoField label="Security issued fuel certificate before refueling" value={form.fuel_tank.fuel_certificate_issued} onChange={(v) => updateField('fuel_tank.fuel_certificate_issued', v)} />
          {renderSectionPhotos('fuel_tank')}
          {renderSectionNotes('fuel_tank')}
          {renderSectionScore('fuel_tank')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Air Conditioning</Text>
          <TextField label="AC type (Window/Split)" value={form.air_conditioning.ac_type} onChange={(v) => updateField('air_conditioning.ac_type', v)} />
          <YesNoField label="Internal filter cleaned" value={form.air_conditioning.internal_filter_cleaned} onChange={(v) => updateField('air_conditioning.internal_filter_cleaned', v)} />
          <YesNoField label="Outdoor compressor cleaned" value={form.air_conditioning.outdoor_compressor_cleaned} onChange={(v) => updateField('air_conditioning.outdoor_compressor_cleaned', v)} />
          <YesNoField label="High and low pressure measured" value={form.air_conditioning.high_low_pressure_measured} onChange={(v) => updateField('air_conditioning.high_low_pressure_measured', v)} />
          <TextField label="Recorded temperature within shelter" value={form.air_conditioning.temperature_recorded} onChange={(v) => updateField('air_conditioning.temperature_recorded', v)} />
          <YesNoField label="Consumed amps measured" value={form.air_conditioning.amps_measured} onChange={(v) => updateField('air_conditioning.amps_measured', v)} />
          <YesNoField label="Condenser coils & evaporator cleaned" value={form.air_conditioning.condenser_evaporator_cleaned} onChange={(v) => updateField('air_conditioning.condenser_evaporator_cleaned', v)} />
          <YesNoField label="Outdoor fan motor & blades checked" value={form.air_conditioning.outdoor_fan_checked} onChange={(v) => updateField('air_conditioning.outdoor_fan_checked', v)} />
          {renderSectionPhotos('air_conditioning')}
          {renderSectionNotes('air_conditioning')}
          {renderSectionScore('air_conditioning')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Canopy Status</Text>
          <YesNoField label="Canopy checked for rust" value={form.canopy.rust_checked} onChange={(v) => updateField('canopy.rust_checked', v)} />
          <YesNoField label="Lighting and sockets working" value={form.canopy.lighting_sockets_working} onChange={(v) => updateField('canopy.lighting_sockets_working', v)} />
          <YesNoField label="Roofing sheets in good status" value={form.canopy.roofing_sheets_good} onChange={(v) => updateField('canopy.roofing_sheets_good', v)} />
          <YesNoField label="Canopy connected to earthing system" value={form.canopy.connected_to_earthing} onChange={(v) => updateField('canopy.connected_to_earthing', v)} />
          <YesNoField label="Canopy structure firmly fixed & stable" value={form.canopy.structure_stable} onChange={(v) => updateField('canopy.structure_stable', v)} />
          <YesNoField label="Foundation has no cracks" value={form.canopy.foundation_no_cracks} onChange={(v) => updateField('canopy.foundation_no_cracks', v)} />
          <YesNoField label="Cracks rectified (if found)" value={form.canopy.foundation_cracks_rectified} onChange={(v) => updateField('canopy.foundation_cracks_rectified', v)} />
          {renderSectionPhotos('canopy')}
          {renderSectionNotes('canopy')}
          {renderSectionScore('canopy')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cable & Cable Tray</Text>
          <YesNoField label="Cable tray checked for rust" value={form.cable_tray.rust_checked} onChange={(v) => updateField('cable_tray.rust_checked', v)} />
          <YesNoField label="Cable tray fixed firmly" value={form.cable_tray.fixed_firmly} onChange={(v) => updateField('cable_tray.fixed_firmly', v)} />
          <YesNoField label="Cable section checked" value={form.cable_tray.cable_section_checked} onChange={(v) => updateField('cable_tray.cable_section_checked', v)} />
          <YesNoField label="Cable tray connected to earthing system" value={form.cable_tray.connected_to_earthing} onChange={(v) => updateField('cable_tray.connected_to_earthing', v)} />
          <YesNoField label="Cables tightened" value={form.cable_tray.cables_tightened} onChange={(v) => updateField('cable_tray.cables_tightened', v)} />
          <YesNoField label="Cables have lugs" value={form.cable_tray.cables_have_lugs} onChange={(v) => updateField('cable_tray.cables_have_lugs', v)} />
          {renderSectionPhotos('cable_tray')}
          {renderSectionNotes('cable_tray')}
          {renderSectionScore('cable_tray')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fence</Text>
          <TextField label="Fence type (Palisade / wire mesh)" value={form.fence.fence_type} onChange={(v) => updateField('fence.fence_type', v)} />
          <YesNoField label="Fence checked for rust" value={form.fence.rust_checked} onChange={(v) => updateField('fence.rust_checked', v)} />
          <YesNoField label="No anomaly for easy access" value={form.fence.no_anomaly_access} onChange={(v) => updateField('fence.no_anomaly_access', v)} />
          <YesNoField label="Gate locking system operational" value={form.fence.gate_locking_operational} onChange={(v) => updateField('fence.gate_locking_operational', v)} />
          <YesNoField label="Razor wire available and maintained" value={form.fence.razor_wire_available} onChange={(v) => updateField('fence.razor_wire_available', v)} />
          <YesNoField label="Fence connected to earthing system" value={form.fence.connected_to_earthing} onChange={(v) => updateField('fence.connected_to_earthing', v)} />
          {renderSectionPhotos('fence')}
          {renderSectionNotes('fence')}
          {renderSectionScore('fence')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Power System - Rectifiers</Text>
          <TextField label="Rectifier modules found" value={form.power_rectifiers.modules_found} onChange={(v) => updateField('power_rectifiers.modules_found', v)} keyboardType="numeric" />
          <TextField label="Rectifier modules missing" value={form.power_rectifiers.modules_missing} onChange={(v) => updateField('power_rectifiers.modules_missing', v)} keyboardType="numeric" />
          <TextField label="Rectifier type & capacity" value={form.power_rectifiers.rectifier_type_capacity} onChange={(v) => updateField('power_rectifiers.rectifier_type_capacity', v)} />
          <YesNoField label="Breakers checked" value={form.power_rectifiers.breakers_checked} onChange={(v) => updateField('power_rectifiers.breakers_checked', v)} />
          <TextField label="Rectifier output voltage" value={form.power_rectifiers.output_voltage} onChange={(v) => updateField('power_rectifiers.output_voltage', v)} />
          <YesNoField label="Cabling status good" value={form.power_rectifiers.cabling_status_good} onChange={(v) => updateField('power_rectifiers.cabling_status_good', v)} />
          {renderSectionPhotos('power_rectifiers')}
          {renderSectionNotes('power_rectifiers')}
          {renderSectionScore('power_rectifiers')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Power System - Batteries</Text>
          <TextField label="Batteries count" value={form.power_batteries.batteries_count} onChange={(v) => updateField('power_batteries.batteries_count', v)} keyboardType="numeric" />
          <TextField label="Unit battery capacity" value={form.power_batteries.unit_battery_capacity} onChange={(v) => updateField('power_batteries.unit_battery_capacity', v)} />
          <YesNoField label="All batteries output checked" value={form.power_batteries.output_checked} onChange={(v) => updateField('power_batteries.output_checked', v)} />
          <YesNoField label="Autonomy test performed" value={form.power_batteries.autonomy_test_done} onChange={(v) => updateField('power_batteries.autonomy_test_done', v)} />
          <TextField label="Autonomy estimated (if no test)" value={form.power_batteries.autonomy_estimated} onChange={(v) => updateField('power_batteries.autonomy_estimated', v)} />
          {renderSectionPhotos('power_batteries')}
          {renderSectionNotes('power_batteries')}
          {renderSectionScore('power_batteries')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooling System for Power Cabinet</Text>
          <YesNoField label="Outdoor cabinet temperature checked" value={form.cooling_system_cabinet.temperature_checked} onChange={(v) => updateField('cooling_system_cabinet.temperature_checked', v)} />
          <YesNoField label="Signs of accumulated water within cabinet" value={form.cooling_system_cabinet.water_accumulation_signs} onChange={(v) => updateField('cooling_system_cabinet.water_accumulation_signs', v)} />
          {renderSectionPhotos('cooling_system_cabinet')}
          {renderSectionNotes('cooling_system_cabinet')}
          {renderSectionScore('cooling_system_cabinet')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solar System - Batteries</Text>
          <TextField label="Batteries count" value={form.solar_batteries.batteries_count} onChange={(v) => updateField('solar_batteries.batteries_count', v)} keyboardType="numeric" />
          <TextField label="Unit battery capacity" value={form.solar_batteries.unit_capacity} onChange={(v) => updateField('solar_batteries.unit_capacity', v)} />
          <YesNoField label="Battery outputs checked" value={form.solar_batteries.output_checked} onChange={(v) => updateField('solar_batteries.output_checked', v)} />
          <YesNoField label="Autonomy test performed" value={form.solar_batteries.autonomy_test_done} onChange={(v) => updateField('solar_batteries.autonomy_test_done', v)} />
          <TextField label="Autonomy estimated (if no test)" value={form.solar_batteries.autonomy_estimated} onChange={(v) => updateField('solar_batteries.autonomy_estimated', v)} />
          {renderSectionPhotos('solar_batteries')}
          {renderSectionNotes('solar_batteries')}
          {renderSectionScore('solar_batteries')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solar Panels</Text>
          <YesNoField label="Output checked before cleaning" value={form.solar_panels.output_checked_before_clean} onChange={(v) => updateField('solar_panels.output_checked_before_clean', v)} />
          <YesNoField label="All solar panels cleaned" value={form.solar_panels.panels_cleaned} onChange={(v) => updateField('solar_panels.panels_cleaned', v)} />
          <YesNoField label="Connections / DB box / DC cables checked" value={form.solar_panels.connections_checked} onChange={(v) => updateField('solar_panels.connections_checked', v)} />
          {renderSectionPhotos('solar_panels')}
          {renderSectionNotes('solar_panels')}
          {renderSectionScore('solar_panels')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earthing System</Text>
          <YesNoField label="Earth resistance measured" value={form.earthing_system.earth_resistance_measured} onChange={(v) => updateField('earthing_system.earth_resistance_measured', v)} />
          <TextField label="Earth resistance value" value={form.earthing_system.earth_resistance_value} onChange={(v) => updateField('earthing_system.earth_resistance_value', v)} />
          <YesNoField label="Less than 5 ohms" value={form.earthing_system.less_than_5_ohms} onChange={(v) => updateField('earthing_system.less_than_5_ohms', v)} />
          <TextField label="Action if above 5 ohms" value={form.earthing_system.action_if_above_5} onChange={(v) => updateField('earthing_system.action_if_above_5', v)} />
          {renderSectionPhotos('earthing_system')}
          {renderSectionNotes('earthing_system')}
          {renderSectionScore('earthing_system')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alarms System</Text>
          <YesNoField label="Temperature sensor status OK" value={form.alarms_system.temp_sensor_ok} onChange={(v) => updateField('alarms_system.temp_sensor_ok', v)} />
          <YesNoField label="Power sensor status OK" value={form.alarms_system.power_sensor_ok} onChange={(v) => updateField('alarms_system.power_sensor_ok', v)} />
          <YesNoField label="Gate locking sensor OK" value={form.alarms_system.gate_lock_sensor_ok} onChange={(v) => updateField('alarms_system.gate_lock_sensor_ok', v)} />
          <YesNoField label="Fuel sensor OK" value={form.alarms_system.fuel_sensor_ok} onChange={(v) => updateField('alarms_system.fuel_sensor_ok', v)} />
          <YesNoField label="Fuel tank sensors OK (flap opening & fuel level)" value={form.alarms_system.fuel_tank_sensors_ok} onChange={(v) => updateField('alarms_system.fuel_tank_sensors_ok', v)} />
          <YesNoField label="External alarms wired" value={form.alarms_system.external_alarms_wired} onChange={(v) => updateField('alarms_system.external_alarms_wired', v)} />
          <YesNoField label="Alarms reported to monitoring" value={form.alarms_system.alarms_reporting} onChange={(v) => updateField('alarms_system.alarms_reporting', v)} />
          <TextField label="If not, why?" value={form.alarms_system.alarms_not_reporting_reason} onChange={(v) => updateField('alarms_system.alarms_not_reporting_reason', v)} />
          {renderSectionPhotos('alarms_system')}
          {renderSectionNotes('alarms_system')}
          {renderSectionScore('alarms_system')}
        </View>

        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <TextField label="Subcontractor signature" value={form.signatures.subcontractor_signature} onChange={(v) => updateField('signatures.subcontractor_signature', v)} />
          <TextField label="IHS Audit Technician signature" value={form.signatures.audit_technician_signature} onChange={(v) => updateField('signatures.audit_technician_signature', v)} />
          <TextField label="Regional Manager signature" value={form.signatures.regional_manager_signature} onChange={(v) => updateField('signatures.regional_manager_signature', v)} />
          {renderSectionPhotos('signatures')}
        </View> */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <PhotoCapture label="Site photos" photos={photos} onAddPhoto={addPhoto} onRemovePhoto={removePhoto} />
          {renderSectionNotes('general')}
          {renderSectionScore('general')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Grading</Text>
          <Text style={styles.label}>Total Score (sum of section scores)</Text>
          <Text style={styles.totalScore}>{totalScore.toFixed(2)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            placeholder="Write any additional observations"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={saveDraft}>
            <Text style={styles.secondaryButtonText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={submitAudit}>
            <Text style={styles.primaryButtonText}>Submit Audit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
  },
  title: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputReadOnly: {
    backgroundColor: Colors.lightGray,
    color: Colors.textSecondary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  totalScore: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleText: {
    color: Colors.text,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  actions: {
    marginTop: 20,
    marginBottom: 40,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
});
