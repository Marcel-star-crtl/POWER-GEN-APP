import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { SafeAreaView } from "react-native-safe-area-context";
import {
    PhotoAttachment,
    PhotoCapture,
} from "../../../components/ui/PhotoCapture";
import { Colors } from "../../../constants/Colors";
import { api, uploadAPI } from "../../../services/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CheckValue = "satisfactory" | "unsatisfactory" | "na" | null;

interface CheckItem {
  id: string;
  label: string;
  value: CheckValue;
}

interface HSEFormState {
  site_name: string;
  site_id: string;
  site_type: string; // Rooftop / Greenfield / Other
  inspected_by: string;
  date: string;
  housekeeping: CheckItem[];
  electrical_safety: CheckItem[];
  evacuation_fire: CheckItem[];
  other_items: CheckItem[];
  comments: string;
  photos: PhotoAttachment[];
}

// ─────────────────────────────────────────────
// Static checklist definitions
// ─────────────────────────────────────────────
const HOUSEKEEPING_ITEMS = [
  "Floor and aisles are free of litter and spilled liquids (paint, grass, paper, etc.)",
  "Site free of abandoned items (equipment, building materials, shoes, clothes, household equipment, etc.)",
  "Site ID and Emergency Plates present and readable",
  "Security guard present on site",
  "Site Access (Locks, roof ladder, caged ladder rungs, window opening, etc.)",
  "General Site structure (Shelter roofing, lighting, grid poles, walls, etc.)",
  "Site Aviation light",
  "Site Lightening (Present, Faulty, Absent)",
];

const ELECTRICAL_SAFETY_ITEMS = [
  "All extension cords and cables are covered and insulated",
  "Extension cords and cables pass through cable trays and are not lingered on site",
];

const EVACUATION_FIRE_ITEMS = [
  "Site exits function properly",
  "Fire extinguishers are present on site",
  "Fire extinguishers are identified with signs and not blocked",
  "FEs are in good condition and verified (Pressure Gauge, Nozzle, Lever, etc.)",
];

const OTHER_ITEMS = [
  "Areas around Generator and Fuel Tank are clean and tidy (Traces of Oil, leaks, Spills > 30L, etc.)",
  "Employees are refraining from unsafe behaviors (standing on chairs, etc.)",
  "Warning signs are posted near hazards (explosive, electrical risk, etc.)",
];

const buildCheckItems = (labels: string[]): CheckItem[] =>
  labels.map((label, i) => ({ id: String(i), label, value: null }));

const buildInitialForm = (siteId: string, siteName: string): HSEFormState => ({
  site_name: siteName || "",
  site_id: siteId || "",
  site_type: "",
  inspected_by: "",
  date: new Date().toISOString().split("T")[0],
  housekeeping: buildCheckItems(HOUSEKEEPING_ITEMS),
  electrical_safety: buildCheckItems(ELECTRICAL_SAFETY_ITEMS),
  evacuation_fire: buildCheckItems(EVACUATION_FIRE_ITEMS),
  other_items: buildCheckItems(OTHER_ITEMS),
  comments: "",
  photos: [],
});

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const SectionHeader = ({
  title,
  color = "#c0392b",
}: {
  title: string;
  color?: string;
}) => (
  <View style={[sectionStyles.header, { backgroundColor: color }]}>
    <Text style={sectionStyles.headerText}>{title}</Text>
  </View>
);

const ColumnHeaders = () => (
  <View style={sectionStyles.columnRow}>
    <View style={sectionStyles.labelCol} />
    <Text style={sectionStyles.colHeader}>Satisfactory</Text>
    <Text style={sectionStyles.colHeader}>Unsatisfactory</Text>
    <Text style={sectionStyles.colHeader}>N/A</Text>
  </View>
);

