// app/(technician)/history.tsx
// Replaces the Maintenance bottom tab.
// Shows the authenticated technician's complete submission history:
//   - All completed maintenance visits (all time)
//   - All completed fuel refueling submissions (all time)
// Grouped by month, searchable, with summary stats at top.
// EN/FR via useTranslation.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { router }        from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 }  from '@expo/vector-icons';
import { Colors }        from '../../constants/Colors';
import { cachedGet }     from '../../services/offlineApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type VisitType = 'maintenance' | 'fuel';

interface HistoryItem {
  _id:        string;
  type:       VisitType;
  site_name:  string;
  site_id:    string;
  visit_date: string;
  completed_at?: string;
  visit_type?: string;   // maintenance: PM-RF-CM etc.
  status:     string;
  // Fuel-specific
  liters_added?:       number;
  liters_approved?:    number;
  balance_returned?:   number;
  fuel_purchase_id?:   string;
  // Maintenance-specific
  check_type?:  string;
  cluster?:     string;
  region?:      string;
}

// ── Month grouping ─────────────────────────────────────────────────────────────
function groupByMonth(items: HistoryItem[]): { title: string; data: HistoryItem[] }[] {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const d     = new Date(item.completed_at || item.visit_date);
    const key   = isNaN(d.getTime()) ? 'Unknown' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      title: key === 'Unknown' ? 'Unknown Date' : new Date(key+'-02').toLocaleDateString('en-GB', { month:'long', year:'numeric' }),
      data,
    }));
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

