// app/(technician)/dashboard.tsx
// FIXED: stats are now current/cycle-scoped, not all-time lifetime counts.
// NEW: fuel request quick stats pulled in parallel.
// EN/FR via useTranslation throughout.

import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { FontAwesome5 }  from '@expo/vector-icons';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { router }        from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import LanguageSwitcher  from '../../components/LanguageSwitcher';
import { QuickActionCard } from '../../components/QuickActionCard';
import { SummaryCard }   from '../../components/SummaryCard';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { Colors }        from '../../constants/Colors';
import { useAuth }       from '../../context/AuthContext';
import { api }           from '../../services/api';
import { cachedGet }     from '../../services/offlineApi';
import { useSyncCompletion } from '../../hooks/useSyncCompletion';
import { isFuelRole, isRestrictedAcScopeRole } from '../../utils/roles';

interface DashboardStats {
  pendingTasks:           number; // awaiting supervisor approval
  scheduledTasks:         number; // visit_date >= today (CURRENT only)
  inProgressTasks:        number; // active right now
  completedTasks:         number; // this cycle (26th–25th)
  completedThisMonth:     number; // calendar month
  totalCompleted:         number; // all time (for history tab)
  fuelRequestsScheduled:  number; // approved fuel requests, awaiting refueling
  fuelRequestsPending:    number; // raised requests in approval chain
  actionCounts?: {
    preventive?:  number;
    corrective?:  number;
    refueling?:   number;
    generator?:   number;
    fuel_refill?: number;
    cleaning?:    number;
    power_cabinet?:number;
    grid?:        number;
    shelter?:     number;
  };
}

