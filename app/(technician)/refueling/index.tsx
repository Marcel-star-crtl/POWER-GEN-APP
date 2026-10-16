// app/(technician)/refueling/index.tsx

import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router/react-navigation";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";
import { cachedGet } from "../../../services/offlineApi";
import { useSyncCompletion } from "../../../hooks/useSyncCompletion";
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
  workflowId?: string | null;
}

type StatusFilter = "all" | "scheduled" | "unscheduled";


// Module-level so both AssignmentCard and the main site list below can use
// the same function — previously declared inside the main component only,
// which meant AssignmentCard (a separate, module-level function) couldn't
// actually reference it at all.
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

// ── AssignmentCard — matches the "My Assignments" screen card style ───────────
function AssignmentCard({ r }: { r: any }) {
  const litres    = r.liters_approved ?? r.liters_requested ?? 0;
  const urg       = (r.urgency || 'medium').toLowerCase();
  const urgColor  = urg === 'critical' ? '#DC2626' : urg === 'high' ? '#EF4444' : urg === 'medium' ? '#F59E0B' : '#22C55E';
  const isCEO     = litres >= 100;
  const canStart  = r.status === 'scheduled' || r.status === 'approved';
  const canResume = r.status === 'purchase_made' || r.status === 'partially_refueled';
  const remainingL = Math.max(0, litres - (r.liters_actually_added || 0));
  const statusLabel =
    r.status === 'purchase_made'      ? 'IN_PROGRESS' :
    r.status === 'scheduled'          ? 'SCHEDULED'   :
    r.status === 'partially_refueled' ? `PARTIAL — ${remainingL}L LEFT` :
    r.status === 'refueled'           ? 'COMPLETED'   :
    r.status === 'approved'           ? 'APPROVED'     : (r.status || '').toUpperCase();
  const statusColor =
    r.status === 'purchase_made'      ? '#D97706' :
    r.status === 'scheduled'          ? '#1D4ED8' :
    r.status === 'partially_refueled' ? '#DC2626' :
    r.status === 'refueled'           ? '#16A34A' : '#6B7280';

  // Fuel-level reading — same info shown on every card in the main site
  // list below, previously missing here entirely. site_details is the
  // FRESH current level/capacity (added to this endpoint's response
  // earlier this project); r.current_fuel_level/r.tank_capacity are only
  // a snapshot from whenever the request was originally created, kept as
  // a fallback if site_details is ever unavailable.
  const freshLevel    = r.site_details?.Fuel_Quantity_Found;
  const freshCapacity = r.site_details?.Tank_Capacity;
  const currentLevel  = freshLevel    ?? r.current_fuel_level ?? 0;
  const tankCapacity  = freshCapacity ?? r.tank_capacity      ?? 5000;
  const hasFuelData   = !!r.site_details?.Fuel_Level_Source || freshLevel != null;
  const fuelPct       = tankCapacity > 0 ? Math.min(Math.round((currentLevel / tankCapacity) * 100), 100) : 0;
  const fuelColor     = hasFuelData ? getFuelColor(fuelPct) : '#9CA3AF';

  return (
    <View style={aStyles.card}>
      {/* Site name + cluster */}
      <View style={aStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={aStyles.siteName}>{r.site_name || r.site_id}</Text>
          <Text style={aStyles.siteId}>{r.site_id} · {r.cluster || ''}</Text>
        </View>
        <View style={aStyles.fuelIndicatorSmall}>
          <Text style={[aStyles.fuelPctSmall, { color: fuelColor }]}>
            {hasFuelData ? `${fuelPct}%` : 'No data'}
          </Text>
          <Text style={aStyles.fuelLabelSmall}>Fuel Level</Text>
        </View>
      </View>
      <Text style={aStyles.tankText}>
        Last refuel: {formatDate(r.site_details?.Actual_Date_Visit)}
      </Text>
      <Text style={aStyles.tankText}>Tank: {currentLevel} L / {tankCapacity} L</Text>

      {/* Litres box — red, large, exactly like My Assignments */}
      <View style={aStyles.litreBox}>
        <View>
          <View style={aStyles.litreRow}>
            <FontAwesome5 name="tint" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={aStyles.litreText}>{litres} L</Text>
          </View>
          <Text style={aStyles.xafText}>XAF {(litres * 828).toLocaleString()}</Text>
        </View>
        {isCEO && (
          <View style={aStyles.ceoBadge}>
            <FontAwesome5 name="crown" size={11} color={Colors.primary} />
            <Text style={aStyles.ceoText}> CEO Approved</Text>
          </View>
        )}
      </View>

      {/* Budget line */}
      {r.budget_snapshot && (
        <View style={aStyles.budgetRow}>
          <FontAwesome5 name="wallet" size={11} color="#6B7280" />
          <Text style={aStyles.budgetText}>
            {'  Budget: ' + (r.budget_snapshot.liters_used ?? 0) + ' L / ' + (r.budget_snapshot.budget_liters ?? 0) + ' L'}
          </Text>
        </View>
      )}

      {/* Reason */}
      {r.request_reason ? (
        <Text style={aStyles.reason} numberOfLines={2}>{'"' + r.request_reason + '"'}</Text>
      ) : null}

      {/* Urgency + Status badge row */}
      <View style={aStyles.badgeRow}>
        <View style={[aStyles.urgBadge, { borderColor: urgColor }]}>
          <Text style={[aStyles.urgText, { color: urgColor }]}>{urg.toUpperCase()}</Text>
        </View>
        <View style={[aStyles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[aStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={aStyles.btnRow}>
        <TouchableOpacity style={aStyles.detailsBtn}
          onPress={() => {
            const urg    = (r.urgency || 'medium').toUpperCase();
            const litres = r.liters_approved ?? r.liters_requested ?? 0;
            const chain  = (r.approvalChain || [])
              .map((s: any) => 'L' + s.level + ' ' + (s.approver?.name || s.name || '') + ': ' + (s.status || 'pending'))
              .join('\n');
            Alert.alert(
              (r.site_name || r.site_id) + ' — ' + litres + ' L',
              [
                'Site ID: '      + r.site_id,
                'Cluster: '      + (r.cluster || '—'),
                'Cycle: '        + (r.cycle_key || '—'),
                'Urgency: '      + urg,
                'Status: '       + (r.status || '—').toUpperCase(),
                'Approved L: '   + litres + ' L',
                'XAF: '          + (litres * 828).toLocaleString(),
                'Reason: '       + (r.request_reason || '—'),
                chain ? ('\nApproval Chain:\n' + chain) : '',
              ].filter(Boolean).join('\n'),
              [
                { text: 'Close', style: 'cancel' },
                { text: 'Start Refueling', onPress: () => router.push({
                    pathname: '/(technician)/refueling-flow/activate-site',
                    params: { siteId: r.site_id, siteCode: r.site_id, siteName: r.site_name,
                      fuelRequestId: r._id, approvedLiters: String(litres),
                      currentFuelLevel: String(currentLevel ?? ''),
                      tankCapacity: String(tankCapacity ?? '') }
                  })
                },
              ],
            );
          }}
        >
          <FontAwesome5 name="info-circle" size={13} color={Colors.primary} />
          <Text style={aStyles.detailsBtnText}>Details</Text>
        </TouchableOpacity>

        {(canStart || canResume) && (
          <TouchableOpacity
            style={[aStyles.startBtn, canResume && { backgroundColor: '#FEF3C7' }]}
            onPress={() => router.push({
              pathname: '/(technician)/refueling-flow/activate-site',
              params: { siteId: r.site_id, siteCode: r.site_id, siteName: r.site_name,
                fuelRequestId: r._id, approvedLiters: String(litres),
                currentFuelLevel: String(currentLevel ?? ''),
                tankCapacity: String(tankCapacity ?? '') }
            })}
          >
            <FontAwesome5 name="play" size={11} color={canResume ? '#D97706' : '#fff'} />
            <Text style={[aStyles.startBtnText, canResume && { color: '#D97706' }]}>
              {canResume ? 'Resume' : 'Start Refueling'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AssignmentSection({ assignments }: { assignments: any[] }) {
  // Group by date
  const groups: Record<string, any[]> = {};
  for (const r of assignments) {
    const raw = r.scheduled_date || r.visit_date || r.approved_at;
    const key = raw ? new Date(raw).toISOString().split('T')[0] : 'Unscheduled';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  const sorted = Object.entries(groups).sort(([a], [b]) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10, paddingHorizontal: 2 }}>
        {'⛽ My Fuel Assignments (' + assignments.length + ')'}
      </Text>
      {sorted.map(([dateKey, reqs]) => (
        <View key={dateKey}>
          {/* Date header */}
          <View style={aStyles.dateHeader}>
            <FontAwesome5 name="calendar-alt" size={13} color={Colors.primary} />
            <Text style={aStyles.dateText}>
              {dateKey === 'Unscheduled'
                ? 'Unscheduled'
                : new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
                  })}
            </Text>
            <View style={aStyles.dateBadge}>
              <Text style={aStyles.dateBadgeText}>{reqs.length}</Text>
            </View>
          </View>
          {reqs.map(r => <AssignmentCard key={r._id} r={r} />)}
        </View>
      ))}
    </View>
  );
}

const aStyles = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  fuelIndicatorSmall: { alignItems: 'center', minWidth: 60 },
  fuelPctSmall: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  fuelLabelSmall: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  tankText:    { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  siteName:    { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 2 },
  siteId:      { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  litreBox:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 10, padding: 12, marginBottom: 10 },
  litreRow:    { flexDirection: 'row', alignItems: 'center' },
  litreText:   { fontSize: 32, fontWeight: '900', color: Colors.primary },
  xafText:     { fontSize: 12, color: Colors.primary, opacity: 0.7, marginTop: 2 },
  ceoBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FFCDD2' },
  ceoText:     { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  budgetRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  budgetText:  { fontSize: 12, color: '#6B7280' },
  reason:      { fontSize: 13, color: '#374151', fontStyle: 'italic', marginBottom: 10, lineHeight: 18 },
  badgeRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  urgBadge:    { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1.5, backgroundColor: '#fff' },
  urgText:     { fontSize: 12, fontWeight: '800' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1.5, backgroundColor: '#fff' },
  statusText:  { fontSize: 12, fontWeight: '700' },
  btnRow:      { flexDirection: 'row', gap: 10 },
  detailsBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  detailsBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  startBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 12 },
  startBtnText:{ fontSize: 14, color: '#fff', fontWeight: '800' },
  dateHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 2, marginBottom: 6 },
  dateText:    { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },
  dateBadge:   { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  dateBadgeText:{ fontSize: 11, fontWeight: '800', color: '#fff' },
});

export default function RefuelingScreen() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [statusFilter,     setStatusFilter]     = useState<StatusFilter>("all");
  const [fuelAssignments,  setFuelAssignments]  = useState<any[]>([]);

  const fetchSites = async () => {
    try {
      setLoading(true);
      console.log("🔄 [Refueling] fetchSites() called");
      // Cached: renders the last-known site list (scheduled AND unscheduled
      // -- see the backend route below) immediately if offline, and
      // silently refreshes + re-caches once connectivity returns.
      const { data: response, fromCache } = await cachedGet<ApiResponse<Site[]>>("/technician/refuel/sites");
      setIsOffline(fromCache);
      console.log("📦 [Refueling] sites count received:", response?.data?.length ?? 0, fromCache ? "(from cache)" : "(fresh)");
      try {
        const { data: ar } = await cachedGet("/fuel-requests/scheduled-for-me");
        const assignments  = ar?.data || [];
        setAssignmentsCount(assignments.length);
        setFuelAssignments(assignments);
      } catch { /* no-op */ }
      const incoming: Site[] = response?.data ?? [];
      if (incoming.length === 0) console.warn("⚠️  [Refueling] No sites returned from API");
      setSites(incoming);
    } catch (error: any) {
      console.error("❌ [Refueling] fetchSites error:", error?.message ?? error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSites(); }, []);
  useFocusEffect(React.useCallback(() => { fetchSites(); }, []));
  // Whatever synced while offline now reflects on the server -- refresh automatically.
  useSyncCompletion(fetchSites);

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

    // If searching, search ALL selectable sites and skip the tab filter
    // entirely — same behavior as maintenance select-site.tsx. Previously
    // this fell through to the scheduled/unscheduled filter below even
    // while searching, so searching for an unscheduled site while on the
    // "Scheduled" tab silently found nothing.
    if (q) {
      return selectable.filter(
        (s) => s.name?.toLowerCase().includes(q) || s.site_id?.toLowerCase().includes(q)
      );
    }

    if (statusFilter === "scheduled")   return selectable.filter((s) => !!s.maintenanceId);
    if (statusFilter === "unscheduled") return selectable.filter((s) => !s.maintenanceId);
    return selectable;
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

  // getFuelColor and formatDate moved to module level (see above
  // AssignmentCard) so both this component and AssignmentCard can use
  // the same functions.

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
        <View style={{ flexDirection: 'row', gap: 8 }}>

          <TouchableOpacity style={[styles.hBtn, { backgroundColor: "rgba(183,28,28,0.85)" }]}
            onPress={() => router.push("/(technician)/refueling-flow/request-fuel")}>
            <FontAwesome5 name="plus" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <FontAwesome5 name="wifi" size={11} color="#92400E" />
          <Text style={styles.offlineBannerText}>Offline — showing last saved sites</Text>
        </View>
      )}

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
        {/* ── Fuel Request Assignments ── */}
        {fuelAssignments.length > 0 && (
          <AssignmentSection assignments={fuelAssignments} />
        )}

        {grouped.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="tint-slash" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery
                ? t("no_results_for", `No results for "${searchQuery}"`)
                : t("no_refueling_tasks", "No sites available")}
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

  offlineBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", paddingVertical: 6, paddingHorizontal: 16,
  },
  offlineBannerText: { color: "#92400E", fontSize: 12, fontWeight: "500" },

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
  hBtn:       { width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  hBadge:     { position: "absolute", top: -4, right: -4, backgroundColor: "#e53935", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  hBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});