// ── Visit type badge ───────────────────────────────────────────────────────────
function TypeBadge({ type, visitType }: { type: VisitType; visitType?: string }) {
  const isRF  = type === 'fuel' || visitType?.includes('RF');
  const isCM  = visitType?.includes('CM') || visitType?.includes('END');
  const label = type === 'fuel' ? 'FUEL' : isCM ? 'CM' : 'PM';
  const bg    = type === 'fuel' ? '#FFF5F5' : isCM ? '#FEF3C7' : '#EFF6FF';
  const fg    = type === 'fuel' ? Colors.primary : isCM ? '#D97706' : '#2563EB';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: fg }}>{label}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { t } = useTranslation();

  const [maintenance, setMaintenance] = useState<HistoryItem[]>([]);
  const [fuels,       setFuels]       = useState<HistoryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isOffline,   setIsOffline]   = useState(false);
  const [search,      setSearch]      = useState('');
  const [tab,         setTab]         = useState<'all'|'maintenance'|'fuel'>('all');

  const load = useCallback(async () => {
    try {
      const [mRes, fRes] = await Promise.allSettled([
        cachedGet('/technician/maintenance/tasks?status=completed,approved&limit=500'),
        cachedGet('/technician/refuel/history?limit=500'),
      ]);

      if (mRes.status === 'fulfilled') {
        setIsOffline(mRes.value.fromCache);
        const records = mRes.value.data?.data || [];
        setMaintenance(records
          .filter((r: any) => ['completed','approved'].includes(r.status))
          .map((r: any) => ({
            _id:          r._id,
            type:         'maintenance' as VisitType,
            site_name:    r.site?.Site_Name || r.site_name || r.IHS_ID_SITE || '—',
            site_id:      r.site?.IHS_ID_SITE || r.site_id || '—',
            visit_date:   r.visit_date || r.Actual_Date_Visit,
            completed_at: r.completed_at || r.submitted_at || r.visit_date,
            visit_type:   r.visit_type || r.Type_of_Visit,
            check_type:   r.check_type,
            status:       r.status,
            cluster:      r.site?.GRATO_Cluster || r.cluster,
            region:       r.site?.Region || r.region,
          }))
        );
      }

      if (fRes.status === 'fulfilled') {
        const records = fRes.value.data?.data || [];
        setFuels(records.map((r: any) => ({
          _id:              r._id,
          type:             'fuel' as VisitType,
          site_name:        r.site_name || r.IHS_ID_SITE || '—',
          site_id:          r.IHS_ID_SITE || r.site_id || '—',
          visit_date:       r.visit_date || r.record_date,
          completed_at:     r.submitted_at || r.visit_date || r.record_date,
          liters_added:     r.fuel_data?.fuel_added || r.liters_actually_added,
          liters_approved:  r.liters_approved,
          balance_returned: r.liters_balance_returned,
          fuel_purchase_id: r.fuel_purchase?._id || r.fuel_purchase,
          status:           r.status || 'completed',
        })));
      }
    } catch (e) { console.error('[History] load error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Filtered + merged ─────────────────────────────────────────────────────
  const all: HistoryItem[] = [
    ...(tab !== 'fuel'        ? maintenance : []),
    ...(tab !== 'maintenance' ? fuels       : []),
  ].sort((a, b) =>
    new Date(b.completed_at || b.visit_date).getTime() -
    new Date(a.completed_at || a.visit_date).getTime()
  );

  const filtered = search.trim()
    ? all.filter(i =>
        i.site_name.toLowerCase().includes(search.toLowerCase()) ||
        i.site_id.toLowerCase().includes(search.toLowerCase())
      )
    : all;

  const grouped = groupByMonth(filtered);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalL        = fuels.reduce((s, f) => s + (f.liters_added || 0), 0);
  const totalReturned = fuels.reduce((s, f) => s + (f.balance_returned || 0), 0);
  const thisMonth     = new Date();
  const monthStart    = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const thisMonthCount = all.filter(i =>
    new Date(i.completed_at || i.visit_date) >= monthStart
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('submission_history', 'Submission History')}</Text>
          <Text style={styles.headerSub}>{all.length} {t('total_submissions', 'total submissions')}</Text>
        </View>
        {isOffline && (
          <View style={styles.offlinePill}>
            <Text style={styles.offlinePillText}>Offline</Text>
          </View>
        )}
      </View>

      {/* Summary strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{all.length}</Text>
          <Text style={styles.statLabel}>{t('all_time', 'All time')}</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={styles.statNum}>{thisMonthCount}</Text>
          <Text style={styles.statLabel}>{t('this_month', 'This month')}</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={styles.statNum}>{fuels.length}</Text>
          <Text style={styles.statLabel}>{t('refuels', 'Refuels')}</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{Math.round(totalL)}L</Text>
          <Text style={styles.statLabel}>{t('fuel_added', 'Fuel added')}</Text>
        </View>
      </View>

      {/* Tab filter */}
      <View style={styles.tabs}>
        {(['all','maintenance','fuel'] as const).map(k => (
          <TouchableOpacity key={k} style={[styles.tab, tab===k && styles.tabActive]} onPress={()=>setTab(k)}>
            <Text style={[styles.tabText, tab===k && styles.tabTextActive]}>
              {k === 'all' ? t('all','All') : k === 'maintenance' ? t('maintenance','Maintenance') : t('fuel','Fuel')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <FontAwesome5 name="search" size={14} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_sites', 'Search by site name or ID...')}
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <FontAwesome5 name="times" size={13} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {grouped.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome5 name="history" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('no_history', 'No submissions yet')}</Text>
          <Text style={styles.emptySub}>{t('no_history_desc', 'Completed visits and refuels will appear here')}</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={g => g.title}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item: group }) => (
            <View style={{ marginBottom: 8 }}>
              {/* Month header */}
              <View style={styles.monthHeader}>
                <FontAwesome5 name="calendar-alt" size={12} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.monthHeaderText}>{group.title}</Text>
                <View style={styles.monthBadge}>
                  <Text style={styles.monthBadgeText}>{group.data.length}</Text>
                </View>
              </View>

              {/* Cards */}
              {group.data.map(item => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (item.type === 'fuel' && item.fuel_purchase_id) {
                      router.push({ pathname: '/(technician)/refueling-flow/purchase-distribution', params: { purchaseId: item.fuel_purchase_id } });
                    }
                  }}
                >
                  <View style={styles.cardRow}>
                    {/* Icon */}
                    <View style={[styles.iconBox, { backgroundColor: item.type === 'fuel' ? '#FFF5F5' : '#EFF6FF' }]}>
                      <FontAwesome5
                        name={item.type === 'fuel' ? 'gas-pump' : 'tools'}
                        size={16}
                        color={item.type === 'fuel' ? Colors.primary : '#2563EB'}
                      />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <Text style={styles.siteName} numberOfLines={1}>{item.site_name}</Text>
                        <TypeBadge type={item.type} visitType={item.visit_type} />
                      </View>
                      <Text style={styles.siteId}>{item.site_id}</Text>
                      <Text style={styles.dateText}>{fmtDate(item.completed_at || item.visit_date)}</Text>

                      {/* Fuel-specific details */}
                      {item.type === 'fuel' && item.liters_added != null && (
                        <View style={styles.fuelDetails}>
                          <Text style={styles.fuelDetailText}>
                            {item.liters_added}L {t('added', 'added')}
                            {item.liters_approved ? ` / ${item.liters_approved}L ${t('approved', 'approved')}` : ''}
                          </Text>
                          {(item.balance_returned || 0) > 0 && (
                            <Text style={styles.balanceReturnedText}>
                              +{item.balance_returned}L {t('returned_to_budget', 'returned to budget')}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Chevron for fuel items with purchase */}
                    {item.type === 'fuel' && item.fuel_purchase_id && (
                      <FontAwesome5 name="chevron-right" size={12} color="#D1D5DB" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F3F4F6' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8, backgroundColor: Colors.surface },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  offlinePill:   { backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  offlinePillText:{ fontSize: 11, color: '#92400E', fontWeight: '600' },
  statsStrip:    { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 10 },
  statItem:      { flex: 1, alignItems: 'center' },
  statDivider:   { borderLeftWidth: 1, borderLeftColor: '#E5E7EB' },
  statNum:       { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel:     { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  tabs:          { flexDirection: 'row', backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tab:           { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  tabActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:       { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  searchBox:     { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', height: 42 },
  searchInput:   { flex: 1, fontSize: 14, color: '#111827' },
  monthHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  monthHeaderText: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },
  monthBadge:    { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  monthBadgeText:{ color: '#fff', fontSize: 10, fontWeight: '800' },
  card:          { backgroundColor: Colors.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBox:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  siteName:      { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  siteId:        { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  dateText:      { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  fuelDetails:   { marginTop: 4 },
  fuelDetailText:{ fontSize: 12, color: Colors.primary, fontWeight: '600' },
  balanceReturnedText: { fontSize: 11, color: '#16A34A', marginTop: 1 },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 20 },
  emptySub:      { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