export default function TechnicianDashboard() {
  const { user }       = useAuth();
  const { t, i18n }   = useTranslation();
  const isAcTech       = isRestrictedAcScopeRole(user?.role);
  const isFuelTech     = isFuelRole(user?.role);

  const [stats,           setStats]           = useState<DashboardStats | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<any>(null);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [isOffline,       setIsOffline]       = useState(false);

  // ── Offline visit sync ────────────────────────────────────────────────────
  const syncOfflineVisits = async () => {
    try {
      const keys       = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(k => k.startsWith('offline_visit_'));
      for (const key of offlineKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        let record: any;
        try { record = JSON.parse(raw); } catch { continue; }
        if (!record?.siteId) continue;
        const formData = new FormData();
        Object.entries(record.fields || {}).forEach(([k, v]) => {
          formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        });
        formData.append('submit_type', record.submit_type || 'draft');
        (record.photos || []).forEach((photo: any, i: number) => {
          formData.append('photos', { uri: photo.uri, name: `offline_${i}.jpg`, type: 'image/jpeg' } as any);
        });
        try {
          await api.post(`/sites/${record.siteId}/visit`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          await AsyncStorage.removeItem(key);
        } catch (err: any) { if (!err?.response) break; }
      }
    } catch (e) { console.error('Offline sync failed:', e); }
  };

  // ── Dashboard fetch ───────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    try {
      await syncOfflineVisits();
      const { data: res, fromCache } = await cachedGet('/technician/dashboard/me');
      setIsOffline(fromCache);

      try {
        const { data: att } = await cachedGet('/technician/daily-status');
        setDailyAttendance(att.success && att.checkedIn ? att.data : null);
      } catch { setDailyAttendance(null); }

      if (res?.data) {
        const d = res.data;
        // Normalise action counts
        if (d.actionCounts) {
          const c = d.actionCounts;
          if (c.preventive === undefined)
            c.preventive = (c.generator||0)+(c.cleaning||0)+(c.power_cabinet||0)+(c.grid||0)+(c.shelter||0);
          if (c.refueling  === undefined) c.refueling  = c.fuel_refill || 0;
          if (c.corrective === undefined) c.corrective = 0;
          if (isAcTech) { c.preventive = (c.cleaning||0)+(c.shelter||0); c.refueling = 0; c.corrective = 0; }
          if (isFuelTech){ c.preventive = c.fuel_refill || 0; c.corrective = 0; }
        }
        setStats(d);
      }
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAcTech, isFuelTech]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useSyncCompletion(fetchDashboard);
  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const res = await api.post('/technician/daily-check-in', {});
      if (res.data.success) { setDailyAttendance(res.data.data); fetchDashboard(); }
    } catch (e) { console.error('Check-in failed:', e); }
    finally { setLoading(false); }
  };

  const navigateTo = (type: string) => {
    if (type === 'corrective') { router.push({ pathname: '/(technician)/parts' }); return; }
    router.push({ pathname: '/(technician)/select-site', params: { requiredAction: type } });
  };

  const formattedDate = new Date().toLocaleDateString(
    i18n.language === 'fr' ? 'fr-FR' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <SafeAreaView style={styles.container}>
      <LanguageSwitcher />
      <LoadingOverlay visible={loading} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('hi')}, {user?.fullName?.split(' ')[0]}</Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
            <Text style={styles.offlineBannerText}>{t('offline_cached', 'Offline — showing last saved data')}</Text>
          </View>
        )}

        {/* Daily attendance */}
        {dailyAttendance ? (
          <View style={styles.checkedInCard}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.checkedInTitle}>{t('checked_in', 'Checked In')}</Text>
              <Text style={styles.checkedInSub}>
                {t('checked_in_for_today_at', { time: new Date(dailyAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.checkInButton} onPress={handleCheckIn}>
            <View style={styles.checkInIcon}><Ionicons name="location" size={24} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkInTitle}>{t('check_in_for_today', 'Check In for Today')}</Text>
              <Text style={styles.checkInSub}>{t('tap_to_mark_attendance', 'Tap to mark attendance')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ── CURRENT TASKS summary — today/cycle scope ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('current_tasks', 'Current Tasks')}</Text>
          <Text style={styles.sectionSub}>{t('this_cycle', 'This cycle')}</Text>
        </View>
        <View style={styles.summaryRow}>
          <SummaryCard label="scheduled"   count={stats?.scheduledTasks   || 0} type="neutral"   style={{ flex:1, marginRight:6 }} />
          <SummaryCard label="in_progress" count={stats?.inProgressTasks  || 0} type="neutral"   style={{ flex:1, marginRight:6 }} />
          <SummaryCard label="completed"   count={stats?.completedTasks   || 0} type="completed" style={{ flex:1 }} />
        </View>

        {/* ── Fuel request stats (if not AC-only) ── */}
        {!isAcTech && (stats?.fuelRequestsScheduled || 0) + (stats?.fuelRequestsPending || 0) > 0 && (
          <View style={styles.fuelStatsRow}>
            <TouchableOpacity style={[styles.fuelStatCard, { borderColor: Colors.primary }]}
              onPress={() => router.push('/(technician)/refueling-flow/scheduled-for-me')}>
              <Text style={[styles.fuelStatNum, { color: Colors.primary }]}>{stats?.fuelRequestsScheduled || 0}</Text>
              <Text style={styles.fuelStatLabel}>{t('fuel_to_deliver', 'To Deliver')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fuelStatCard, { borderColor: '#F59E0B' }]}
              onPress={() => router.push('/(technician)/refueling-flow/request-fuel')}>
              <Text style={[styles.fuelStatNum, { color: '#F59E0B' }]}>{stats?.fuelRequestsPending || 0}</Text>
              <Text style={styles.fuelStatLabel}>{t('fuel_pending', 'Pending Approval')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick Actions ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('quick_actions', 'Quick Actions')}</Text>
        </View>
        <View style={styles.actionsContainer}>
          <QuickActionCard
            title="sync_now" subtitle="upload_offline_visits" badgeText="manual_sync"
            icon="cloud-upload" color={Colors.success}
            onPress={async () => { await syncOfflineVisits(); await fetchDashboard(); }}
          />
          {!isFuelTech && (
            <QuickActionCard
              title="preventive_maintenance" subtitle="scheduled_checks"
              badgeText={{ key: 'assigned_count', count: stats?.actionCounts?.preventive || 0 }}
              icon="clipboard-check" color={Colors.primary}
              onPress={() => navigateTo('preventive')}
            />
          )}
          {!isAcTech && (
            <QuickActionCard
              title="refueling_management" subtitle="fuel_log_tank_level"
              badgeText={{ key: 'assigned_count', count: stats?.actionCounts?.refueling || 0 }}
              icon="water" color={Colors.warning}
              onPress={() => router.push('/(technician)/refueling')}
            />
          )}
          {!isAcTech && (
            <QuickActionCard
              title="request_fuel" subtitle="raise_fuel_request"
              badgeText="new" icon="droplet" color={Colors.danger}
              onPress={() => router.push('/(technician)/refueling-flow/request-fuel')}
            />
          )}
          {!isAcTech && !isFuelTech && (
            <QuickActionCard
              title="corrective_maintenance" subtitle="repairs_issues"
              badgeText={{ key: 'assigned_count', count: stats?.actionCounts?.corrective || 0 }}
              icon="construct" color={Colors.error}
              onPress={() => navigateTo('corrective')}
            />
          )}
          {!isFuelTech && (
            <QuickActionCard
              title="site_audit" subtitle="audit_a_site"
              badgeText="new" icon="search" color={Colors.warning}
              onPress={() => router.push('/(technician)/select-site-audit')}
            />
          )}
          {!isFuelTech && (
            <QuickActionCard
              title="hse_inspection" subtitle="site_integrity_checklist"
              badgeText="hse" icon="shield-checkmark" color="#c0392b"
              onPress={() => router.push('/(technician)/select-site-hse')}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  content:       { padding: 20, paddingBottom: 40 },
  header:        { marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting:      { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  date:          { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 },
  offlineBannerText: { color: '#92400E', fontSize: 12, fontWeight: '500' },
  checkedInCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  checkedInTitle:{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  checkedInSub:  { fontSize: 13, color: Colors.textSecondary },
  checkInButton: { backgroundColor: Colors.success, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24, shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  checkInIcon:   { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  checkInTitle:  { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  checkInSub:    { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  sectionHeader: { marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle:  { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  sectionSub:    { fontSize: 12, color: Colors.textSecondary },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  fuelStatsRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
  fuelStatCard:  { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, elevation: 1 },
  fuelStatNum:   { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  fuelStatLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  actionsContainer: { marginBottom: 24 },
});

















// import React from "react";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { Ionicons } from "@expo/vector-icons";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { router } from "expo-router";
// import { useEffect, useState } from "react";
// import { useTranslation } from "react-i18next";
// import {
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import LanguageSwitcher from "../../components/LanguageSwitcher";
// import { QuickActionCard } from "../../components/QuickActionCard";
// import { SummaryCard } from "../../components/SummaryCard";
// import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
// import { Colors } from "../../constants/Colors";
// import { useAuth } from "../../context/AuthContext";
// import { api } from "../../services/api";
// import { cachedGet } from "../../services/offlineApi";
// import { useSyncCompletion } from "../../hooks/useSyncCompletion";
// import { ApiResponse } from "../../types/common.types";
// import { isFuelRole, isRestrictedAcScopeRole } from "../../utils/roles";

// interface DashboardStats {
//   pendingTasks: number;
//   scheduledTasks: number;
//   inProgressTasks: number;
//   completedThisMonth: number;
//   totalCompleted: number;
//   actionCounts?: {
//     generator: number;
//     fuel_refill: number;
//     cleaning: number;
//     power_cabinet: number;
//     grid: number;
//     shelter: number;
//     preventive?: number;
//     corrective?: number;
//     refueling?: number;
//   };
// }

// // ─────────────────────────────────────────────
// // Component
// // ─────────────────────────────────────────────
// export default function TechnicianDashboard() {
//   const { user } = useAuth();
//   const { t, i18n } = useTranslation();
//   const isAcTechnician = isRestrictedAcScopeRole(user?.role);
//   const isFuelTechnician = isFuelRole(user?.role);

//   const [stats, setStats] = useState<DashboardStats | null>(null);
//   const [dailyAttendance, setDailyAttendance] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [isOffline, setIsOffline] = useState(false);

//   const syncOfflineVisits = async () => {
//     try {
//       const keys = await AsyncStorage.getAllKeys();
//       const offlineKeys = keys.filter((k) => k.startsWith("offline_visit_"));

//       for (const key of offlineKeys) {
//         const raw = await AsyncStorage.getItem(key);
//         if (!raw) continue;
//         let record: any = null;
//         try {
//           record = JSON.parse(raw);
//         } catch {
//           continue;
//         }

//         if (!record?.siteId) continue;

//         const formData = new FormData();
//         if (record.fields?.Actual_Date_Visit) {
//           formData.append("Actual_Date_Visit", record.fields.Actual_Date_Visit);
//         }
//         if (record.fields?.Type_of_Visit) {
//           formData.append("Type_of_Visit", record.fields.Type_of_Visit);
//         }
//         if (record.fields?.technician_id) {
//           formData.append("technician_id", record.fields.technician_id);
//         }
//         formData.append("submit_type", record.submit_type || "draft");

//         if (record.fields?.hours_on_site) {
//           formData.append("hours_on_site", record.fields.hours_on_site);
//         }
//         if (record.fields?.work_performed) {
//           formData.append("work_performed", record.fields.work_performed);
//         }
//         if (record.fields?.generators_checked) {
//           formData.append(
//             "generators_checked",
//             JSON.stringify(record.fields.generators_checked),
//           );
//         }
//         if (record.fields?.fuel_data) {
//           formData.append("fuel_data", JSON.stringify(record.fields.fuel_data));
//         }
//         if (record.fields?.electrical_data) {
//           formData.append(
//             "electrical_data",
//             JSON.stringify(record.fields.electrical_data),
//           );
//         }
//         if (record.fields?.Issues_Found) {
//           formData.append(
//             "Issues_Found",
//             JSON.stringify(record.fields.Issues_Found),
//           );
//         }

//         (record.photos || []).forEach((photo: any, index: number) => {
//           formData.append("photos", {
//             uri: photo.uri,
//             name: `offline_${index}.jpg`,
//             type: "image/jpeg",
//           } as any);
//         });

//         try {
//           await api.post(`/sites/${record.siteId}/visit`, formData, {
//             headers: { "Content-Type": "multipart/form-data" },
//           });
//           await AsyncStorage.removeItem(key);
//         } catch (err: any) {
//           if (!err?.response) {
//             break;
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Offline visit sync failed:", error);
//     }
//   };

//   const fetchDashboard = async () => {
//     try {
//       await syncOfflineVisits();

//       // Cached: renders the last-known stats immediately if offline, and
//       // refreshes + re-caches automatically whenever there's a connection.
//       const { data: response, fromCache } = await cachedGet<ApiResponse<DashboardStats>>(
//         "/technician/dashboard/me",
//       );
//       setIsOffline(fromCache);

//       // Daily attendance — also cached so the check-in card doesn't flicker
//       // to the "not checked in" state just because we're offline.
//       try {
//         const { data: attendanceRes } = await cachedGet("/technician/daily-status");
//         if (attendanceRes.success && attendanceRes.checkedIn) {
//           setDailyAttendance(attendanceRes.data);
//         } else {
//           setDailyAttendance(null);
//         }
//       } catch {
//         setDailyAttendance(null);
//       }

//       console.log("📊 Dashboard Response:", JSON.stringify(response, null, 2));

//       if (response.data) {
//         const data = response.data;
//         if (data.actionCounts) {
//           const counts = data.actionCounts;
//           if (counts.preventive === undefined) {
//             counts.preventive =
//               (counts.generator || 0) +
//               (counts.cleaning || 0) +
//               (counts.power_cabinet || 0) +
//               (counts.grid || 0) +
//               (counts.shelter || 0);
//           }
//           if (counts.refueling === undefined) {
//             counts.refueling = counts.fuel_refill || 0;
//           }
//           if (counts.corrective === undefined) {
//             counts.corrective = 0;
//           }
//           if (isAcTechnician) {
//             counts.preventive = (counts.cleaning || 0) + (counts.shelter || 0);
//             counts.refueling = 0;
//             counts.corrective = 0;
//           }
//           if (isFuelTechnician) {
//             counts.preventive = counts.fuel_refill || 0;
//             counts.corrective = 0;
//           }
//         }
//         setStats(data);
//       }
//     } catch (error: any) {
//       console.error("Fetch dashboard error", error);
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   };

//   useEffect(() => {
//     fetchDashboard();
//   }, []);

//   // Whatever was queued while offline (submitted forms, workflow updates,
//   // etc.) has now synced -- refresh so the dashboard reflects the true
//   // server state without the technician needing to pull-to-refresh.
//   useSyncCompletion(fetchDashboard);

//   const currentDate = new Date();
//   const formattedDate = currentDate.toLocaleDateString(
//     i18n.language === "fr" ? "fr-FR" : "en-US",
//     {
//       weekday: "long",
//       year: "numeric",
//       month: "long",
//       day: "numeric",
//     },
//   );

//   const onRefresh = () => {
//     setRefreshing(true);
//     fetchDashboard();
//   };

//   const handleCheckIn = async () => {
//     setLoading(true);
//     try {
//       const res = await api.post("/technician/daily-check-in", {});
//       if (res.data.success) {
//         setDailyAttendance(res.data.data);
//         alert("Checked in successfully!");
//         fetchDashboard();
//       }
//     } catch (error) {
//       console.error("Check in failed", error);
//       alert("Check in failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const navigateToSiteSelection = (type: string) => {
//     if (type === "corrective") {
//       router.push({ pathname: "/(technician)/parts" });
//       return;
//     }
//     router.push({
//       pathname: "/(technician)/select-site",
//       params: { requiredAction: type },
//     });
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <LanguageSwitcher />
//       <LoadingOverlay visible={loading} />
//       <ScrollView
//         contentContainerStyle={styles.content}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//         }
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Header Section */}
//         <View style={styles.header}>
//           <View>
//             <Text style={styles.greeting}>
//               {t("hi")}, {user?.fullName?.split(" ")[0]}
//             </Text>
//             <Text style={styles.date}>{formattedDate}</Text>
//           </View>
//         </View>

//         {isOffline && (
//           <View style={styles.offlineBanner}>
//             <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
//             <Text style={styles.offlineBannerText}>
//               Offline — showing last saved data
//             </Text>
//           </View>
//         )}

//         {/* Daily Attendance Section */}
//         {dailyAttendance ? (
//           <View
//             style={{
//               backgroundColor: Colors.surface,
//               padding: 16,
//               borderRadius: 12,
//               marginBottom: 20,
//               elevation: 2,
//               shadowColor: "#000",
//               shadowOffset: { width: 0, height: 1 },
//               shadowOpacity: 0.1,
//               shadowRadius: 2,
//             }}
//           >
//             <View
//               style={{
//                 flexDirection: "row",
//                 alignItems: "center",
//                 marginBottom: 8,
//               }}
//             >
//               <Ionicons
//                 name="checkmark-circle"
//                 size={24}
//                 color={Colors.success}
//               />
//               <Text
//                 style={{
//                   marginLeft: 8,
//                   fontSize: 18,
//                   fontWeight: "bold",
//                   color: Colors.text,
//                 }}
//               >
//                 {t("checked_in")}
//               </Text>
//             </View>
//             <Text style={{ color: Colors.textSecondary }}>
//               {t("checked_in_for_today_at", {
//                 time: new Date(dailyAttendance.checkInTime).toLocaleTimeString(
//                   [],
//                   {
//                     hour: "2-digit",
//                     minute: "2-digit",
//                   },
//                 ),
//               })}
//             </Text>
//           </View>
//         ) : (
//           <TouchableOpacity
//             style={styles.checkInButton}
//             onPress={handleCheckIn}
//           >
//             <View style={styles.checkInIconContainer}>
//               <Ionicons name="location" size={24} color={Colors.surface} />
//             </View>
//             <View>
//               <Text style={styles.checkInTitle}>{t("check_in_for_today")}</Text>
//               <Text style={styles.checkInSubtitle}>
//                 {t("tap_to_mark_attendance")}
//               </Text>
//             </View>
//             <Ionicons
//               name="chevron-forward"
//               size={24}
//               color={Colors.surface}
//               style={{ marginLeft: "auto" }}
//             />
//           </TouchableOpacity>
//         )}

//         {/* Summary Section */}
//         <View style={styles.sectionHeader}>
//           <Text style={styles.sectionTitle}>{t("todays_summary")}</Text>
//         </View>
//         <View style={styles.summaryContainer}>
//           <SummaryCard
//             label={"scheduled"}
//             count={stats?.scheduledTasks || 0}
//             type="neutral"
//             style={{ flex: 1, marginRight: 8 }}
//           />
//           <SummaryCard
//             label={"in_progress"}
//             count={stats?.inProgressTasks || 0}
//             type="neutral"
//             style={{ flex: 1, marginRight: 8 }}
//           />
//           <SummaryCard
//             label={"completed"}
//             count={stats?.completedTasks || 0}
//             type="completed"
//             style={{ flex: 1 }}
//           />
//         </View>

//         {/* Quick Actions Section */}
//         <View style={styles.sectionHeader}>
//           <Text style={styles.sectionTitle}>{t("quick_actions")}</Text>
//         </View>

//         <View style={styles.actionsContainer}>
//           <QuickActionCard
//             title={"sync_now"}
//             subtitle={"upload_offline_visits"}
//             badgeText={"manual_sync"}
//             icon="cloud-upload"
//             color={Colors.success}
//             onPress={async () => {
//               await syncOfflineVisits();
//               await fetchDashboard();
//             }}
//           />
//           {!isFuelTechnician && (
//             <QuickActionCard
//               title={"preventive_maintenance"}
//               subtitle={"scheduled_checks"}
//               badgeText={{
//                 key: "assigned_count",
//                 count: stats?.actionCounts?.preventive || 0,
//               }}
//               icon="clipboard-check"
//               color={Colors.primary}
//               onPress={() => navigateToSiteSelection("preventive")}
//             />
//           )}
//           {!isAcTechnician && (
//             <QuickActionCard
//               title={"refueling_management"}
//               subtitle={"fuel_log_tank_level"}
//               badgeText={{ key: "assigned_count", count: stats?.actionCounts?.refueling || 0 }}
//               icon="water"
//               color={Colors.warning}
//               onPress={() => router.push("/(technician)/refueling")}
//             />
//           )}
//           {!isAcTechnician && (
//             <QuickActionCard
//               title={"Request_fuel"}
//               subtitle={"Raise_fuel_request"}
//               badgeText={"new"}
//               icon="droplet"
//               color={Colors.danger}
//               onPress={() => router.push("/(technician)/refueling-flow/request-fuel")}
//             />
//           )}
//           {!isAcTechnician && !isFuelTechnician && (
//             <QuickActionCard
//               title={"corrective_maintenance"}
//               subtitle={"repairs_issues"}
//               badgeText={{
//                 key: "assigned_count",
//                 count: stats?.actionCounts?.corrective || 0,
//               }}
//               icon="construct"
//               color={Colors.error}
//               onPress={() => navigateToSiteSelection("corrective")}
//             />
//           )}
//           {!isFuelTechnician && (
//             <QuickActionCard
//               title={"site_audit"}
//               subtitle={"audit_a_site"}
//               badgeText={"new"}
//               icon="search"
//               color={Colors.warning}
//               onPress={() => router.push("/(technician)/select-site-audit")}
//             />
//           )}
//           {/* HSE Inspection — hidden for Fuel users */}
//           {!isFuelTechnician && (
//             <QuickActionCard
//               title={"HSE_inspection"}
//               subtitle={"Site_integrity_checklist"}
//               badgeText={"hse"}
//               icon="shield-checkmark"
//               color="#c0392b"
//               onPress={() => router.push("/(technician)/select-site-hse")}
//             />
//           )}
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// // ─────────────────────────────────────────────
// // Styles
// // ─────────────────────────────────────────────
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: Colors.background,
//   },
//   content: {
//     padding: 20,
//     paddingBottom: 40,
//   },
//   header: {
//     marginBottom: 24,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   greeting: {
//     fontSize: 28,
//     fontWeight: "bold",
//     color: Colors.text,
//     marginBottom: 4,
//   },
//   date: {
//     fontSize: 14,
//     color: Colors.textSecondary,
//     fontWeight: "500",
//   },
//   offlineBanner: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     backgroundColor: "#FEF3C7",
//     borderWidth: 1,
//     borderColor: "#FDE68A",
//     borderRadius: 10,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     marginBottom: 16,
//   },
//   offlineBannerText: {
//     color: "#92400E",
//     fontSize: 12,
//     fontWeight: "500",
//   },
//   sectionHeader: {
//     marginBottom: 12,
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: "bold",
//     color: Colors.text,
//   },
//   summaryContainer: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 32,
//   },
//   actionsContainer: {
//     marginBottom: 24,
//   },
//   checkInButton: {
//     backgroundColor: Colors.success,
//     borderRadius: 16,
//     padding: 16,
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 24,
//     shadowColor: Colors.success,
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   checkInIconContainer: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: "rgba(255,255,255,0.2)",
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 16,
//   },
//   checkInTitle: {
//     fontSize: 18,
//     fontWeight: "bold",
//     color: Colors.surface,
//     marginBottom: 4,
//   },
//   checkInSubtitle: {
//     fontSize: 14,
//     color: "rgba(255,255,255,0.8)",
//   },
// });












// import React from "react";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { Ionicons } from "@expo/vector-icons";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { router } from "expo-router";
// import { useEffect, useState } from "react";
// import { useTranslation } from "react-i18next";
// import {
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import LanguageSwitcher from "../../components/LanguageSwitcher";
// import { QuickActionCard } from "../../components/QuickActionCard";
// import { SummaryCard } from "../../components/SummaryCard";
// import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
// import { Colors } from "../../constants/Colors";
// import { useAuth } from "../../context/AuthContext";
// import { api } from "../../services/api";
// import { cachedGet } from "../../services/offlineApi";
// import { useSyncCompletion } from "../../hooks/useSyncCompletion";
// import { ApiResponse } from "../../types/common.types";
// import { isFuelRole, isRestrictedAcScopeRole } from "../../utils/roles";

// interface DashboardStats {
//   pendingTasks: number;
//   scheduledTasks: number;
//   inProgressTasks: number;
//   completedThisMonth: number;
//   totalCompleted: number;
//   actionCounts?: {
//     generator: number;
//     fuel_refill: number;
//     cleaning: number;
//     power_cabinet: number;
//     grid: number;
//     shelter: number;
//     preventive?: number;
//     corrective?: number;
//     refueling?: number;
//   };
// }

// // ─────────────────────────────────────────────
// // Component
// // ─────────────────────────────────────────────
// export default function TechnicianDashboard() {
//   const { user } = useAuth();
//   const { t, i18n } = useTranslation();
//   const isAcTechnician = isRestrictedAcScopeRole(user?.role);
//   const isFuelTechnician = isFuelRole(user?.role);

//   const [stats, setStats] = useState<DashboardStats | null>(null);
//   const [dailyAttendance, setDailyAttendance] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [isOffline, setIsOffline] = useState(false);

//   const syncOfflineVisits = async () => {
//     try {
//       const keys = await AsyncStorage.getAllKeys();
//       const offlineKeys = keys.filter((k) => k.startsWith("offline_visit_"));

//       for (const key of offlineKeys) {
//         const raw = await AsyncStorage.getItem(key);
//         if (!raw) continue;
//         let record: any = null;
//         try {
//           record = JSON.parse(raw);
//         } catch {
//           continue;
//         }

//         if (!record?.siteId) continue;

//         const formData = new FormData();
//         if (record.fields?.Actual_Date_Visit) {
//           formData.append("Actual_Date_Visit", record.fields.Actual_Date_Visit);
//         }
//         if (record.fields?.Type_of_Visit) {
//           formData.append("Type_of_Visit", record.fields.Type_of_Visit);
//         }
//         if (record.fields?.technician_id) {
//           formData.append("technician_id", record.fields.technician_id);
//         }
//         formData.append("submit_type", record.submit_type || "draft");

//         if (record.fields?.hours_on_site) {
//           formData.append("hours_on_site", record.fields.hours_on_site);
//         }
//         if (record.fields?.work_performed) {
//           formData.append("work_performed", record.fields.work_performed);
//         }
//         if (record.fields?.generators_checked) {
//           formData.append(
//             "generators_checked",
//             JSON.stringify(record.fields.generators_checked),
//           );
//         }
//         if (record.fields?.fuel_data) {
//           formData.append("fuel_data", JSON.stringify(record.fields.fuel_data));
//         }
//         if (record.fields?.electrical_data) {
//           formData.append(
//             "electrical_data",
//             JSON.stringify(record.fields.electrical_data),
//           );
//         }
//         if (record.fields?.Issues_Found) {
//           formData.append(
//             "Issues_Found",
//             JSON.stringify(record.fields.Issues_Found),
//           );
//         }

//         (record.photos || []).forEach((photo: any, index: number) => {
//           formData.append("photos", {
//             uri: photo.uri,
//             name: `offline_${index}.jpg`,
//             type: "image/jpeg",
//           } as any);
//         });

//         try {
//           await api.post(`/sites/${record.siteId}/visit`, formData, {
//             headers: { "Content-Type": "multipart/form-data" },
//           });
//           await AsyncStorage.removeItem(key);
//         } catch (err: any) {
//           if (!err?.response) {
//             break;
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Offline visit sync failed:", error);
//     }
//   };

//   const fetchDashboard = async () => {
//     try {
//       await syncOfflineVisits();

//       // Cached: renders the last-known stats immediately if offline, and
//       // refreshes + re-caches automatically whenever there's a connection.
//       const { data: response, fromCache } = await cachedGet<ApiResponse<DashboardStats>>(
//         "/technician/dashboard/me",
//       );
//       setIsOffline(fromCache);

//       // Daily attendance — also cached so the check-in card doesn't flicker
//       // to the "not checked in" state just because we're offline.
//       try {
//         const { data: attendanceRes } = await cachedGet("/technician/daily-status");
//         if (attendanceRes.success && attendanceRes.checkedIn) {
//           setDailyAttendance(attendanceRes.data);
//         } else {
//           setDailyAttendance(null);
//         }
//       } catch {
//         setDailyAttendance(null);
//       }

//       console.log("📊 Dashboard Response:", JSON.stringify(response, null, 2));

//       if (response.data) {
//         const data = response.data;
//         if (data.actionCounts) {
//           const counts = data.actionCounts;
//           if (counts.preventive === undefined) {
//             counts.preventive =
//               (counts.generator || 0) +
//               (counts.cleaning || 0) +
//               (counts.power_cabinet || 0) +
//               (counts.grid || 0) +
//               (counts.shelter || 0);
//           }
//           if (counts.refueling === undefined) {
//             counts.refueling = counts.fuel_refill || 0;
//           }
//           if (counts.corrective === undefined) {
//             counts.corrective = 0;
//           }
//           if (isAcTechnician) {
//             counts.preventive = (counts.cleaning || 0) + (counts.shelter || 0);
//             counts.refueling = 0;
//             counts.corrective = 0;
//           }
//           if (isFuelTechnician) {
//             counts.preventive = counts.fuel_refill || 0;
//             counts.corrective = 0;
//           }
//         }
//         setStats(data);
//       }
//     } catch (error: any) {
//       console.error("Fetch dashboard error", error);
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   };

//   useEffect(() => {
//     fetchDashboard();
//   }, []);

//   // Whatever was queued while offline (submitted forms, workflow updates,
//   // etc.) has now synced -- refresh so the dashboard reflects the true
//   // server state without the technician needing to pull-to-refresh.
//   useSyncCompletion(fetchDashboard);

//   const currentDate = new Date();
//   const formattedDate = currentDate.toLocaleDateString(
//     i18n.language === "fr" ? "fr-FR" : "en-US",
//     {
//       weekday: "long",
//       year: "numeric",
//       month: "long",
//       day: "numeric",
//     },
//   );

//   const onRefresh = () => {
//     setRefreshing(true);
//     fetchDashboard();
//   };

//   const handleCheckIn = async () => {
//     setLoading(true);
//     try {
//       const res = await api.post("/technician/daily-check-in", {});
//       if (res.data.success) {
//         setDailyAttendance(res.data.data);
//         alert("Checked in successfully!");
//         fetchDashboard();
//       }
//     } catch (error) {
//       console.error("Check in failed", error);
//       alert("Check in failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const navigateToSiteSelection = (type: string) => {
//     if (type === "corrective") {
//       router.push({ pathname: "/(technician)/parts" });
//       return;
//     }
//     router.push({
//       pathname: "/(technician)/select-site",
//       params: { requiredAction: type },
//     });
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <LanguageSwitcher />
//       <LoadingOverlay visible={loading} />
//       <ScrollView
//         contentContainerStyle={styles.content}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//         }
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Header Section */}
//         <View style={styles.header}>
//           <View>
//             <Text style={styles.greeting}>
//               {t("hi")}, {user?.fullName?.split(" ")[0]}
//             </Text>
//             <Text style={styles.date}>{formattedDate}</Text>
//           </View>
//         </View>

//         {isOffline && (
//           <View style={styles.offlineBanner}>
//             <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
//             <Text style={styles.offlineBannerText}>
//               Offline — showing last saved data
//             </Text>
//           </View>
//         )}

//         {/* Daily Attendance Section */}
//         {dailyAttendance ? (
//           <View
//             style={{
//               backgroundColor: Colors.surface,
//               padding: 16,
//               borderRadius: 12,
//               marginBottom: 20,
//               elevation: 2,
//               shadowColor: "#000",
//               shadowOffset: { width: 0, height: 1 },
//               shadowOpacity: 0.1,
//               shadowRadius: 2,
//             }}
//           >
//             <View
//               style={{
//                 flexDirection: "row",
//                 alignItems: "center",
//                 marginBottom: 8,
//               }}
//             >
//               <Ionicons
//                 name="checkmark-circle"
//                 size={24}
//                 color={Colors.success}
//               />
//               <Text
//                 style={{
//                   marginLeft: 8,
//                   fontSize: 18,
//                   fontWeight: "bold",
//                   color: Colors.text,
//                 }}
//               >
//                 {t("checked_in")}
//               </Text>
//             </View>
//             <Text style={{ color: Colors.textSecondary }}>
//               {t("checked_in_for_today_at", {
//                 time: new Date(dailyAttendance.checkInTime).toLocaleTimeString(
//                   [],
//                   {
//                     hour: "2-digit",
//                     minute: "2-digit",
//                   },
//                 ),
//               })}
//             </Text>
//           </View>
//         ) : (
//           <TouchableOpacity
//             style={styles.checkInButton}
//             onPress={handleCheckIn}
//           >
//             <View style={styles.checkInIconContainer}>
//               <Ionicons name="location" size={24} color={Colors.surface} />
//             </View>
//             <View>
//               <Text style={styles.checkInTitle}>{t("check_in_for_today")}</Text>
//               <Text style={styles.checkInSubtitle}>
//                 {t("tap_to_mark_attendance")}
//               </Text>
//             </View>
//             <Ionicons
//               name="chevron-forward"
//               size={24}
//               color={Colors.surface}
//               style={{ marginLeft: "auto" }}
//             />
//           </TouchableOpacity>
//         )}

//         {/* Summary Section */}
//         <View style={styles.sectionHeader}>
//           <Text style={styles.sectionTitle}>{t("todays_summary")}</Text>
//         </View>
//         <View style={styles.summaryContainer}>
//           <SummaryCard
//             label={"scheduled"}
//             count={stats?.scheduledTasks || 0}
//             type="neutral"
//             style={{ flex: 1, marginRight: 8 }}
//           />
//           <SummaryCard
//             label={"in_progress"}
//             count={stats?.inProgressTasks || 0}
//             type="neutral"
//             style={{ flex: 1, marginRight: 8 }}
//           />
//           <SummaryCard
//             label={"completed"}
//             count={stats?.completedTasks || 0}
//             type="completed"
//             style={{ flex: 1 }}
//           />
//         </View>

//         {/* Quick Actions Section */}
//         <View style={styles.sectionHeader}>
//           <Text style={styles.sectionTitle}>{t("quick_actions")}</Text>
//         </View>

//         <View style={styles.actionsContainer}>
//           <QuickActionCard
//             title={"sync_now"}
//             subtitle={"upload_offline_visits"}
//             badgeText={"manual_sync"}
//             icon="cloud-upload"
//             color={Colors.success}
//             onPress={async () => {
//               await syncOfflineVisits();
//               await fetchDashboard();
//             }}
//           />
//           {!isFuelTechnician && (
//             <QuickActionCard
//               title={"preventive_maintenance"}
//               subtitle={"scheduled_checks"}
//               badgeText={{
//                 key: "assigned_count",
//                 count: stats?.actionCounts?.preventive || 0,
//               }}
//               icon="clipboard-check"
//               color={Colors.primary}
//               onPress={() => navigateToSiteSelection("preventive")}
//             />
//           )}
//           {!isAcTechnician && (
//             <QuickActionCard
//               title={"refueling_management"}
//               subtitle={"fuel_log_tank_level"}
//               badgeText={{
//                 key: "assigned_count",
//                 count: stats?.actionCounts?.refueling || 0,
//               }}
//               icon="water"
//               color={Colors.warning}
//               onPress={() => router.push("/(technician)/refueling")}
//             />
//           )}
//           {!isAcTechnician && !isFuelTechnician && (
//             <QuickActionCard
//               title={"corrective_maintenance"}
//               subtitle={"repairs_issues"}
//               badgeText={{
//                 key: "assigned_count",
//                 count: stats?.actionCounts?.corrective || 0,
//               }}
//               icon="construct"
//               color={Colors.error}
//               onPress={() => navigateToSiteSelection("corrective")}
//             />
//           )}
//           {!isFuelTechnician && (
//             <QuickActionCard
//               title={"site_audit"}
//               subtitle={"audit_a_site"}
//               badgeText={"new"}
//               icon="search"
//               color={Colors.warning}
//               onPress={() => router.push("/(technician)/select-site-audit")}
//             />
//           )}
//           {/* HSE Inspection — hidden for Fuel users */}
//           {!isFuelTechnician && (
//             <QuickActionCard
//               title={"hse_inspection"}
//               subtitle={"site_integrity_checklist"}
//               badgeText={"hse"}
//               icon="shield-checkmark"
//               color="#c0392b"
//               onPress={() => router.push("/(technician)/select-site-hse")}
//             />
//           )}
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// // ─────────────────────────────────────────────
// // Styles
// // ─────────────────────────────────────────────
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: Colors.background,
//   },
//   content: {
//     padding: 20,
//     paddingBottom: 40,
//   },
//   header: {
//     marginBottom: 24,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   greeting: {
//     fontSize: 28,
//     fontWeight: "bold",
//     color: Colors.text,
//     marginBottom: 4,
//   },
//   date: {
//     fontSize: 14,
//     color: Colors.textSecondary,
//     fontWeight: "500",
//   },
//   offlineBanner: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     backgroundColor: "#FEF3C7",
//     borderWidth: 1,
//     borderColor: "#FDE68A",
//     borderRadius: 10,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     marginBottom: 16,
//   },
//   offlineBannerText: {
//     color: "#92400E",
//     fontSize: 12,
//     fontWeight: "500",
//   },
//   sectionHeader: {
//     marginBottom: 12,
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: "bold",
//     color: Colors.text,
//   },
//   summaryContainer: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 32,
//   },
//   actionsContainer: {
//     marginBottom: 24,
//   },
//   checkInButton: {
//     backgroundColor: Colors.success,
//     borderRadius: 16,
//     padding: 16,
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 24,
//     shadowColor: Colors.success,
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   checkInIconContainer: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: "rgba(255,255,255,0.2)",
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 16,
//   },
//   checkInTitle: {
//     fontSize: 18,
//     fontWeight: "bold",
//     color: Colors.surface,
//     marginBottom: 4,
//   },
//   checkInSubtitle: {
//     fontSize: 14,
//     color: "rgba(255,255,255,0.8)",
//   },
// });








