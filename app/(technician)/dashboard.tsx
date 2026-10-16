// app/(technician)/dashboard.tsx
// FIXED: stats are now current/cycle-scoped, not all-time lifetime counts.
// NEW: fuel request quick stats pulled in parallel.
// EN/FR via useTranslation throughout.

import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { FontAwesome5 }  from '@expo/vector-icons';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
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
import { processQueue }  from '../../services/syncManager';
import { useSyncCompletion } from '../../hooks/useSyncCompletion';
import { isFuelRole, isRestrictedAcScopeRole } from '../../utils/roles';
import { countPendingShares } from '../../lib/whatsappShareQueue';

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
  // Tank audit drafts belong to this technician specifically — tracked
  // separately from the general scheduled/in-progress/completed task
  // counts above, since those come from a different source (maintenance
  // visits) and mixing an unrelated metric in would misrepresent both.
  const [tankAuditDraftCount, setTankAuditDraftCount] = useState(0);
  // Unsent WhatsApp reports (see lib/whatsappShareQueue.ts) — purely
  // local to this device, so refreshed on focus rather than as part of
  // fetchDashboard's server calls below.
  const [pendingShareCount, setPendingShareCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      countPendingShares().then(setPendingShareCount).catch(() => {});
    }, []),
  );

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

      try {
        const userStr = await AsyncStorage.getItem('user');
        const userId = userStr ? (JSON.parse(userStr)?.id || JSON.parse(userStr)?._id) : null;
        if (userId) {
          const draftsRes = await api.get('/technician/tank-audits', {
            params: { status: 'draft', createdBy: userId, limit: 1 },
          });
          setTankAuditDraftCount(draftsRes.data?.pagination?.total ?? (draftsRes.data?.data || []).length);
        }
      } catch { /* offline or request failed — banner just won't show this refresh */ }

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

        {/* ── Tank audit drafts — this technician's own in-progress audits ── */}
        {tankAuditDraftCount > 0 && (
          <TouchableOpacity
            style={styles.draftBanner}
            onPress={() => router.push('/(technician)/select-site-tank-audit')}
          >
            <Ionicons name="water-outline" size={20} color="#92400E" />
            <Text style={styles.draftBannerText}>
              {tankAuditDraftCount === 1
                ? t('tank_audit_draft_singular', '1 Tank Audit draft in progress — tap to resume')
                : t('tank_audit_draft_plural', '{{count}} Tank Audit drafts in progress — tap to resume', { count: tankAuditDraftCount })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#92400E" />
          </TouchableOpacity>
        )}

        {/* ── Unsent WhatsApp reports — technician tapped "Share Later" ── */}
        {pendingShareCount > 0 && (
          <TouchableOpacity
            style={styles.whatsappBanner}
            onPress={() => router.push('/(technician)/pending-whatsapp-shares')}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#166534" />
            <Text style={styles.whatsappBannerText}>
              {pendingShareCount === 1
                ? t('whatsapp_share_pending_singular', '1 WhatsApp report not yet shared — tap to send it')
                : t('whatsapp_share_pending_plural', '{{count}} WhatsApp reports not yet shared — tap to send them', { count: pendingShareCount })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#166534" />
          </TouchableOpacity>
        )}

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
            onPress={async () => {
              // Two genuinely separate offline mechanisms exist in this
              // app: the legacy AsyncStorage-based one below (site
              // visits only), and the SQLite-backed sync_queue used by
              // everything built since (tank audits, refueling, parts
              // requests, etc — see services/syncManager.ts). This
              // button used to only drain the first, which meant a
              // technician pressing "Sync Now" to force a stuck tank
              // audit draft through would see the button do something,
              // report success, and the audit would still not be on the
              // server — the button was real, it just wasn't wired to
              // the thing they needed it for. Now drains both.
              await Promise.all([syncOfflineVisits(), processQueue()]);
              await fetchDashboard();
            }}
          />
          {!isFuelTech && (
            <QuickActionCard
              title="preventive_maintenance" subtitle="scheduled_checks"
              badgeText={{ key: 'assigned_count', count: stats?.actionCounts?.preventive || 0 }}
              icon="checkmark-done" color={Colors.primary}
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
              badgeText="new" icon="water-outline" color={Colors.danger}
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
          {!isFuelTech && (
            <QuickActionCard
              title="tank_audit" subtitle="tank_capacity_leak_checklist"
              badgeText="new" icon="water-outline" color="#0e7490"
              // Same known, self-resolving typed-routes staleness as the
              // route's own push() call in select-site-tank-audit.tsx —
              // see the comment there for the full explanation.
              onPress={() => router.push('/(technician)/select-site-tank-audit' as any)}
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
  draftBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A',
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 20,
  },
  draftBannerText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600' },
  whatsappBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0',
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 20,
  },
  whatsappBannerText: { flex: 1, color: '#166534', fontSize: 13, fontWeight: '600' },
  fuelStatsRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
  fuelStatCard:  { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, elevation: 1 },
  fuelStatNum:   { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  fuelStatLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  actionsContainer: { marginBottom: 24 },
});













