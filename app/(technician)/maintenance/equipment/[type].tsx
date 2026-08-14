// app/(technician)/maintenance/equipment/[type].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormSection } from "../../../../components/ui/FormSection";
import { InputField } from "../../../../components/ui/InputField";
import {
  PhotoAttachment,
  PhotoCapture,
} from "../../../../components/ui/PhotoCapture";
import { ProgressIndicator } from "../../../../components/ui/ProgressIndicator";
import { StatusToggle } from "../../../../components/ui/StatusToggle";
import { Colors } from "../../../../constants/Colors";
import { useAuth } from "../../../../context/AuthContext";
import { api, uploadAPI } from "../../../../services/api";
import { cachedGet } from "../../../../services/offlineApi";
import { isFuelRole, isRestrictedAcScopeRole } from "../../../../utils/roles";

const EQUIPMENT_TITLES: { [key: string]: string } = {
  generator: "Generator Check",
  power_cabinet: "Power Cabinet",
  grid: "Grid Power",
  shelter: "Shelter Inspection",
  fuel_tank: "Fuel Tank",
  cleaning: "Site Cleaning",
};

const GeneratorForm = ({
  onUpdate,
  siteId,
  value,
  hydrateKey,
}: {
  onUpdate: (data: any) => void;
  siteId?: string;
  value?: any;
  hydrateKey?: number;
}) => {
  const { t } = useTranslation();
  const getDefaultData = () => ({
    batteryStatus: null,
    batteryStatusComment: "",
    fanBeltStatus: null,
    fanBeltStatusComment: "",
    radiatorStatus: null,
    radiatorStatusComment: "",
    coolantStatus: null,
    coolantStatusComment: "",
    runningHours: "",
    fuelFilterChanged: null,
    fuelFilterChangedComment: "",
    oilFilterChanged: null,
    oilFilterChangedComment: "",
    airFilterChanged: null,
    airFilterChangedComment: "",
    oilLevelMax: null,
    oilLevelMaxComment: "",
    oilQualityChecked: null,
    oilQualityCheckedComment: "",
    fuelLeakageChecked: null,
    fuelLeakageCheckedComment: "",
    alarmsStatusChecked: null,
    alarmsStatusCheckedComment: "",
    i1: "",
    i2: "",
    i3: "",
    v1: "",
    v2: "",
    v3: "",
    comments: "",
    photos: [] as PhotoAttachment[],
  });

  const [data, setData] = useState(getDefaultData());
  const [generators, setGenerators] = useState<any[]>([]);
  const [selectedGenerator, setSelectedGenerator] = useState<any>(null);
  const [loadingGenerators, setLoadingGenerators] = useState(false);

  const fetchGenerators = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoadingGenerators(true);
      const { data: response } = await cachedGet(`/sites/${siteId}`);
      const siteData = response.data;
      if (
        siteData?.Current_Generators &&
        Array.isArray(siteData.Current_Generators)
      ) {
        setGenerators(siteData.Current_Generators);
        if (siteData.Current_Generators.length > 0) {
          setSelectedGenerator(siteData.Current_Generators[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching generators:", error);
    } finally {
      setLoadingGenerators(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchGenerators();
  }, [fetchGenerators]);

  useEffect(() => {
    if (!hydrateKey) return;
    if (!value || typeof value !== "object") return;
    const v: any = value;
    const incomingPhotos: any[] = Array.isArray(v.photos) ? v.photos : [];
    const photos: PhotoAttachment[] = incomingPhotos
      .map((p: any) => {
        if (!p) return null;
        if (typeof p === "string") {
          const uri = p;
          const name = uri.split("/").pop() || "photo.jpg";
          const type = name.toLowerCase().endsWith(".png")
            ? "image/png"
            : "image/jpeg";
          return { uri, name, type } as PhotoAttachment;
        }
        if (typeof p === "object" && typeof p.uri === "string")
          return p as PhotoAttachment;
        return null;
      })
      .filter(Boolean) as PhotoAttachment[];
    setData({ ...getDefaultData(), ...v, photos });
  }, [hydrateKey]);

  const update = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  const getPhotos = (tag: string) =>
    data.photos.filter((p) => p.name?.startsWith(tag));
  const addPhoto = (p: PhotoAttachment, tag: string) =>
    update("photos", [
      ...data.photos,
      { ...p, name: `${tag}_${p.name || "photo"}` },
    ]);
  const removePhoto = (uri: string) =>
    update(
      "photos",
      data.photos.filter((p) => p.uri !== uri),
    );

  return (
    <>
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={styles.iconContainer}>
              <Ionicons name="information" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.infoTitle}>
              {t("equipment_information", "Equipment Information")}
            </Text>
          </View>
        </View>

        {loadingGenerators ? (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Text style={{ color: Colors.textSecondary }}>
              {t("loading_generators", "Loading generators...")}
            </Text>
          </View>
        ) : generators.length === 0 ? (
          <View style={{ paddingVertical: 16, alignItems: "center", gap: 12 }}>
            <Text style={{ color: Colors.textSecondary, textAlign: "center" }}>
              {t("no_generators_found", "No generators found for this site")}
            </Text>
            <TouchableOpacity
              onPress={fetchGenerators}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                padding: 8,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 8,
              }}
            >
              <Ionicons name="refresh" size={16} color={Colors.primary} />
              <Text
                style={{
                  color: Colors.primary,
                  fontSize: 14,
                  fontWeight: "500",
                }}
              >
                {t("retry", "Retry")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {generators.length > 1 && (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: Colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {t("select_generator", "Select Generator")}
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
                  {generators.map((gen, idx) => (
                    <TouchableOpacity
                      key={gen._id || idx}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor:
                          selectedGenerator?._id === gen._id
                            ? Colors.primary
                            : Colors.border,
                        backgroundColor:
                          selectedGenerator?._id === gen._id
                            ? Colors.primary + "20"
                            : Colors.surface,
                      }}
                      onPress={() => setSelectedGenerator(gen)}
                    >
                      <Text
                        style={{
                          color:
                            selectedGenerator?._id === gen._id
                              ? Colors.primary
                              : Colors.text,
                          fontWeight:
                            selectedGenerator?._id === gen._id ? "600" : "400",
                        }}
                      >
                        {gen.model || `Generator ${idx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {t("equipment_id", "Equipment ID")}
                </Text>
                <Text style={styles.infoValue}>
                  {selectedGenerator?._id || t("not_available", "N/A")}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t("model", "Model")}</Text>
                <Text style={styles.infoValue}>
                  {selectedGenerator?.model || t("not_available", "N/A")}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {t("serial_number", "Serial Number")}
                </Text>
                <Text style={styles.infoValue}>
                  {selectedGenerator?.serial_number ||
                    t("not_available", "N/A")}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t("status", "Status")}</Text>
                <Text style={styles.infoValue}>
                  {selectedGenerator?.status || t("not_available", "N/A")}
                </Text>
              </View>
              {selectedGenerator?.specifications && (
                <>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      {t("capacity", "Capacity")}
                    </Text>
                    <Text style={styles.infoValue}>
                      {selectedGenerator.specifications.rated_power_kw ||
                        t("not_available", "N/A")}{" "}
                      kW
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      {t("fuel_type", "Fuel Type")}
                    </Text>
                    <Text style={styles.infoValue}>
                      {selectedGenerator.specifications.fuel_type ||
                        t("not_available", "N/A")}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </View>

      <FormSection title="Equipment Status" icon="checkmark-circle-outline">
        <StatusToggle
          label={t("battery", "Battery")}
          value={data.batteryStatus}
          onChange={(v) => update("batteryStatus", v)}
          warningLevel="critical"
          required
          comment={data.batteryStatusComment}
          onCommentChange={(v) => update("batteryStatusComment", v)}
        />
        <StatusToggle
          label={t("fan_belt", "Fan Belt")}
          value={data.fanBeltStatus}
          onChange={(v) => update("fanBeltStatus", v)}
          warningLevel="warning"
          required
          comment={data.fanBeltStatusComment}
          onCommentChange={(v) => update("fanBeltStatusComment", v)}
        />
        <StatusToggle
          label={t("radiator", "Radiator")}
          value={data.radiatorStatus}
          onChange={(v) => update("radiatorStatus", v)}
          warningLevel="critical"
          required
          comment={data.radiatorStatusComment}
          onCommentChange={(v) => update("radiatorStatusComment", v)}
        />
        <StatusToggle
          label={t("coolant_fluid", "Coolant Fluid")}
          value={data.coolantStatus}
          onChange={(v) => update("coolantStatus", v)}
          warningLevel="warning"
          required
          comment={data.coolantStatusComment}
          onCommentChange={(v) => update("coolantStatusComment", v)}
        />
      </FormSection>

      <FormSection
        title={t("additional_generator_checks", "Additional Generator Checks")}
        icon="construct-outline"
        collapsible
      >
        <InputField
          label={t("running_hours", "Running Hours")}
          value={data.runningHours}
          onChangeText={(v) => update("runningHours", v)}
          unit={t("hours_short", "hrs")}
          keyboardType="numeric"
        />
        <StatusToggle
          label={t("fuel_filter_changed", "Fuel Filter Changed")}
          value={data.fuelFilterChanged}
          onChange={(v) => update("fuelFilterChanged", v)}
          comment={data.fuelFilterChangedComment}
          onCommentChange={(v) => update("fuelFilterChangedComment", v)}
        />
        <StatusToggle
          label={t("oil_filter_changed", "Oil Filter Changed")}
          value={data.oilFilterChanged}
          onChange={(v) => update("oilFilterChanged", v)}
          comment={data.oilFilterChangedComment}
          onCommentChange={(v) => update("oilFilterChangedComment", v)}
        />
        <StatusToggle
          label={t("air_filter_changed", "Air Filter Changed")}
          value={data.airFilterChanged}
          onChange={(v) => update("airFilterChanged", v)}
          comment={data.airFilterChangedComment}
          onCommentChange={(v) => update("airFilterChangedComment", v)}
        />
        <StatusToggle
          label={t("oil_level_max", "Oil Level at Maximum")}
          value={data.oilLevelMax}
          onChange={(v) => update("oilLevelMax", v)}
          comment={data.oilLevelMaxComment}
          onCommentChange={(v) => update("oilLevelMaxComment", v)}
        />
        <StatusToggle
          label={t("oil_quality_checked", "Oil Quality Checked")}
          value={data.oilQualityChecked}
          onChange={(v) => update("oilQualityChecked", v)}
          comment={data.oilQualityCheckedComment}
          onCommentChange={(v) => update("oilQualityCheckedComment", v)}
        />
        <StatusToggle
          label={t("fuel_leakage_checked", "Fuel Leakage Checked")}
          value={data.fuelLeakageChecked}
          onChange={(v) => update("fuelLeakageChecked", v)}
          comment={data.fuelLeakageCheckedComment}
          onCommentChange={(v) => update("fuelLeakageCheckedComment", v)}
        />
        <StatusToggle
          label={t("alarms_status_checked", "Alarm Status Checked")}
          value={data.alarmsStatusChecked}
          onChange={(v) => update("alarmsStatusChecked", v)}
          comment={data.alarmsStatusCheckedComment}
          onCommentChange={(v) => update("alarmsStatusCheckedComment", v)}
        />
      </FormSection>

      <FormSection
        title={t("current_readings", "Current Readings")}
        icon="speedometer-outline"
      >
        <View style={styles.readingCard}>
          <InputField
            label={t("current_i1", "Current I1")}
            value={data.i1}
            onChangeText={(v) => update("i1", v)}
            unit="A"
            keyboardType="numeric"
            required
          />
          <PhotoCapture
            label={t("photo_i1_reading", "Photo of I1 Reading")}
            photos={getPhotos("I1")}
            onAddPhoto={(p) => addPhoto(p, "I1")}
            onRemovePhoto={removePhoto}
            maxPhotos={1}
            required
          />
        </View>
        <View style={styles.readingCard}>
          <InputField
            label={t("current_i2", "Current I2")}
            value={data.i2}
            onChangeText={(v) => update("i2", v)}
            unit="A"
            keyboardType="numeric"
            required
          />
          <PhotoCapture
            label={t("photo_i2_reading", "Photo of I2 Reading")}
            photos={getPhotos("I2")}
            onAddPhoto={(p) => addPhoto(p, "I2")}
            onRemovePhoto={removePhoto}
            maxPhotos={1}
            required
          />
        </View>
        <View style={styles.readingCard}>
          <InputField
            label={t("current_i3", "Current I3")}
            value={data.i3}
            onChangeText={(v) => update("i3", v)}
            unit="A"
            keyboardType="numeric"
            required
          />
          <PhotoCapture
            label={t("photo_i3_reading", "Photo of I3 Reading")}
            photos={getPhotos("I3")}
            onAddPhoto={(p) => addPhoto(p, "I3")}
            onRemovePhoto={removePhoto}
            maxPhotos={1}
            required
          />
        </View>
      </FormSection>

      <FormSection
        title={t("voltage_readings", "Voltage Readings")}
        icon="flash-outline"
      >
        <View style={styles.readingCard}>
          <InputField
            label={t("voltage_v1", "Voltage V1")}
            value={data.v1}
            onChangeText={(v) => update("v1", v)}
            unit="V"
            keyboardType="numeric"
            required
          />
          <PhotoCapture
            label={t("photo_v1_reading", "Photo of V1 Reading")}
            photos={getPhotos("V1")}
            onAddPhoto={(p) => addPhoto(p, "V1")}
            onRemovePhoto={removePhoto}
            maxPhotos={1}
            required
          />
        </View>
        <View style={styles.readingCard}>
          <InputField
            label={t("voltage_v2", "Voltage V2")}
            value={data.v2}
            onChangeText={(v) => update("v2", v)}
            unit="V"
            keyboardType="numeric"
            required
          />
          <PhotoCapture
            label={t("photo_v2_reading", "Photo of V2 Reading")}
            photos={getPhotos("V2")}
            onAddPhoto={(p) => addPhoto(p, "V2")}
            onRemovePhoto={removePhoto}
            maxPhotos={1}
            required
          />
        </View>
        <View style={styles.readingCard}>
          <InputField
            label={t("voltage_v3", "Voltage V3")}
            value={data.v3}
            onChangeText={(v) => update("v3", v)}
            unit="V"
            keyboardType="numeric"
            required
          />
          <PhotoCapture
            label={t("photo_v3_reading", "Photo of V3 Reading")}
            photos={getPhotos("V3")}
            onAddPhoto={(p) => addPhoto(p, "V3")}
            onRemovePhoto={removePhoto}
            maxPhotos={1}
            required
          />
        </View>
      </FormSection>

      <FormSection
        title={t("additional_notes", "Additional Notes")}
        icon="create-outline"
      >
        <InputField
          label=""
          placeholder={t(
            "additional_notes_placeholder",
            "Any additional observations, anomalies, or recommendations...",
          )}
          value={data.comments}
          onChangeText={(v) => update("comments", v)}
          multiline
          numberOfLines={4}
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />
      </FormSection>
    </>
  );
};

const PowerCabinetFormWithHydration = ({
  onUpdate,
  value,
  hydrateKey,
}: {
  onUpdate: (data: any) => void;
  value?: any;
  hydrateKey?: number;
}) => {
  const { t } = useTranslation();

  const TAB_RECTIFIER = "rectifier";
  const TAB_BATTERY = "battery";
  const TAB_COOLING = "cooling";
  const TAB_CONTROLLER = "controller";

  const [activeTab, setActiveTab] = useState(TAB_RECTIFIER);
  const [numRectifiers, setNumRectifiers] = useState("2");
  const [numBatteries, setNumBatteries] = useState("3");

  const [rectifiers, setRectifiers] = useState<any[]>(
    Array(2).fill({
      status: null,
      statusComment: "",
      cleanliness: null,
      cleanlinessComment: "",
      capacitor: "",
      comments: "",
      photos: [],
    }),
  );
  const [batteries, setBatteries] = useState<any[]>(
    Array(3).fill({ brand: "", autonomy: "", capacity: "" }),
  );
  const [cooling, setCooling] = useState<any>({ status: null, comments: "" });
  const [controller, setController] = useState<any>({
    status: null,
    comments: "",
  });
  const [rectifierSummary, setRectifierSummary] = useState({
    modulesFound: "",
    modulesMissing: "",
    rectifierTypeCapacity: "",
    outputVoltage: "",
    breakersChecked: null,
    cablingStatusGood: null,
  });
  const [batterySummary, setBatterySummary] = useState({
    outputChecked: null,
    autonomyTestDone: null,
    autonomyEstimated: "",
  });

  useEffect(() => {
    if (!hydrateKey) return;
    if (!value || typeof value !== "object") return;
    const v: any = value;
    setNumRectifiers(
      v.numRectifiers
        ? String(v.numRectifiers)
        : String((v.rectifiers || []).length || 0),
    );
    setNumBatteries(
      v.numBatteries
        ? String(v.numBatteries)
        : String((v.batteries || []).length || 0),
    );
    setRectifiers(
      Array.isArray(v.rectifiers)
        ? v.rectifiers.map((r: any) => ({
            status: r.status ?? null,
            statusComment: r.statusComment ?? r.status_comment ?? "",
            cleanliness: r.cleanliness ?? null,
            cleanlinessComment:
              r.cleanlinessComment ?? r.cleanliness_comment ?? "",
            capacitor: r.capacitor ?? "",
            comments: r.comments ?? "",
            photos: Array.isArray(r.photos)
              ? r.photos.map((p: any) =>
                  typeof p === "string"
                    ? { uri: p, name: p.split("/").pop() }
                    : p,
                )
              : [],
          }))
        : [],
    );
    setBatteries(
      Array.isArray(v.batteries)
        ? v.batteries.map((b: any) => ({
            brand: b.brand ?? "",
            autonomy: b.autonomy ?? "",
            capacity: b.capacity ?? "",
          }))
        : [],
    );
    setCooling(v.cooling ?? { status: null, comments: "" });
    setController(v.controller ?? { status: null, comments: "" });
    setRectifierSummary(
      v.rectifierSummary ?? {
        modulesFound: v.modulesFound ?? "",
        modulesMissing: v.modulesMissing ?? "",
        rectifierTypeCapacity: v.rectifierTypeCapacity ?? "",
        outputVoltage: v.outputVoltage ?? "",
        breakersChecked: v.breakersChecked ?? null,
        cablingStatusGood: v.cablingStatusGood ?? null,
      },
    );
    setBatterySummary(
      v.batterySummary ?? {
        outputChecked: v.outputChecked ?? null,
        autonomyTestDone: v.autonomyTestDone ?? null,
        autonomyEstimated: v.autonomyEstimated ?? "",
      },
    );
  }, [hydrateKey]);

  useEffect(() => {
    const n = parseInt(numRectifiers) || 0;
    if (n !== rectifiers.length) {
      const arr = [...rectifiers];
      if (n > arr.length)
        for (let i = arr.length; i < n; i++)
          arr.push({
            status: null,
            cleanliness: null,
            capacitor: "",
            comments: "",
            photos: [],
          });
      else arr.splice(n);
      setRectifiers(arr);
    }
  }, [numRectifiers]);

  useEffect(() => {
    const n = parseInt(numBatteries) || 0;
    if (n !== batteries.length) {
      const arr = [...batteries];
      if (n > arr.length)
        for (let i = arr.length; i < n; i++)
          arr.push({ brand: "", autonomy: "", capacity: "" });
      else arr.splice(n);
      setBatteries(arr);
    }
  }, [numBatteries]);

  useEffect(() => {
    onUpdate({
      rectifiers,
      batteries,
      cooling,
      controller,
      rectifierSummary,
      batterySummary,
      numRectifiers,
      numBatteries,
    });
  }, [
    rectifiers,
    batteries,
    cooling,
    controller,
    rectifierSummary,
    batterySummary,
    numRectifiers,
    numBatteries,
    onUpdate,
  ]);

  const updateRectifier = (i: number, key: string, val: any) => {
    const arr = [...rectifiers];
    arr[i] = { ...arr[i], [key]: val };
    setRectifiers(arr);
  };
  const addRectPhoto = (i: number, p: PhotoAttachment) => {
    const arr = [...rectifiers];
    arr[i].photos = [...(arr[i].photos || []), p];
    setRectifiers(arr);
  };
  const removeRectPhoto = (i: number, uri: string) => {
    const arr = [...rectifiers];
    arr[i].photos = arr[i].photos.filter((p: PhotoAttachment) => p.uri !== uri);
    setRectifiers(arr);
  };
  const updateBattery = (i: number, key: string, val: any) => {
    const arr = [...batteries];
    arr[i] = { ...arr[i], [key]: val };
    setBatteries(arr);
  };

  const tabs = [
    {
      id: TAB_RECTIFIER,
      label: t("rectifier_tab", "Rectifier"),
      icon: "flash",
    },
    {
      id: TAB_BATTERY,
      label: t("battery_tab", "Battery"),
      icon: "battery-full",
    },
    { id: TAB_COOLING, label: t("cooling_tab", "Cooling"), icon: "snow" },
    {
      id: TAB_CONTROLLER,
      label: t("controller_tab", "Controller"),
      icon: "speedometer",
    },
  ];

  return (
    <>
      <View style={styles.infoCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.iconContainer, { backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="battery-charging" size={24} color="#a855f7" />
          </View>
          <View>
            <Text style={styles.infoTitle}>
              {t("cabinet_info", "Cabinet Info")}
            </Text>
            <Text style={styles.infoValue}>PC-001-A • Alpha Power 48V</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={
                activeTab === tab.id ? Colors.primary : Colors.textSecondary
              }
              style={{ marginBottom: 4 }}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === TAB_RECTIFIER && (
          <>
            <FormSection
              title={t("configuration", "Configuration")}
              icon="settings-outline"
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 16, color: Colors.text }}>
                  {t("number_of_rectifiers", "Number of Rectifiers")}
                </Text>
                <TextInput
                  value={numRectifiers}
                  onChangeText={setNumRectifiers}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    width: 80,
                    textAlign: "center",
                    backgroundColor: "white",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                />
                <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                  {t("editable", "(editable)")}
                </Text>
              </View>
              <InputField
                label={t("rectifier_modules_found", "Rectifier Modules Found")}
                value={rectifierSummary.modulesFound}
                onChangeText={(v) =>
                  setRectifierSummary({ ...rectifierSummary, modulesFound: v })
                }
                keyboardType="numeric"
              />
              <InputField
                label={t(
                  "rectifier_modules_missing",
                  "Rectifier Modules Missing",
                )}
                value={rectifierSummary.modulesMissing}
                onChangeText={(v) =>
                  setRectifierSummary({
                    ...rectifierSummary,
                    modulesMissing: v,
                  })
                }
                keyboardType="numeric"
              />
              <InputField
                label={t(
                  "rectifier_type_capacity",
                  "Rectifier Type & Capacity",
                )}
                value={rectifierSummary.rectifierTypeCapacity}
                onChangeText={(v) =>
                  setRectifierSummary({
                    ...rectifierSummary,
                    rectifierTypeCapacity: v,
                  })
                }
              />
              <InputField
                label={t(
                  "rectifier_output_voltage",
                  "Rectifier Output Voltage",
                )}
                value={rectifierSummary.outputVoltage}
                onChangeText={(v) =>
                  setRectifierSummary({ ...rectifierSummary, outputVoltage: v })
                }
              />
              <StatusToggle
                label={t("breakers_checked", "Breakers Checked")}
                value={rectifierSummary.breakersChecked}
                onChange={(v) =>
                  setRectifierSummary({
                    ...rectifierSummary,
                    breakersChecked: v,
                  })
                }
              />
              <StatusToggle
                label={t("cabling_status_good", "Cabling Status Good")}
                value={rectifierSummary.cablingStatusGood}
                onChange={(v) =>
                  setRectifierSummary({
                    ...rectifierSummary,
                    cablingStatusGood: v,
                  })
                }
              />
            </FormSection>

            {rectifiers.map((rect, index) => (
              <FormSection
                key={index}
                title={`${t("rectifier", "Rectifier")} ${index + 1}`}
              >
                <StatusToggle
                  label={t("status", "Status")}
                  value={rect.status}
                  onChange={(v) => updateRectifier(index, "status", v)}
                  required
                  comment={rect.statusComment}
                  onCommentChange={(v) =>
                    updateRectifier(index, "statusComment", v)
                  }
                />
                <StatusToggle
                  label={t("cleanliness", "Cleanliness")}
                  value={rect.cleanliness}
                  onChange={(v) => updateRectifier(index, "cleanliness", v)}
                  required
                  comment={rect.cleanlinessComment}
                  onCommentChange={(v) =>
                    updateRectifier(index, "cleanlinessComment", v)
                  }
                />
                <InputField
                  label={t("capacitor", "Capacitor")}
                  value={rect.capacitor}
                  onChangeText={(v) => updateRectifier(index, "capacitor", v)}
                  unit="kW"
                  keyboardType="numeric"
                  required
                />
                <PhotoCapture
                  label={t("capacitor_photo", "Capacitor Photo")}
                  photos={rect.photos || []}
                  onAddPhoto={(p) => addRectPhoto(index, p)}
                  onRemovePhoto={(uri) => removeRectPhoto(index, uri)}
                  required
                  maxPhotos={1}
                />
                <InputField
                  label={t("comments", "Comments")}
                  placeholder={t(
                    "rectifier_comments_placeholder",
                    "Observations for this rectifier...",
                  )}
                  value={rect.comments}
                  onChangeText={(v) => updateRectifier(index, "comments", v)}
                  multiline
                />
              </FormSection>
            ))}
          </>
        )}

        {activeTab === TAB_BATTERY && (
          <>
            <FormSection
              title={t("configuration", "Configuration")}
              icon="settings-outline"
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 16, color: Colors.text }}>
                  {t("number_of_batteries", "Number of Batteries")}
                </Text>
                <TextInput
                  value={numBatteries}
                  onChangeText={setNumBatteries}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    width: 80,
                    textAlign: "center",
                    backgroundColor: "white",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                />
                <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                  {t("editable", "(editable)")}
                </Text>
              </View>
              <StatusToggle
                label={t("battery_output_checked", "Battery Output Checked")}
                value={batterySummary.outputChecked}
                onChange={(v) =>
                  setBatterySummary({ ...batterySummary, outputChecked: v })
                }
              />
              <StatusToggle
                label={t("autonomy_test_done", "Autonomy Test Done")}
                value={batterySummary.autonomyTestDone}
                onChange={(v) =>
                  setBatterySummary({ ...batterySummary, autonomyTestDone: v })
                }
              />
              <InputField
                label={t("autonomy_estimated", "Autonomy Estimated")}
                value={batterySummary.autonomyEstimated}
                onChangeText={(v) =>
                  setBatterySummary({ ...batterySummary, autonomyEstimated: v })
                }
                unit={t("hours_short", "hrs")}
                keyboardType="numeric"
              />
            </FormSection>

            {batteries.map((batt, index) => (
              <FormSection
                key={index}
                title={`${t("battery", "Battery")} ${index + 1}`}
              >
                <InputField
                  label={t("brand", "Brand")}
                  placeholder={t("brand_placeholder", "e.g., Samsung")}
                  value={batt.brand}
                  onChangeText={(v) => updateBattery(index, "brand", v)}
                  required
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <InputField
                      label={t("autonomy", "Autonomy")}
                      value={batt.autonomy}
                      onChangeText={(v) => updateBattery(index, "autonomy", v)}
                      unit={t("hours_short", "hrs")}
                      keyboardType="numeric"
                      required
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField
                      label={t("capacity", "Capacity")}
                      value={batt.capacity}
                      onChangeText={(v) => updateBattery(index, "capacity", v)}
                      unit={t("amp_hours", "Ah")}
                      keyboardType="numeric"
                      required
                    />
                  </View>
                </View>
              </FormSection>
            ))}
          </>
        )}

        {activeTab === TAB_COOLING && (
          <FormSection
            title={t("cooling_system", "Cooling System")}
            icon="snow-outline"
          >
            <StatusToggle
              label={t("cooling_system_status", "Cooling System Status")}
              value={cooling.status}
              onChange={(v) => setCooling({ ...cooling, status: v })}
              warningLevel="critical"
              required
              comment={cooling.comments}
              onCommentChange={(v) => setCooling({ ...cooling, comments: v })}
            />
          </FormSection>
        )}

        {activeTab === TAB_CONTROLLER && (
          <FormSection
            title={t("controller_check", "Controller Check")}
            icon="speedometer-outline"
          >
            <StatusToggle
              label={t("controller_status", "Controller Status")}
              value={controller.status}
              onChange={(v) => setController({ ...controller, status: v })}
              warningLevel="critical"
              required
              comment={controller.comments}
              onCommentChange={(v) =>
                setController({ ...controller, comments: v })
              }
            />
          </FormSection>
        )}
      </View>
    </>
  );
};

const GridFormWithHydration = ({
  onUpdate,
  value,
  hydrateKey,
}: {
  onUpdate: (data: any) => void;
  value?: any;
  hydrateKey?: number;
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    gridStatus: null,
    gridStatusComment: "",
    breakerStatus: null,
    breakerStatusComment: "",
    gridIndex: "",
    gridConnectedOperational: null,
    gridConnectedOperationalComment: "",
    gridStable: null,
    gridStableComment: "",
    photos: [] as PhotoAttachment[],
  });

  useEffect(() => {
    if (!hydrateKey) return;
    if (!value || typeof value !== "object") return;
    const v: any = value;
    const photos: PhotoAttachment[] = (Array.isArray(v.photos) ? v.photos : [])
      .map((p: any) => {
        if (!p) return null;
        if (typeof p === "string")
          return {
            uri: p,
            name: p.split("/").pop() || "photo.jpg",
            type: "image/jpeg",
          };
        if (typeof p === "object" && typeof p.uri === "string")
          return p as PhotoAttachment;
        return null;
      })
      .filter(Boolean) as PhotoAttachment[];
    setData({
      gridStatus: v.gridStatus ?? null,
      breakerStatus: v.breakerStatus ?? null,
      gridStatusComment: v.gridStatusComment ?? v.grid_status_comment ?? "",
      breakerStatusComment:
        v.breakerStatusComment ?? v.breaker_status_comment ?? "",
      gridIndex: v.gridIndex ?? "",
      gridConnectedOperational: v.gridConnectedOperational ?? null,
      gridConnectedOperationalComment:
        v.gridConnectedOperationalComment ??
        v.grid_connected_operational_comment ??
        "",
      gridStable: v.gridStable ?? null,
      gridStableComment: v.gridStableComment ?? v.grid_stable_comment ?? "",
      photos,
    });
  }, [hydrateKey]);

  const update = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  return (
    <>
      <FormSection title={t("grid_meter", "Grid Meter")} icon="image">
        <PhotoCapture
          label={t("grid_meter_photos", "Grid Meter Photos")}
          photos={data.photos}
          onAddPhoto={(p) => update("photos", [...data.photos, p])}
          onRemovePhoto={(uri) =>
            update(
              "photos",
              data.photos.filter((p) => p.uri !== uri),
            )
          }
        />
      </FormSection>
      <FormSection title={t("status", "Status")} icon="flash">
        <InputField
          label={t("grid_index", "Grid Index")}
          value={data.gridIndex}
          onChangeText={(v) => update("gridIndex", v)}
          keyboardType="numeric"
        />
        <StatusToggle
          label={t(
            "grid_connected_operational",
            "Grid Connected & Operational",
          )}
          value={data.gridConnectedOperational}
          onChange={(v) => update("gridConnectedOperational", v)}
          warningLevel="critical"
          comment={data.gridConnectedOperationalComment}
          onCommentChange={(v) => update("gridConnectedOperationalComment", v)}
        />
        <StatusToggle
          label={t("grid_stable", "Grid Stable")}
          value={data.gridStable}
          onChange={(v) => update("gridStable", v)}
          comment={data.gridStableComment}
          onCommentChange={(v) => update("gridStableComment", v)}
        />
        <StatusToggle
          label={t("grid_status", "Grid Status")}
          value={data.gridStatus}
          onChange={(v) => update("gridStatus", v)}
          warningLevel="critical"
          comment={data.gridStatusComment}
          onCommentChange={(v) => update("gridStatusComment", v)}
        />
        <StatusToggle
          label={t("grid_breaker", "Grid Breaker")}
          value={data.breakerStatus}
          onChange={(v) => update("breakerStatus", v)}
          comment={data.breakerStatusComment}
          onCommentChange={(v) => update("breakerStatusComment", v)}
        />
      </FormSection>
    </>
  );
};

const FuelTankForm = ({
  onUpdate,
  value,
  hydrateKey,
}: {
  onUpdate: (data: any) => void;
  value?: any;
  hydrateKey?: number;
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    tankStatus: null,
    tankStatusComment: "",
    separatingFilter: null,
    separatingFilterComment: "",
    waterInTank: null,
    waterInTankComment: "",
    fuelLine: null,
    fuelLineComment: "",
    isWaterproof: null,
    isWaterproofComment: "",
    comments: "",
  });

  useEffect(() => {
    if (!hydrateKey) return;
    if (!value || typeof value !== "object") return;
    const v: any = value;
    setData({
      tankStatus: v.tankStatus ?? null,
      separatingFilter: v.separatingFilter ?? null,
      waterInTank: v.waterInTank ?? null,
      fuelLine: v.fuelLine ?? null,
      isWaterproof: v.isWaterproof ?? null,
      tankStatusComment: v.tankStatusComment ?? v.status_comment ?? "",
      separatingFilterComment:
        v.separatingFilterComment ?? v.separating_filter_comment ?? "",
      waterInTankComment: v.waterInTankComment ?? v.water_in_tank_comment ?? "",
      fuelLineComment: v.fuelLineComment ?? v.fuel_line_comment ?? "",
      isWaterproofComment:
        v.isWaterproofComment ?? v.is_waterproof_comment ?? "",
      comments: v.comments ?? "",
    });
  }, [hydrateKey]);

  const update = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  return (
    <FormSection title={t("tank_inspection", "Tank Inspection")} icon="water">
      <StatusToggle
        label={t("tank_status", "Tank Status")}
        value={data.tankStatus}
        onChange={(v) => update("tankStatus", v)}
        comment={data.tankStatusComment}
        onCommentChange={(v) => update("tankStatusComment", v)}
      />
      <StatusToggle
        label={t("separating_filter", "Separating Filter")}
        value={data.separatingFilter}
        onChange={(v) => update("separatingFilter", v)}
        comment={data.separatingFilterComment}
        onCommentChange={(v) => update("separatingFilterComment", v)}
      />
      <StatusToggle
        label={t("water_in_tank", "Water in Tank?")}
        value={data.waterInTank}
        onChange={(v) => update("waterInTank", v)}
        warningLevel="critical"
        okLabel={t("no", "No")}
        nokLabel={t("yes", "Yes")}
        comment={data.waterInTankComment}
        onCommentChange={(v) => update("waterInTankComment", v)}
      />
      <StatusToggle
        label={t("fuel_line_status", "Fuel Line Status")}
        value={data.fuelLine}
        onChange={(v) => update("fuelLine", v)}
        comment={data.fuelLineComment}
        onCommentChange={(v) => update("fuelLineComment", v)}
      />
      <StatusToggle
        label={t("tank_waterproof", "Tank Waterproof?")}
        value={data.isWaterproof}
        onChange={(v) => update("isWaterproof", v)}
        okLabel={t("yes", "Yes")}
        nokLabel={t("no", "No")}
        comment={data.isWaterproofComment}
        onCommentChange={(v) => update("isWaterproofComment", v)}
      />
      <InputField
        label={t("comments", "Comments")}
        value={data.comments}
        onChangeText={(v) => update("comments", v)}
        multiline
      />
    </FormSection>
  );
};

const ShelterForm = ({
  onUpdate,
  value,
  hydrateKey,
}: {
  onUpdate: (data: any) => void;
  value?: any;
  hydrateKey?: number;
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    shelterStatus: null,
    shelterStatusComment: "",
    doorStatus: null,
    doorStatusComment: "",
    temperature: "",
    controllerStatus: null,
    controllerStatusComment: "",
    ac1Status: null,
    ac1Comments: "",
    ac2Status: null,
    ac2Comments: "",
    acType: "",
    internalFilterCleaned: null,
    internalFilterCleanedComment: "",
    outdoorCompressorCleaned: null,
    outdoorCompressorCleanedComment: "",
    highLowPressureMeasured: null,
    highLowPressureMeasuredComment: "",
    temperatureRecorded: "",
    temperatureRecordedComment: "",
    ampsMeasured: null,
    ampsMeasuredComment: "",
    condenserEvaporatorCleaned: null,
    condenserEvaporatorCleanedComment: "",
    outdoorFanChecked: null,
    outdoorFanCheckedComment: "",
  });

  useEffect(() => {
    if (!hydrateKey) return;
    if (!value || typeof value !== "object") return;
    const v: any = value;
    setData({
      shelterStatus: v.shelterStatus ?? null,
      doorStatus: v.doorStatus ?? null,
      temperature: v.temperature ?? "",
      controllerStatus: v.controllerStatus ?? null,
      ac1Status: v.ac1Status ?? null,
      ac2Status: v.ac2Status ?? null,
      shelterStatusComment: v.shelterStatusComment ?? v.status_comment ?? "",
      doorStatusComment: v.doorStatusComment ?? v.door_status_comment ?? "",
      controllerStatusComment:
        v.controllerStatusComment ?? v.controller_status_comment ?? "",
      ac1Comments:
        v.ac1Comments ??
        (Array.isArray(v.ac_units) ? v.ac_units[0]?.comments : "") ??
        "",
      ac2Comments:
        v.ac2Comments ??
        (Array.isArray(v.ac_units) ? v.ac_units[1]?.comments : "") ??
        "",
      acType: v.acType ?? v.ac_type ?? "",
      internalFilterCleaned:
        v.internalFilterCleaned ?? v.internal_filter_cleaned ?? null,
      internalFilterCleanedComment:
        v.internalFilterCleanedComment ??
        v.internal_filter_cleaned_comment ??
        "",
      outdoorCompressorCleaned:
        v.outdoorCompressorCleaned ?? v.outdoor_compressor_cleaned ?? null,
      outdoorCompressorCleanedComment:
        v.outdoorCompressorCleanedComment ??
        v.outdoor_compressor_cleaned_comment ??
        "",
      highLowPressureMeasured:
        v.highLowPressureMeasured ?? v.high_low_pressure_measured ?? null,
      highLowPressureMeasuredComment:
        v.highLowPressureMeasuredComment ??
        v.high_low_pressure_measured_comment ??
        "",
      temperatureRecorded:
        v.temperatureRecorded ?? v.temperature_recorded ?? "",
      temperatureRecordedComment:
        v.temperatureRecordedComment ?? v.temperature_recorded_comment ?? "",
      ampsMeasured: v.ampsMeasured ?? v.amps_measured ?? null,
      ampsMeasuredComment:
        v.ampsMeasuredComment ?? v.amps_measured_comment ?? "",
      condenserEvaporatorCleaned:
        v.condenserEvaporatorCleaned ?? v.condenser_evaporator_cleaned ?? null,
      condenserEvaporatorCleanedComment:
        v.condenserEvaporatorCleanedComment ??
        v.condenser_evaporator_cleaned_comment ??
        "",
      outdoorFanChecked: v.outdoorFanChecked ?? v.outdoor_fan_checked ?? null,
      outdoorFanCheckedComment:
        v.outdoorFanCheckedComment ?? v.outdoor_fan_checked_comment ?? "",
    });
  }, [hydrateKey]);

  const update = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  return (
    <>
      <FormSection
        title={t("shelter_condition", "Shelter Condition")}
        icon="home"
      >
        <StatusToggle
          label={t("shelter_status", "Shelter Status")}
          value={data.shelterStatus}
          onChange={(v) => update("shelterStatus", v)}
          comment={data.shelterStatusComment}
          onCommentChange={(v) => update("shelterStatusComment", v)}
        />
        <StatusToggle
          label={t("shelter_door", "Shelter Door")}
          value={data.doorStatus}
          onChange={(v) => update("doorStatus", v)}
          comment={data.doorStatusComment}
          onCommentChange={(v) => update("doorStatusComment", v)}
        />
      </FormSection>
      <FormSection
        title={t("air_conditioners", "Air Conditioners")}
        icon="snow"
      >
        <StatusToggle
          label={t("ac1_status", "AC 1 Status")}
          value={data.ac1Status}
          onChange={(v) => update("ac1Status", v)}
          comment={data.ac1Comments}
          onCommentChange={(v) => update("ac1Comments", v)}
        />
        <StatusToggle
          label={t("ac2_status", "AC 2 Status")}
          value={data.ac2Status}
          onChange={(v) => update("ac2Status", v)}
          comment={data.ac2Comments}
          onCommentChange={(v) => update("ac2Comments", v)}
        />
      </FormSection>
      <FormSection title={t("environment", "Environment")} icon="thermometer">
        <InputField
          label={t("temperature", "Temperature")}
          value={data.temperature}
          onChangeText={(v) => update("temperature", v)}
          unit="°C"
          keyboardType="numeric"
        />
        <StatusToggle
          label={t("controller_status_label", "Controller Status")}
          value={data.controllerStatus}
          onChange={(v) => update("controllerStatus", v)}
          comment={data.controllerStatusComment}
          onCommentChange={(v) => update("controllerStatusComment", v)}
        />
      </FormSection>
      <FormSection
        title={t("ac_maintenance", "AC Maintenance")}
        icon="settings-outline"
      >
        <InputField
          label={t("ac_type", "AC Type (Window/Split)")}
          value={data.acType}
          onChangeText={(v) => update("acType", v)}
        />
        <StatusToggle
          label={t("internal_filter_cleaned", "Internal Filter Cleaned")}
          value={data.internalFilterCleaned}
          onChange={(v) => update("internalFilterCleaned", v)}
          comment={data.internalFilterCleanedComment}
          onCommentChange={(v) => update("internalFilterCleanedComment", v)}
        />
        <StatusToggle
          label={t("outdoor_compressor_cleaned", "Outdoor Compressor Cleaned")}
          value={data.outdoorCompressorCleaned}
          onChange={(v) => update("outdoorCompressorCleaned", v)}
          comment={data.outdoorCompressorCleanedComment}
          onCommentChange={(v) => update("outdoorCompressorCleanedComment", v)}
        />
        <StatusToggle
          label={t("high_low_pressure_measured", "High/Low Pressure Measured")}
          value={data.highLowPressureMeasured}
          onChange={(v) => update("highLowPressureMeasured", v)}
          comment={data.highLowPressureMeasuredComment}
          onCommentChange={(v) => update("highLowPressureMeasuredComment", v)}
        />
        <InputField
          label={t("recorded_temperature", "Recorded Temperature")}
          value={data.temperatureRecorded}
          onChangeText={(v) => update("temperatureRecorded", v)}
        />
        <StatusToggle
          label={t("amps_measured", "Amps Measured")}
          value={data.ampsMeasured}
          onChange={(v) => update("ampsMeasured", v)}
          comment={data.ampsMeasuredComment}
          onCommentChange={(v) => update("ampsMeasuredComment", v)}
        />
        <StatusToggle
          label={t(
            "condenser_evaporator_cleaned",
            "Condenser/Evaporator Cleaned",
          )}
          value={data.condenserEvaporatorCleaned}
          onChange={(v) => update("condenserEvaporatorCleaned", v)}
          comment={data.condenserEvaporatorCleanedComment}
          onCommentChange={(v) =>
            update("condenserEvaporatorCleanedComment", v)
          }
        />
        <StatusToggle
          label={t("outdoor_fan_checked", "Outdoor Fan Checked")}
          value={data.outdoorFanChecked}
          onChange={(v) => update("outdoorFanChecked", v)}
          comment={data.outdoorFanCheckedComment}
          onCommentChange={(v) => update("outdoorFanCheckedComment", v)}
        />
      </FormSection>
    </>
  );
};

const CleaningForm = ({
  onUpdate,
  value,
  hydrateKey,
}: {
  onUpdate: (data: any) => void;
  value?: any;
  hydrateKey?: number;
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState({
    isClean: null,
    isCleanComment: "",
    spillage: null,
    spillageComment: "",
    securityLight: null,
    securityLightComment: "",
    guardPresent: null,
    guardPresentComment: "",
    securityBox: null,
    securityBoxComment: "",
    insideClean: null,
    insideCleanComment: "",
    outsidePerimeterClean: null,
    outsidePerimeterCleanComment: "",
    shelterCleaned: null,
    shelterCleanedComment: "",
    outdoorEquipmentCleaned: null,
    outdoorEquipmentCleanedComment: "",
    airBlowerUsed: null,
    airBlowerUsedComment: "",
    comments: "",
    photos: [] as PhotoAttachment[],
  });

  useEffect(() => {
    if (!hydrateKey) return;
    if (!value || typeof value !== "object") return;
    const v: any = value;
    const photos: PhotoAttachment[] = (Array.isArray(v.photos) ? v.photos : [])
      .map((p: any) => {
        if (!p) return null;
        if (typeof p === "string")
          return {
            uri: p,
            name: p.split("/").pop() || "photo.jpg",
            type: "image/jpeg",
          };
        if (typeof p === "object" && typeof p.uri === "string")
          return p as PhotoAttachment;
        return null;
      })
      .filter(Boolean) as PhotoAttachment[];
    setData({
      isClean: v.isClean ?? null,
      spillage: v.spillage ?? null,
      securityLight: v.securityLight ?? null,
      guardPresent: v.guardPresent ?? null,
      securityBox: v.securityBox ?? null,
      insideClean: v.insideClean ?? null,
      outsidePerimeterClean: v.outsidePerimeterClean ?? null,
      shelterCleaned: v.shelterCleaned ?? null,
      outdoorEquipmentCleaned: v.outdoorEquipmentCleaned ?? null,
      airBlowerUsed: v.airBlowerUsed ?? null,
      isCleanComment: v.isCleanComment ?? v.is_clean_comment ?? "",
      spillageComment: v.spillageComment ?? v.spillage_comment ?? "",
      securityLightComment:
        v.securityLightComment ?? v.security_light_comment ?? "",
      guardPresentComment:
        v.guardPresentComment ?? v.guard_present_comment ?? "",
      securityBoxComment: v.securityBoxComment ?? v.security_box_comment ?? "",
      insideCleanComment: v.insideCleanComment ?? v.inside_clean_comment ?? "",
      outsidePerimeterCleanComment:
        v.outsidePerimeterCleanComment ??
        v.outside_perimeter_clean_comment ??
        "",
      shelterCleanedComment:
        v.shelterCleanedComment ?? v.shelter_cleaned_comment ?? "",
      outdoorEquipmentCleanedComment:
        v.outdoorEquipmentCleanedComment ??
        v.outdoor_equipment_cleaned_comment ??
        "",
      airBlowerUsedComment:
        v.airBlowerUsedComment ?? v.air_blower_used_comment ?? "",
      comments: v.comments ?? "",
      photos,
    });
  }, [hydrateKey]);

  const update = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  const addPhoto = (p: PhotoAttachment) => {
    const newData = { ...data, photos: [...(data.photos || []), p] };
    setData(newData);
    onUpdate(newData);
  };
  const removePhoto = (uri: string) => {
    const newData = {
      ...data,
      photos: data.photos.filter((p) => p.uri !== uri),
    };
    setData(newData);
    onUpdate(newData);
  };

  return (
    <>
      <FormSection
        title={t("site_cleanliness", "Site Cleanliness")}
        icon="brush"
      >
        <StatusToggle
          label={t("is_site_clean", "Is Site Clean?")}
          value={data.isClean}
          onChange={(v) => update("isClean", v)}
          okLabel={t("yes", "Yes")}
          nokLabel={t("no", "No")}
          warningLevel="info"
          comment={data.isCleanComment}
          onCommentChange={(v) => update("isCleanComment", v)}
        />
        <StatusToggle
          label={t("spillage_on_site", "Spillage on Site?")}
          value={data.spillage}
          onChange={(v) => update("spillage", v)}
          okLabel={t("no", "No")}
          nokLabel={t("yes", "Yes")}
          warningLevel="warning"
          comment={data.spillageComment}
          onCommentChange={(v) => update("spillageComment", v)}
        />
        <StatusToggle
          label={t("inside_clean", "Inside Clean")}
          value={data.insideClean}
          onChange={(v) => update("insideClean", v)}
          comment={data.insideCleanComment}
          onCommentChange={(v) => update("insideCleanComment", v)}
        />
        <StatusToggle
          label={t("outside_perimeter_clean", "Outside Perimeter Clean")}
          value={data.outsidePerimeterClean}
          onChange={(v) => update("outsidePerimeterClean", v)}
          comment={data.outsidePerimeterCleanComment}
          onCommentChange={(v) => update("outsidePerimeterCleanComment", v)}
        />
        <StatusToggle
          label={t("shelter_cleaned", "Shelter Cleaned")}
          value={data.shelterCleaned}
          onChange={(v) => update("shelterCleaned", v)}
          comment={data.shelterCleanedComment}
          onCommentChange={(v) => update("shelterCleanedComment", v)}
        />
        <StatusToggle
          label={t("outdoor_equipment_cleaned", "Outdoor Equipment Cleaned")}
          value={data.outdoorEquipmentCleaned}
          onChange={(v) => update("outdoorEquipmentCleaned", v)}
          comment={data.outdoorEquipmentCleanedComment}
          onCommentChange={(v) => update("outdoorEquipmentCleanedComment", v)}
        />
        <StatusToggle
          label={t("air_blower_used", "Air Blower Used")}
          value={data.airBlowerUsed}
          onChange={(v) => update("airBlowerUsed", v)}
          comment={data.airBlowerUsedComment}
          onCommentChange={(v) => update("airBlowerUsedComment", v)}
        />
      </FormSection>
      <FormSection
        title={t("security_status", "Security Status")}
        icon="shield"
      >
        <StatusToggle
          label={t("security_light_working", "Security Light Working")}
          value={data.securityLight}
          onChange={(v) => update("securityLight", v)}
          comment={data.securityLightComment}
          onCommentChange={(v) => update("securityLightComment", v)}
        />
        <StatusToggle
          label={t("security_guard_present", "Security Guard Present")}
          value={data.guardPresent}
          onChange={(v) => update("guardPresent", v)}
          okLabel={t("yes", "Yes")}
          nokLabel={t("no", "No")}
          comment={data.guardPresentComment}
          onCommentChange={(v) => update("guardPresentComment", v)}
        />
        <StatusToggle
          label={t("security_box_present", "Security Box Present")}
          value={data.securityBox}
          onChange={(v) => update("securityBox", v)}
          okLabel={t("yes", "Yes")}
          nokLabel={t("no", "No")}
          comment={data.securityBoxComment}
          onCommentChange={(v) => update("securityBoxComment", v)}
        />
      </FormSection>
      <FormSection
        title={t("evidence_notes", "Evidence & Notes")}
        icon="document-text"
      >
        <PhotoCapture
          label={t("site_photos", "Site Photos")}
          photos={data.photos}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
          required={false}
        />
        <InputField
          label={t("additional_notes", "Additional Notes")}
          value={data.comments}
          onChangeText={(v) => update("comments", v)}
          placeholder={t(
            "general_observations_placeholder",
            "General observations about site condition...",
          )}
          multiline
          numberOfLines={4}
          style={{ minHeight: 100, textAlignVertical: "top" }}
        />
      </FormSection>
    </>
  );
};

/* --- Main Component --- */

export default function EquipmentForm() {
  const params = useLocalSearchParams<{
    type: string;
    id: string;
    siteId: string;
    siteName: string;
    maintenanceId: string;
  }>();
  const type = params.type;
  const maintenanceId = params.id || params.maintenanceId;
  const siteId = params.siteId;

  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAcTechnician = isRestrictedAcScopeRole(user?.role);
  const isFuelTechnician = isFuelRole(user?.role);
  const isAllowedType = ["shelter", "cleaning"].includes(type || "");
  const isFuelAllowedType = ["fuel_tank"].includes(type || "");
  const title = EQUIPMENT_TITLES[type || ""] || "Equipment Check";
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrateKey, setHydrateKey] = useState(0);

  const loadEquipmentData = useCallback(async () => {
    try {
      setLoading(true);
      const draftKey = `draft_${type}_${siteId}_${maintenanceId || "adhoc"}`;

      const localDraft = await AsyncStorage.getItem(draftKey);
      if (localDraft) {
        const parsedDraft = JSON.parse(localDraft);
        console.log("📋 Loaded local draft:", draftKey);
        setFormData(parsedDraft);
        setHydrateKey((k) => k + 1);
      }

      if (maintenanceId) {
        try {
          const { data: response } = await cachedGet(
            `/technician/maintenance/${maintenanceId}`,
          );
          const maintenance = response.data;

          if (maintenance?.equipment_checks) {
            let serverData = null;
            switch (type) {
              case "generator":
                if (maintenance.equipment_checks.generator_checks?.length > 0) {
                  serverData = maintenance.equipment_checks.generator_checks[0];
                }
                break;
              case "power_cabinet":
                serverData = maintenance.equipment_checks.power_cabinet_checks;
                break;
              case "grid":
                serverData = maintenance.equipment_checks.grid_checks;
                break;
              case "shelter":
                serverData = maintenance.equipment_checks.shelter_checks;
                break;
              case "fuel_tank":
                serverData = maintenance.equipment_checks.fuel_tank_checks;
                break;
              case "cleaning":
                serverData = maintenance.equipment_checks.cleaning_checks;
                break;
            }

            if (serverData) {
              console.log(
                "💾 Loaded server data for maintenance:",
                maintenanceId,
                "Type:",
                type,
              );
              let mappedData = { ...serverData };

              if (type === "generator") {
                const electrical = serverData.electrical_readings || {};
                mappedData = {
                  ...serverData,
                  batteryStatus: serverData.battery_status,
                  fanBeltStatus: serverData.fan_belt_status,
                  radiatorStatus: serverData.radiator_status,
                  coolantStatus: serverData.coolant_status,
                  batteryStatusComment: serverData.battery_status_comment ?? "",
                  fanBeltStatusComment:
                    serverData.fan_belt_status_comment ?? "",
                  radiatorStatusComment:
                    serverData.radiator_status_comment ?? "",
                  coolantStatusComment: serverData.coolant_status_comment ?? "",
                  runningHours: serverData.running_hours
                    ? String(serverData.running_hours)
                    : "",
                  runningHoursComment: serverData.running_hours_comment ?? "",
                  fuelFilterChanged: serverData.fuel_filter_changed ?? null,
                  fuelFilterChangedComment:
                    serverData.fuel_filter_changed_comment ?? "",
                  oilFilterChanged: serverData.oil_filter_changed ?? null,
                  oilFilterChangedComment:
                    serverData.oil_filter_changed_comment ?? "",
                  airFilterChanged: serverData.air_filter_changed ?? null,
                  airFilterChangedComment:
                    serverData.air_filter_changed_comment ?? "",
                  oilLevelMax: serverData.oil_level_max ?? null,
                  oilLevelMaxComment: serverData.oil_level_max_comment ?? "",
                  oilQualityChecked: serverData.oil_quality_checked ?? null,
                  oilQualityCheckedComment:
                    serverData.oil_quality_checked_comment ?? "",
                  fuelLeakageChecked: serverData.fuel_leakage_checked ?? null,
                  fuelLeakageCheckedComment:
                    serverData.fuel_leakage_checked_comment ?? "",
                  alarmsStatusChecked: serverData.alarms_status_checked ?? null,
                  alarmsStatusCheckedComment:
                    serverData.alarms_status_checked_comment ?? "",
                  i1: electrical.i1 ? String(electrical.i1) : "",
                  i2: electrical.i2 ? String(electrical.i2) : "",
                  i3: electrical.i3 ? String(electrical.i3) : "",
                  v1: electrical.v1 ? String(electrical.v1) : "",
                  v2: electrical.v2 ? String(electrical.v2) : "",
                  v3: electrical.v3 ? String(electrical.v3) : "",
                  photos: (() => {
                    const raw = (electrical.photos || []).map((p: any) =>
                      typeof p === "string" ? p : p.uri || "",
                    );
                    let photos = raw.filter(Boolean).map((uri: string) => ({
                      uri,
                      name: uri.split("/").pop() || "photo.jpg",
                      type: "image/jpeg",
                    }));
                    const hasTagged = photos.some((p) =>
                      /^(I[123]|V[123])_/.test(p.name),
                    );
                    if (!hasTagged && photos.length > 0 && photos.length <= 6) {
                      photos = photos.map((p, idx) => {
                        const tag = idx < 3 ? `I${idx + 1}` : `V${idx - 2}`;
                        return { ...p, name: `${tag}_${p.name}` };
                      });
                    }
                    return photos;
                  })(),
                  comments: serverData.comments || "",
                };
              } else if (type === "fuel_tank") {
                mappedData = {
                  ...serverData,
                  separatingFilter: serverData.separating_filter,
                  waterInTank: serverData.water_in_tank,
                  fuelLine: serverData.fuel_line,
                  isWaterproof: serverData.is_waterproof,
                  tankStatus: serverData.status,
                  tankStatusComment: serverData.status_comment || "",
                  separatingFilterComment:
                    serverData.separating_filter_comment || "",
                  waterInTankComment: serverData.water_in_tank_comment || "",
                  fuelLineComment: serverData.fuel_line_comment || "",
                  isWaterproofComment: serverData.is_waterproof_comment || "",
                };
              } else if (type === "shelter") {
                const acUnits: any[] = Array.isArray(serverData.ac_units)
                  ? serverData.ac_units
                  : [];
                mappedData = {
                  ...serverData,
                  doorStatus: serverData.door_status,
                  shelterStatus: serverData.status,
                  temperature: serverData.temperature ?? "",
                  ac1Status: acUnits[0] ? (acUnits[0].status ?? null) : null,
                  ac2Status: acUnits[1] ? (acUnits[1].status ?? null) : null,
                  ac1Comments: acUnits[0] ? (acUnits[0].comments ?? "") : "",
                  ac2Comments: acUnits[1] ? (acUnits[1].comments ?? "") : "",
                  shelterStatusComment: serverData.status_comment ?? "",
                  doorStatusComment: serverData.door_status_comment ?? "",
                  controllerStatus: serverData.controller_status ?? null,
                  controllerStatusComment:
                    serverData.controller_status_comment ?? "",
                  acType: serverData.ac_type ?? "",
                  internalFilterCleaned:
                    serverData.internal_filter_cleaned ?? null,
                  internalFilterCleanedComment:
                    serverData.internal_filter_cleaned_comment ?? "",
                  outdoorCompressorCleaned:
                    serverData.outdoor_compressor_cleaned ?? null,
                  outdoorCompressorCleanedComment:
                    serverData.outdoor_compressor_cleaned_comment ?? "",
                  highLowPressureMeasured:
                    serverData.high_low_pressure_measured ?? null,
                  highLowPressureMeasuredComment:
                    serverData.high_low_pressure_measured_comment ?? "",
                  temperatureRecorded: serverData.temperature_recorded ?? "",
                  temperatureRecordedComment:
                    serverData.temperature_recorded_comment ?? "",
                  ampsMeasured: serverData.amps_measured ?? null,
                  ampsMeasuredComment: serverData.amps_measured_comment ?? "",
                  condenserEvaporatorCleaned:
                    serverData.condenser_evaporator_cleaned ?? null,
                  condenserEvaporatorCleanedComment:
                    serverData.condenser_evaporator_cleaned_comment ?? "",
                  outdoorFanChecked: serverData.outdoor_fan_checked ?? null,
                  outdoorFanCheckedComment:
                    serverData.outdoor_fan_checked_comment ?? "",
                };
              } else if (type === "grid") {
                mappedData = {
                  ...serverData,
                  breakerStatus: serverData.breaker_status,
                  gridStatus: serverData.status,
                  gridIndex: serverData.grid_index ?? "",
                  gridConnectedOperational:
                    serverData.grid_connected_operational ?? null,
                  gridStable: serverData.grid_stable ?? null,
                  gridStatusComment: serverData.status_comment ?? "",
                  breakerStatusComment: serverData.breaker_status_comment ?? "",
                  gridConnectedOperationalComment:
                    serverData.grid_connected_operational_comment ?? "",
                  gridStableComment: serverData.grid_stable_comment ?? "",
                  photos: (serverData.meter_photos || []).map((p: string) => ({
                    uri: p,
                    name: p.split("/").pop() || "photo.jpg",
                    type: "image/jpeg",
                  })),
                };
              } else if (type === "cleaning") {
                mappedData = {
                  ...serverData,
                  isClean: serverData.is_clean,
                  spillage: serverData.spillage ?? null,
                  securityLight: serverData.security_light,
                  guardPresent: serverData.guard_present,
                  securityBox: serverData.security_box,
                  insideClean: serverData.inside_clean ?? null,
                  outsidePerimeterClean:
                    serverData.outside_perimeter_clean ?? null,
                  shelterCleaned: serverData.shelter_cleaned ?? null,
                  outdoorEquipmentCleaned:
                    serverData.outdoor_equipment_cleaned ?? null,
                  airBlowerUsed: serverData.air_blower_used ?? null,
                  isCleanComment: serverData.is_clean_comment ?? "",
                  spillageComment: serverData.spillage_comment ?? "",
                  securityLightComment: serverData.security_light_comment ?? "",
                  guardPresentComment: serverData.guard_present_comment ?? "",
                  securityBoxComment: serverData.security_box_comment ?? "",
                  insideCleanComment: serverData.inside_clean_comment ?? "",
                  outsidePerimeterCleanComment:
                    serverData.outside_perimeter_clean_comment ?? "",
                  shelterCleanedComment:
                    serverData.shelter_cleaned_comment ?? "",
                  outdoorEquipmentCleanedComment:
                    serverData.outdoor_equipment_cleaned_comment ?? "",
                  airBlowerUsedComment:
                    serverData.air_blower_used_comment ?? "",
                  photos: ((serverData.photos || []) as string[]).map(
                    (p: string) => ({
                      uri: p,
                      name: p.split("/").pop() || "photo.jpg",
                      type: "image/jpeg",
                    }),
                  ),
                };
              } else if (type === "power_cabinet") {
                const pc = Array.isArray(serverData)
                  ? serverData[0] || {}
                  : serverData || {};
                mappedData = {
                  ...pc,
                  rectifiers: pc.rectifiers || [],
                  batteries: pc.batteries || [],
                  cooling: pc.cooling || { status: null, comments: "" },
                  controller: pc.controller || { status: null, comments: "" },
                  rectifierSummary: pc.rectifierSummary || {
                    modulesFound: pc.modulesFound || pc.modules_found || "",
                    modulesMissing:
                      pc.modulesMissing || pc.modules_missing || "",
                    rectifierTypeCapacity:
                      pc.rectifierTypeCapacity ||
                      pc.rectifier_type_capacity ||
                      "",
                    outputVoltage: pc.outputVoltage || pc.output_voltage || "",
                    breakersChecked:
                      pc.breakersChecked ?? pc.breakers_checked ?? null,
                    cablingStatusGood:
                      pc.cablingStatusGood ?? pc.cabling_status_good ?? null,
                  },
                  batterySummary: pc.batterySummary || {
                    outputChecked:
                      pc.outputChecked ?? pc.output_checked ?? null,
                    autonomyTestDone:
                      pc.autonomyTestDone ?? pc.autonomy_test_done ?? null,
                    autonomyEstimated:
                      pc.autonomyEstimated || pc.autonomy_estimated || "",
                  },
                  numRectifiers: pc.numRectifiers
                    ? String(pc.numRectifiers)
                    : String((pc.rectifiers || []).length || 0),
                  numBatteries: pc.numBatteries
                    ? String(pc.numBatteries)
                    : String((pc.batteries || []).length || 0),
                };
              }

              setFormData(mappedData);
              setHydrateKey((k) => k + 1);
              await AsyncStorage.removeItem(draftKey);
            }
          }
        } catch (error) {
          console.error("Error loading from server, using local draft:", error);
        }
      }
    } catch (error) {
      console.error("Error loading equipment data:", error);
    } finally {
      setLoading(false);
    }
  }, [maintenanceId, type, siteId]);

  useEffect(() => {
    loadEquipmentData();
  }, [maintenanceId, type, siteId]);

  const computeProgress = (dataObj: any, equipmentType?: string) => {
    const isFilled = (val: any) => {
      if (val === null || val === undefined) return false;
      if (typeof val === "string") return val.trim() !== "";
      if (typeof val === "number") return !isNaN(val);
      if (typeof val === "boolean") return true;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === "object") return Object.keys(val).length > 0;
      return false;
    };

    try {
      const data = dataObj || {};
      const normalizePhotos = (photos: any) => {
        if (!Array.isArray(photos)) return [];
        return photos
          .map((p: any) => {
            if (typeof p === "string")
              return { uri: p, name: p.split("/").pop() || "" };
            return {
              uri: p.uri || "",
              name: p.name || (p.uri ? p.uri.split("/").pop() : ""),
            };
          })
          .filter((p: any) => p.uri || p.name);
      };

      if (equipmentType === "generator") {
        const keys = [
          "batteryStatus",
          "fanBeltStatus",
          "radiatorStatus",
          "coolantStatus",
          "runningHours",
          "fuelFilterChanged",
          "oilFilterChanged",
          "airFilterChanged",
          "oilLevelMax",
          "oilQualityChecked",
          "fuelLeakageChecked",
          "alarmsStatusChecked",
          "i1",
          "i2",
          "i3",
          "v1",
          "v2",
          "v3",
          "comments",
        ];
        const photos = normalizePhotos(data.photos || []);
        const readingTagged = photos.filter((p: any) =>
          /^(I[123]|V[123])_/.test(p.name),
        ).length;
        const inferredReadingCount =
          readingTagged === 0 && photos.length > 0 && photos.length <= 6
            ? Math.min(photos.length, 6)
            : readingTagged;
        const total = keys.length + 6;
        const filledFields = keys.reduce(
          (acc, k) => acc + (isFilled(data[k]) ? 1 : 0),
          0,
        );
        return {
          current: Math.min(total, filledFields + inferredReadingCount),
          total,
        };
      }

      if (equipmentType === "grid") {
        const keys = [
          "gridStatus",
          "breakerStatus",
          "gridIndex",
          "gridConnectedOperational",
          "gridStable",
          "comments",
        ];
        const photos = normalizePhotos(data.photos || []);
        const total = keys.length + 1;
        const filledFields = keys.reduce(
          (acc, k) => acc + (isFilled(data[k]) ? 1 : 0),
          0,
        );
        return {
          current: Math.min(total, filledFields + (photos.length > 0 ? 1 : 0)),
          total,
        };
      }

      if (equipmentType === "cleaning") {
        const keys = [
          "isClean",
          "spillage",
          "securityLight",
          "guardPresent",
          "securityBox",
          "insideClean",
          "outsidePerimeterClean",
          "shelterCleaned",
          "outdoorEquipmentCleaned",
          "airBlowerUsed",
          "comments",
        ];
        const photos = normalizePhotos(data.photos || []);
        const total = keys.length + 1;
        const filledFields = keys.reduce(
          (acc, k) => acc + (isFilled(data[k]) ? 1 : 0),
          0,
        );
        return {
          current: Math.min(total, filledFields + (photos.length > 0 ? 1 : 0)),
          total,
        };
      }

      const simpleKeys = Object.keys(data).filter((k) => k !== "photos");
      const photos = normalizePhotos(data.photos || []);
      const total = Math.max(1, simpleKeys.length) + 1;
      const filled = simpleKeys.reduce(
        (acc, k) => acc + (isFilled(data[k]) ? 1 : 0),
        0,
      );
      return {
        current: Math.min(total, filled + (photos.length > 0 ? 1 : 0)),
        total,
      };
    } catch (err) {
      return { current: 0, total: 1 };
    }
  };

  const handleUpdate = useCallback((data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      const draftKey = `draft_${type}_${siteId}_${maintenanceId || "adhoc"}`;

      let processedData;
      try {
        processedData = await uploadAPI.processAndUploadData(formData);
      } catch (uploadError: any) {
        console.error("Upload error during draft save:", uploadError);
        Alert.alert(
          "Upload Failed",
          "Some images could not be uploaded. Please check your connection and try again.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      setFormData(processedData);
      await AsyncStorage.setItem(draftKey, JSON.stringify(processedData));

      if (maintenanceId) {
        try {
          let payloadForServer: any = processedData;
          if (type === "shelter") {
            const ac_units: any[] = [];
            if (processedData.ac1Status !== undefined)
              ac_units.push({
                status: processedData.ac1Status,
                comments: processedData.ac1Comments || "",
              });
            if (processedData.ac2Status !== undefined)
              ac_units.push({
                status: processedData.ac2Status,
                comments: processedData.ac2Comments || "",
              });
            payloadForServer = {
              ...processedData,
              status: processedData.shelterStatus,
              door_status: processedData.doorStatus,
              status_comment: processedData.shelterStatusComment,
              door_status_comment: processedData.doorStatusComment,
              temperature:
                processedData.temperature !== undefined &&
                processedData.temperature !== ""
                  ? Number(processedData.temperature)
                  : undefined,
              controller_status: processedData.controllerStatus,
              controller_status_comment: processedData.controllerStatusComment,
              ac_type: processedData.acType,
              internal_filter_cleaned: processedData.internalFilterCleaned,
              internal_filter_cleaned_comment:
                processedData.internalFilterCleanedComment,
              outdoor_compressor_cleaned:
                processedData.outdoorCompressorCleaned,
              outdoor_compressor_cleaned_comment:
                processedData.outdoorCompressorCleanedComment,
              high_low_pressure_measured: processedData.highLowPressureMeasured,
              high_low_pressure_measured_comment:
                processedData.highLowPressureMeasuredComment,
              temperature_recorded: processedData.temperatureRecorded,
              temperature_recorded_comment:
                processedData.temperatureRecordedComment,
              amps_measured: processedData.ampsMeasured,
              amps_measured_comment: processedData.ampsMeasuredComment,
              condenser_evaporator_cleaned:
                processedData.condenserEvaporatorCleaned,
              condenser_evaporator_cleaned_comment:
                processedData.condenserEvaporatorCleanedComment,
              outdoor_fan_checked: processedData.outdoorFanChecked,
              outdoor_fan_checked_comment:
                processedData.outdoorFanCheckedComment,
              ac_units,
            };
          }

          await api.patch(
            `/technician/maintenance/${maintenanceId}/equipment/${type}`,
            payloadForServer,
          );
          Alert.alert("Success", "Draft saved and synced to server!");
        } catch (error: any) {
          console.error("Error syncing to server:", error);
          Alert.alert(
            "Saved Locally",
            "Draft saved on device. Will sync when online.",
          );
        }
      } else {
        Alert.alert("Saved", "Draft saved locally on your device.");
      }
    } catch (error: any) {
      console.error("Error saving draft:", error);
      Alert.alert("Error", "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!maintenanceId) {
      Alert.alert(
        "Ad-hoc Inspection",
        "This is an ad-hoc inspection. Data will be saved locally. To create a formal maintenance record, please schedule through your supervisor.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save Locally",
            onPress: async () => {
              const draftKey = `draft_${type}_${siteId}_adhoc`;
              await AsyncStorage.setItem(draftKey, JSON.stringify(formData));
              router.back();
            },
          },
        ],
      );
      return;
    }

    const isValid = validateForm();
    if (!isValid) {
      Alert.alert("Validation Error", "Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);

      let dataToSubmit;
      try {
        dataToSubmit = await uploadAPI.processAndUploadData(
          JSON.parse(JSON.stringify(formData)),
        );
      } catch (uploadError: any) {
        console.error("Upload error during submission:", uploadError);
        Alert.alert(
          "Upload Failed",
          "Failed to upload images. Please check your internet connection and try again.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      let payloadForServer: any = dataToSubmit;
      if (type === "shelter") {
        const ac_units: any[] = [];
        if (dataToSubmit.ac1Status !== undefined)
          ac_units.push({
            status: dataToSubmit.ac1Status,
            comments: dataToSubmit.ac1Comments || "",
          });
        if (dataToSubmit.ac2Status !== undefined)
          ac_units.push({
            status: dataToSubmit.ac2Status,
            comments: dataToSubmit.ac2Comments || "",
          });
        payloadForServer = {
          ...dataToSubmit,
          status: dataToSubmit.shelterStatus,
          door_status: dataToSubmit.doorStatus,
          status_comment: dataToSubmit.shelterStatusComment,
          door_status_comment: dataToSubmit.doorStatusComment,
          temperature:
            dataToSubmit.temperature !== undefined &&
            dataToSubmit.temperature !== ""
              ? Number(dataToSubmit.temperature)
              : undefined,
          controller_status: dataToSubmit.controllerStatus,
          controller_status_comment: dataToSubmit.controllerStatusComment,
          ac_type: dataToSubmit.acType,
          internal_filter_cleaned: dataToSubmit.internalFilterCleaned,
          internal_filter_cleaned_comment:
            dataToSubmit.internalFilterCleanedComment,
          outdoor_compressor_cleaned: dataToSubmit.outdoorCompressorCleaned,
          outdoor_compressor_cleaned_comment:
            dataToSubmit.outdoorCompressorCleanedComment,
          high_low_pressure_measured: dataToSubmit.highLowPressureMeasured,
          high_low_pressure_measured_comment:
            dataToSubmit.highLowPressureMeasuredComment,
          temperature_recorded: dataToSubmit.temperatureRecorded,
          temperature_recorded_comment: dataToSubmit.temperatureRecordedComment,
          amps_measured: dataToSubmit.ampsMeasured,
          amps_measured_comment: dataToSubmit.ampsMeasuredComment,
          condenser_evaporator_cleaned: dataToSubmit.condenserEvaporatorCleaned,
          condenser_evaporator_cleaned_comment:
            dataToSubmit.condenserEvaporatorCleanedComment,
          outdoor_fan_checked: dataToSubmit.outdoorFanChecked,
          outdoor_fan_checked_comment: dataToSubmit.outdoorFanCheckedComment,
          ac_units,
        };
      }

      await api.patch(
        `/technician/maintenance/${maintenanceId}/equipment/${type}`,
        payloadForServer,
      );

      const draftKey = `draft_${type}_${siteId}_${maintenanceId}`;
      await AsyncStorage.removeItem(draftKey);

      Alert.alert("Success", "Equipment check submitted for approval!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to submit form",
      );
    } finally {
      setSaving(false);
    }
  };

  const validateForm = (): boolean => {
    if (type === "generator") {
      const data = formData as any;
      if (
        !data.batteryStatus ||
        !data.fanBeltStatus ||
        !data.radiatorStatus ||
        !data.coolantStatus
      ) {
        return false;
      }
      if (
        !data.i1 ||
        !data.i2 ||
        !data.i3 ||
        !data.v1 ||
        !data.v2 ||
        !data.v3
      ) {
        return false;
      }
    }
    return true;
  };

  if (isAcTechnician && !isAllowedType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Restricted</Text>
          <View style={{ width: 24 }} />
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Ionicons name="lock-closed" size={48} color={Colors.textSecondary} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: "600",
              color: Colors.text,
            }}
          >
            Access limited to shelter and site cleaning checks.
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: Colors.textSecondary,
              textAlign: "center",
            }}
          >
            Please return to your task list to continue.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isFuelTechnician && !isFuelAllowedType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Restricted</Text>
          <View style={{ width: 24 }} />
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Ionicons name="lock-closed" size={48} color={Colors.textSecondary} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: "600",
              color: Colors.text,
            }}
          >
            Access limited to fuel tank checks.
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: Colors.textSecondary,
              textAlign: "center",
            }}
          >
            Please return to your task list to continue.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Text>Loading equipment data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const id = params.id || "";

  const renderFormInfo = () => {
    if (type === "generator") return null;
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          {t("equipment_information", "Equipment Information")}
        </Text>
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
            {t("type", "Type")}
          </Text>
          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: "500" }}>
            {title}
          </Text>
        </View>
        {id && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
              {t("equipment_id", "Equipment ID")}
            </Text>
            <Text
              style={{ color: Colors.text, fontSize: 16, fontWeight: "500" }}
            >
              {id}
            </Text>
          </View>
        )}
        {siteId && (
          <View>
            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
              {t("site_id", "Site ID")}
            </Text>
            <Text
              style={{ color: Colors.text, fontSize: 16, fontWeight: "500" }}
            >
              {siteId}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>
            {type === "generator"
              ? params.siteName
                ? `Generator - ${params.siteName}`
                : "Generator 1"
              : title}
          </Text>
          {type === "generator" && (
            <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
              {siteId || "Site A - Lagos"} • Enhanced Form
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Ionicons name="wifi" size={20} color={Colors.text} />
          <Ionicons
            name="notifications-outline"
            size={20}
            color={Colors.text}
          />
          <Ionicons name="person-outline" size={20} color={Colors.text} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProgressIndicator
          current={computeProgress(formData, type).current}
          total={computeProgress(formData, type).total}
          label={t("form_completion", "Form Completion")}
        />
        {renderFormInfo()}

        <View style={{ gap: 16 }}>
          {type === "generator" && (
            <GeneratorForm
              onUpdate={handleUpdate}
              siteId={siteId}
              value={formData}
              hydrateKey={hydrateKey}
            />
          )}
          {type === "power_cabinet" && (
            <PowerCabinetFormWithHydration
              onUpdate={handleUpdate}
              value={formData}
              hydrateKey={hydrateKey}
            />
          )}
          {type === "grid" && (
            <GridFormWithHydration
              onUpdate={handleUpdate}
              value={formData}
              hydrateKey={hydrateKey}
            />
          )}
          {type === "fuel_tank" && (
            <FuelTankForm
              onUpdate={handleUpdate}
              value={formData}
              hydrateKey={hydrateKey}
            />
          )}
          {type === "shelter" && (
            <ShelterForm
              onUpdate={handleUpdate}
              value={formData}
              hydrateKey={hydrateKey}
            />
          )}
          {type === "cleaning" && (
            <CleaningForm
              onUpdate={handleUpdate}
              value={formData}
              hydrateKey={hydrateKey}
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveDraftBtn}
          onPress={handleSaveDraft}
          disabled={saving}
        >
          <Ionicons
            name="save-outline"
            size={20}
            color={Colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.saveDraftText}>
            {saving ? t("saving", "Saving...") : t("save_draft", "Save Draft")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Ionicons
            name="checkmark"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.submitBtnText}>
            {saving ? t("submitting", "Submitting...") : t("submit", "Submit")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconContainer: {
    padding: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoItem: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
  },
  infoLabel: {
    color: Colors.primary,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "500",
  },
  infoValue: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  readingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
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
  submitBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  submitBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  saveDraftBtn: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveDraftText: {
    color: Colors.textSecondary,
    fontWeight: "600",
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.primaryLight,
  },
  tabText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  tabContent: {
    gap: 16,
  },
});