const CheckRow = ({
  item,
  index,
  onChange,
}: {
  item: CheckItem;
  index: number;
  onChange: (val: CheckValue) => void;
}) => {
  const bg = index % 2 === 0 ? "#fff" : "#f9f9f9";
  return (
    <View style={[sectionStyles.row, { backgroundColor: bg }]}>
      <Text
        style={sectionStyles.rowLabel}
      >{`${index + 1}. ${item.label}`}</Text>
      {(["satisfactory", "unsatisfactory", "na"] as CheckValue[]).map((val) => (
        <TouchableOpacity
          key={val}
          style={sectionStyles.checkCell}
          onPress={() => onChange(item.value === val ? null : val)}
        >
          <View
            style={[
              sectionStyles.checkbox,
              item.value === val && sectionStyles.checkboxChecked,
              item.value === val &&
                val === "unsatisfactory" &&
                sectionStyles.checkboxDanger,
            ]}
          >
            {item.value === val && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const ChecklistSection = ({
  title,
  items,
  onUpdate,
  color,
}: {
  title: string;
  items: CheckItem[];
  onUpdate: (updated: CheckItem[]) => void;
  color?: string;
}) => {
  const updateItem = (index: number, val: CheckValue) => {
    const arr = [...items];
    arr[index] = { ...arr[index], value: val };
    onUpdate(arr);
  };

  return (
    <View style={sectionStyles.section}>
      <SectionHeader title={title} color={color} />
      <ColumnHeaders />
      {items.map((item, i) => (
        <CheckRow
          key={item.id}
          item={item}
          index={i}
          onChange={(v) => updateItem(i, v)}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function HSEInspectionForm() {
  const { siteId, siteName } = useLocalSearchParams<{
    siteId: string;
    siteName: string;
  }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<HSEFormState>(() =>
    buildInitialForm(siteId || "", siteName || ""),
  );

  const draftKey = useMemo(() => `hse_inspection_draft_${siteId}`, [siteId]);

  // ── Load draft ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const draftStr = await AsyncStorage.getItem(draftKey);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          setForm(
            draft.payload || buildInitialForm(siteId || "", siteName || ""),
          );
        }
      } catch (e) {
        console.error("Failed to load HSE draft", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [draftKey, siteId, siteName]);

  const updateSection = useCallback(
    (key: keyof HSEFormState, items: CheckItem[]) => {
      setForm((prev) => ({ ...prev, [key]: items }));
    },
    [],
  );

  const updateField = useCallback((key: keyof HSEFormState, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Completion stats ──────────────────────────
  const completionStats = useMemo(() => {
    const allItems = [
      ...form.housekeeping,
      ...form.electrical_safety,
      ...form.evacuation_fire,
      ...form.other_items,
    ];
    const total = allItems.length;
    const filled = allItems.filter((i) => i.value !== null).length;
    const unsatisfactory = allItems.filter(
      (i) => i.value === "unsatisfactory",
    ).length;
    return {
      total,
      filled,
      unsatisfactory,
      pct: total > 0 ? Math.round((filled / total) * 100) : 0,
    };
  }, [form]);

  // ── Save draft ────────────────────────────────
  const saveDraft = useCallback(async () => {
    try {
      let processedPhotos = form.photos;
      if (
        form.photos.some(
          (p) => p.uri.startsWith("file://") || p.uri.startsWith("content://"),
        )
      ) {
        processedPhotos = await uploadAPI.processAndUploadData(form.photos);
      }
      const payload = { ...form, photos: processedPhotos };
      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({
          payload,
          updatedAt: new Date().toISOString(),
          siteId,
        }),
      );

      try {
        await api.post("/technician/hse-inspection", {
          ...payload,
          status: "draft",
        });
        Alert.alert("Draft Saved", "Saved and synced to server.");
      } catch {
        Alert.alert("Draft Saved", "Saved locally. Will sync when online.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save draft.");
    }
  }, [draftKey, form, siteId]);

  // ── Submit ────────────────────────────────────
  const submitForm = useCallback(async () => {
    if (!form.site_id) {
      Alert.alert("Missing Info", "Site ID is required.");
      return;
    }
    setSubmitting(true);
    try {
      let processedPhotos = form.photos;
      if (form.photos.length > 0) {
        processedPhotos = await uploadAPI.processAndUploadData(form.photos);
      }
      const payload = { ...form, photos: processedPhotos, status: "submitted" };

      await api.post("/technician/hse-inspection", payload);
      await AsyncStorage.removeItem(draftKey);

      Alert.alert("Submitted", "HSE inspection submitted successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/(technician)/dashboard"),
        },
      ]);
    } catch (e: any) {
      console.error("HSE submit error", e);
      Alert.alert("Submission Failed", "Your data has been saved as a draft.");
      await saveDraft();
    } finally {
      setSubmitting(false);
    }
  }, [draftKey, form, router, saveDraft]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading form...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>HSE Inspection</Text>
          <Text style={styles.headerSubtitle}>{form.site_name || siteId}</Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{completionStats.pct}%</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Version Banner */}
          <View style={styles.versionBanner}>
            <Text style={styles.versionText}>SIIC HSE – v02 2026</Text>
          </View>

          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.formTitle}>
              Site Integrity Inspection Checklist
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${completionStats.pct}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {completionStats.filled}/{completionStats.total} items completed
              {completionStats.unsatisfactory > 0 && (
                <Text style={styles.progressWarning}>
                  {" "}
                  • {completionStats.unsatisfactory} unsatisfactory
                </Text>
              )}
            </Text>
          </View>

          {/* ── SITE INFORMATION ── */}
          <View style={sectionStyles.section}>
            <SectionHeader title="Site Information" color="#c0392b" />
            <View style={styles.siteInfoGrid}>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Site Name</Text>
                <TextInput
                  style={styles.siteInfoInput}
                  value={form.site_name}
                  onChangeText={(v) => updateField("site_name", v)}
                  placeholder="Site name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Site ID</Text>
                <TextInput
                  style={[styles.siteInfoInput, styles.readOnly]}
                  value={form.site_id}
                  editable={false}
                />
              </View>
            </View>

            <Text style={styles.siteInfoLabel}>Type</Text>
            <View style={styles.typeRow}>
              {["Rooftop", "Greenfield", "Other"].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.typeButton,
                    form.site_type === opt && styles.typeButtonActive,
                  ]}
                  onPress={() => updateField("site_type", opt)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      form.site_type === opt && styles.typeButtonTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.siteInfoGrid}>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Inspected By</Text>
                <TextInput
                  style={styles.siteInfoInput}
                  value={form.inspected_by}
                  onChangeText={(v) => updateField("inspected_by", v)}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Date</Text>
                <TextInput
                  style={styles.siteInfoInput}
                  value={form.date}
                  onChangeText={(v) => updateField("date", v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* ── HOUSEKEEPING ── */}
          <ChecklistSection
            title="Housekeeping"
            items={form.housekeeping}
            onUpdate={(items) => updateSection("housekeeping", items)}
            color="#2c3e50"
          />

          {/* ── ELECTRICAL SAFETY ── */}
          <ChecklistSection
            title="Electrical Safety"
            items={form.electrical_safety}
            onUpdate={(items) => updateSection("electrical_safety", items)}
            color="#2c3e50"
          />

          {/* ── EVACUATION / FIRE ── */}
          <ChecklistSection
            title="Evacuation/Fire"
            items={form.evacuation_fire}
            onUpdate={(items) => updateSection("evacuation_fire", items)}
            color="#2c3e50"
          />

          {/* ── OTHER INSPECTION ITEMS ── */}
          <ChecklistSection
            title="Other Inspection Items"
            items={form.other_items}
            onUpdate={(items) => updateSection("other_items", items)}
            color="#2c3e50"
          />

          {/* ── COMMENTS ── */}
          <View style={sectionStyles.section}>
            <SectionHeader title="Comments" color="#2c3e50" />
            <TextInput
              style={styles.commentsInput}
              value={form.comments}
              onChangeText={(v) => updateField("comments", v)}
              placeholder="Write any additional comments or observations..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* ── PHOTOS ── */}
          <View style={[sectionStyles.section, { marginBottom: 12 }]}>
            <SectionHeader title="Evidence Photos" color="#2c3e50" />
            <View style={{ padding: 12 }}>
              <PhotoCapture
                label="Attach inspection photos"
                photos={form.photos}
                onAddPhoto={(p) => updateField("photos", [...form.photos, p])}
                onRemovePhoto={(uri) =>
                  updateField(
                    "photos",
                    form.photos.filter((p) => p.uri !== uri),
                  )
                }
              />
            </View>
          </View>

          {/* ── ACTIONS ── */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.draftButton}
              onPress={saveDraft}
              disabled={submitting}
            >
              <Ionicons
                name="save-outline"
                size={18}
                color={Colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.draftButtonText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={submitForm}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitButtonText}>Submit Inspection</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Section styles (table-like layout)
// ─────────────────────────────────────────────
const sectionStyles = StyleSheet.create({
  section: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  header: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  columnRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 6,
  },
  labelCol: { flex: 3 },
  colHeader: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: "#555",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    minHeight: 48,
  },
  rowLabel: {
    flex: 3,
    fontSize: 12,
    color: "#333",
    lineHeight: 16,
    paddingRight: 6,
  },
  checkCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkboxDanger: {
    backgroundColor: Colors.danger ?? "#e74c3c",
    borderColor: Colors.danger ?? "#e74c3c",
  },
});

// ─────────────────────────────────────────────
// Page styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: { marginTop: 10, color: Colors.textSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary },
  progressBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressBadgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  scroll: { padding: 12, paddingBottom: 60 },
  versionBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  versionText: { fontSize: 11, color: Colors.textSecondary },
  titleBlock: {
    backgroundColor: "#c0392b",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  formTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  progressContainer: { marginBottom: 12 },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  progressLabel: { fontSize: 12, color: Colors.textSecondary },
  progressWarning: { color: Colors.danger ?? "#e74c3c" },
  siteInfoGrid: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    paddingBottom: 0,
  },
  siteInfoItem: { flex: 1 },
  siteInfoLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginHorizontal: 12,
    marginTop: 8,
  },
  siteInfoInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: "#fff",
  },
  readOnly: { backgroundColor: Colors.background, color: Colors.textSecondary },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: { fontSize: 12, fontWeight: "500", color: Colors.text },
  typeButtonTextActive: { color: "#fff" },
  commentsInput: {
    margin: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: Colors.text,
    minHeight: 100,
    backgroundColor: "#fff",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  draftButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  draftButtonText: {
    color: Colors.textSecondary,
    fontWeight: "600",
    fontSize: 15,
  },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  submitButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
