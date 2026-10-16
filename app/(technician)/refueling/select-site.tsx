// app/(technician)/refueling/index.tsx  (or wherever RefuelingScreen lives)

import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router/react-navigation";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { ApiResponse } from "../../../types/common.types";

interface Site {
  _id: string;
  name: string;
  site_id: string;
  currentFuelLevel?: number;
  tankCapacity?: number;
  percentage?: number;
  hasFuelData?: boolean;
  lastRefuelDate?: string | null;
  scheduledDate?: string | null;
  maintenanceId?: string | null;
  priority?: string | null;
  visit_type?: string | null;
  maintenance_status?: string | null;
  workflow_status?: string | null;
  refuel_submitted?: boolean | null;
  // ✅ added — backend should return this when a workflow already exists
  workflowId?: string | null;
}

type StatusFilter = "all" | "scheduled" | "unscheduled";

export default function RefuelingScreen() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => { fetchSites(); }, []);
  useFocusEffect(React.useCallback(() => { fetchSites(); }, []));

  const fetchSites = async () => {
    try {
      setLoading(true);
      console.log("🔄 [Refueling] fetchSites() called");
      const response = await api.get<ApiResponse<Site[]>>("/technician/refuel/sites");
      console.log("📡 [Refueling] HTTP status       :", response.status);
      console.log("📦 [Refueling] sites count received:", response.data?.data?.length ?? 0);
      const incoming: Site[] = response.data?.data ?? [];
      if (incoming.length === 0) console.warn("⚠️  [Refueling] No sites returned from API");
      setSites(incoming);
    } catch (error: any) {
      console.error("❌ [Refueling] fetchSites error:", error?.message ?? error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchSites(); };

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all",         label: t("all", "All") },
    { key: "scheduled",   label: t("scheduled", "Scheduled") },
    { key: "unscheduled", label: t("unscheduled", "Unscheduled") },
  ];

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectable = sites.filter(
      (s) => s.workflow_status !== "completed" && s.refuel_submitted !== true
    );
    const searched = q
      ? selectable.filter(
          (s) => s.name?.toLowerCase().includes(q) || s.site_id?.toLowerCase().includes(q)
        )
      : selectable;
    if (statusFilter === "scheduled")   return searched.filter((s) => !!s.maintenanceId);
    if (statusFilter === "unscheduled") return searched.filter((s) => !s.maintenanceId);
    return searched;
  }, [sites, searchQuery, statusFilter]);

  function groupByDate(list: Site[]): [string, Site[]][] {
    const groups: Record<string, Site[]> = {};
    for (const site of list) {
      let key = "No Date";
      if (site.scheduledDate) {
        const d = new Date(site.scheduledDate);
        if (!isNaN(d.getTime())) key = d.toISOString().split("T")[0];
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(site);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const ta = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
        const tb = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
        return ta - tb;
      });
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No Date") return 1;
      if (b === "No Date") return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }

  function formatDateKey(key: string): string {
    if (key === "No Date") return t("no_date", "No Date");
    return new Date(key + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "2-digit", year: "numeric",
    });
  }

  function getPriorityColors(priority?: string | null) {
    switch ((priority || "").toLowerCase()) {
      case "critical": return { bg: "#FEE2E2", fg: "#DC2626" };
      case "high":     return { bg: "#FEE2E2", fg: "#EF4444" };
      case "medium":   return { bg: "#FEF3C7", fg: "#F59E0B" };
      case "low":      return { bg: "#DCFCE7", fg: "#22C55E" };
      default:         return { bg: "#F3F4F6", fg: "#6B7280" };
    }
  }

  function getFuelColor(pct: number) {
    if (pct <= 10) return "#EF4444";
    if (pct <= 25) return "#F59E0B";
    if (pct <= 50) return "#3B82F6";
    return "#22C55E";
  }

  function formatDate(iso?: string | null, fallback = "N/A") {
    if (!iso) return fallback;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }

  function formatScheduled(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) +
      "  " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  }

  // ✅ Pass workflowId (if it exists on the site) so activate-site can
  //    skip re-fetching and forward it directly to subsequent screens.
  const handleCardPress = (item: Site) => {
    router.push({
      pathname: "/(technician)/refueling-flow/activate-site",
      params: {
        siteId:        item._id,
        siteCode:      item.site_id,
        siteName:      item.name,
        tankId:        item.site_id,
        capacity:      item.tankCapacity?.toString()     ?? "5000",
        currentLevel:  item.currentFuelLevel?.toString() ?? "0",
        maintenanceId: item.maintenanceId  ?? "",
        workflowId:    item.workflowId     ?? "",   // ✅ forward existing ID when available
      },
    });
  };

  const grouped = groupByDate(filteredSites);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("refueling", "Refueling")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <FontAwesome5 name="search" size={16} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("search_sites", "Search sites...")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textSecondary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
            <FontAwesome5 name="times" size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterTabs}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, statusFilter === tab.key && styles.filterTabActive]}
            onPress={() => setStatusFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, statusFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Count */}
      <Text style={styles.countLabel}>
        {filteredSites.length} {t("sites", "sites")}
      </Text>

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {grouped.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="tint-slash" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery
                ? t("no_results_for", `No results for "${searchQuery}"`)
                : t("no_refueling_tasks", "No refueling tasks assigned")}
            </Text>
          </View>
        ) : (
          grouped.map(([dateKey, sitesForDate]) => (
            <View key={dateKey} style={styles.dateGroup}>

              {/* Date header */}
              <View style={styles.dateHeader}>
                <FontAwesome5 name="calendar-alt" size={15} color={Colors.primary} />
                <Text style={styles.dateHeaderText}>{formatDateKey(dateKey)}</Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{sitesForDate.length}</Text>
                </View>
              </View>

              {/* Cards */}
              {sitesForDate.map((item) => {
                const { bg, fg } = getPriorityColors(item.priority);
                const pct        = item.percentage ?? 0;
                const hasData    = item.hasFuelData !== false; // default true for older cached data without this field
                const fuelColor  = hasData ? getFuelColor(pct) : "#9CA3AF";

                return (
                  <TouchableOpacity
                    key={item._id}
                    style={styles.card}
                    activeOpacity={0.7}
                    onPress={() => handleCardPress(item)}
                  >
                    {/* Top row */}
                    <View style={styles.cardRow}>
                      <View style={styles.cardLeft}>
                        <Text style={styles.siteName}>{item.name}</Text>
                        <Text style={styles.siteId}>{item.site_id}</Text>

                        <Text style={styles.metaText}>
                          <Text style={styles.metaLabel}>Last refuel: </Text>
                          {formatDate(item.lastRefuelDate)}
                        </Text>

                        <Text style={styles.metaText}>
                          <Text style={styles.metaLabel}>Tank: </Text>
                          {item.currentFuelLevel ?? 0} L / {item.tankCapacity ?? 5000} L
                        </Text>
                      </View>

                      {/* Fuel % */}
                      <View style={styles.fuelIndicator}>
                        <Text style={[styles.fuelPct, { color: fuelColor }]}>
                          {hasData ? `${pct}%` : 'No data'}
                        </Text>
                        <Text style={styles.fuelLabel}>Fuel Level</Text>
                      </View>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${hasData ? Math.min(pct, 100) : 0}%` as any, backgroundColor: fuelColor },
                        ]}
                      />
                    </View>

                    {/* Badges */}
                    <View style={styles.badgeRow}>
                      {item.priority && (
                        <View style={[styles.badge, { backgroundColor: bg }]}>
                          <Text style={[styles.badgeText, { color: fg }]}>
                            {item.priority.toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {item.scheduledDate && (
                        <View style={[styles.badge, { backgroundColor: "#E0E7FF" }]}>
                          <FontAwesome5 name="clock" size={10} color="#3730A3" style={{ marginRight: 4 }} />
                          <Text style={[styles.badgeText, { color: "#3730A3" }]}>
                            {formatScheduled(item.scheduledDate)}
                          </Text>
                        </View>
                      )}

                      {item.maintenance_status && (
                        <View style={[styles.badge, { backgroundColor: "#F3F4F6" }]}>
                          <Text style={[styles.badgeText, { color: "#374151" }]}>
                            {item.maintenance_status.toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {!item.maintenanceId && (
                        <View style={[styles.badge, { backgroundColor: "#FEF9C3" }]}>
                          <Text style={[styles.badgeText, { color: "#854D0E" }]}>UNSCHEDULED</Text>
                        </View>
                      )}

                      {item.workflow_status && item.workflow_status !== "initiated" && (
                        <View style={[styles.badge, { backgroundColor: "#D1FAE5" }]}>
                          <FontAwesome5 name="play-circle" size={10} color="#065F46" style={{ marginRight: 4 }} />
                          <Text style={[styles.badgeText, { color: "#065F46" }]}>RESUME</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.chevronRow}>
                      <FontAwesome5 name="chevron-right" size={12} color="#D1D5DB" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#F3F4F6" },

  header:      { backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  backButton:  { padding: 4 },

  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", height: 48 },
  searchIcon:      { marginRight: 10 },
  searchInput:     { flex: 1, height: "100%", color: "#111827", fontSize: 15 },

  filterTabs:          { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterTab:           { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  filterTabActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText:       { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  filterTabTextActive: { color: "#fff" },

  countLabel: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: "#9CA3AF" },

  scrollView:    { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  dateGroup:      { marginBottom: 24 },
  dateHeader:     { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  dateHeaderText: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  dateBadge:      { backgroundColor: Colors.primary, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dateBadgeText:  { color: "#fff", fontSize: 12, fontWeight: "700" },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },

  cardRow:  { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  cardLeft: { flex: 1, marginRight: 12 },

  siteName:  { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 2 },
  siteId:    { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  metaText:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  metaLabel: { fontWeight: "600", color: "#374151" },

  fuelIndicator: { alignItems: "center", minWidth: 64 },
  fuelPct:       { fontSize: 22, fontWeight: "800", lineHeight: 26 },
  fuelLabel:     { fontSize: 10, color: "#9CA3AF", marginTop: 2 },

  progressTrack: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, marginBottom: 10, overflow: "hidden" },
  progressFill:  { height: 6, borderRadius: 3 },

  badgeRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  badge:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  chevronRow: { alignItems: "flex-end", marginTop: 8 },

  emptyState: { paddingTop: 60, alignItems: "center" },
  emptyText:  { marginTop: 16, color: "#9CA3AF", textAlign: "center", fontSize: 14, lineHeight: 22 },
});



