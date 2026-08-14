// app/(technician)/refueling-flow/purchase-distribution.tsx
//
// Shows a complete breakdown of how one bulk FuelPurchase was distributed
// across multiple sites. A refueler buys 1000L at the station, then visits
// Site A (300L), Site B (250L), Site C (450L). This screen shows exactly that.
//
// Accessible from: history.tsx tap on a fuel submission card.
// Also accessible from: new-fuel-purchase.tsx "View Distribution" button.
// EN/FR via useTranslation.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Share, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 }  from '@expo/vector-icons';
import { Colors }        from '../../../constants/Colors';
import { cachedGet }     from '../../../services/offlineApi';

interface Allocation {
  site_id:            string;
  site_name?:         string;
  fuel_consumption_id?: string;
  quantity:           number;
  allocated_at:       string;
  // Enriched from FuelRequest/SiteBudget
  liters_approved?:   number;
  balance_returned?:  number;
  fuel_request_id?:   string;
  urgency?:           string;
  cluster?:           string;
}

interface PurchaseDetail {
  _id:               string;
  purchase_date:     string;
  total_quantity:    number;
  remaining_quantity:number;
  price_per_liter?:  number;
  total_cost?:       number;
  truck_plate_number?:string;
  supplier?:         string;
  photo?:            string;
  status:            string;
  allocations:       Allocation[];
  tom_card_number?:  string;
  station_name?:     string;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtNum(n?: number, dp = 0) {
  if (n == null) return '—';
  return n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export default function PurchaseDistributionScreen() {
  const { t }                     = useTranslation();
  const { purchaseId }            = useLocalSearchParams<{ purchaseId: string }>();
  const [purchase,  setPurchase]  = useState<PurchaseDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState('');

  const load = useCallback(async () => {
    if (!purchaseId) { setError('No purchase ID provided'); setLoading(false); return; }
    try {
      const { data: res } = await cachedGet(`/technician/fuel-purchases/${purchaseId}`);
      const p: PurchaseDetail = res?.data || res;
      setPurchase(p);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Failed to load purchase details');
    } finally { setLoading(false); setRefreshing(false); }
  }, [purchaseId]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleShare = async () => {
    if (!purchase) return;
    const totalDistributed = purchase.allocations.reduce((s, a) => s + a.quantity, 0);
    const lines = [
      `FUEL PURCHASE DISTRIBUTION REPORT`,
      `Date: ${fmtDate(purchase.purchase_date)}`,
      `Total Purchased: ${purchase.total_quantity}L`,
      purchase.price_per_liter ? `Unit Price: XAF ${purchase.price_per_liter}/L` : null,
      purchase.tom_card_number ? `Tom Card: ${purchase.tom_card_number}` : null,
      purchase.station_name    ? `Station: ${purchase.station_name}` : null,
      purchase.truck_plate_number ? `Truck: ${purchase.truck_plate_number}` : null,
      ``,
      `DISTRIBUTION (${purchase.allocations.length} sites):`,
      ...purchase.allocations.map((a, i) =>
        `${i+1}. ${a.site_name || a.site_id} — ${a.quantity}L` +
        (a.balance_returned ? ` (${a.balance_returned}L returned)` : '') +
        ` — ${fmtDate(a.allocated_at)}`
      ),
      ``,
      `Total Distributed: ${totalDistributed}L`,
      `Remaining Balance: ${purchase.remaining_quantity}L`,
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message: lines, title: 'Purchase Distribution Report' });
    } catch {}
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('purchase_distribution', 'Purchase Distribution')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    </SafeAreaView>
  );

  if (error || !purchase) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('purchase_distribution', 'Purchase Distribution')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding: 32 }}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#D1D5DB" />
        <Text style={{ fontSize: 16, color: '#374151', marginTop: 16, fontWeight: '700' }}>
          {t('error_loading', 'Could not load purchase')}
        </Text>
        <Text style={{ fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 }}>{error}</Text>
        <TouchableOpacity style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 }} onPress={load}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{t('retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const totalDistributed = purchase.allocations.reduce((s, a) => s + a.quantity, 0);
  const balanceRemaining = purchase.remaining_quantity;
  const utilisationPct  = purchase.total_quantity > 0
    ? Math.round((totalDistributed / purchase.total_quantity) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('purchase_distribution', 'Purchase Distribution')}</Text>
          <Text style={styles.headerSub}>{fmtDate(purchase.purchase_date)}</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={handleShare}>
          <FontAwesome5 name="share-alt" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Purchase summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryBig}>{fmtNum(purchase.total_quantity)}L</Text>
              <Text style={styles.summaryLabel}>{t('purchased', 'Purchased')}</Text>
            </View>
            <View style={[styles.summaryItem, styles.summaryDivider]}>
              <Text style={[styles.summaryBig, { color: Colors.primary }]}>{fmtNum(totalDistributed)}L</Text>
              <Text style={styles.summaryLabel}>{t('distributed', 'Distributed')}</Text>
            </View>
            <View style={[styles.summaryItem, styles.summaryDivider]}>
              <Text style={[styles.summaryBig, { color: balanceRemaining > 0 ? '#16A34A' : '#6B7280' }]}>
                {fmtNum(balanceRemaining)}L
              </Text>
              <Text style={styles.summaryLabel}>{t('remaining', 'Remaining')}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{t('distribution_progress', 'Distribution progress')}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>{utilisationPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(utilisationPct,100)}%` as any }]} />
            </View>
          </View>

          {/* Purchase metadata */}
          <View style={styles.metaGrid}>
            {purchase.price_per_liter != null && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="tag" size={11} color={Colors.textSecondary} />
                <Text style={styles.metaText}>XAF {fmtNum(purchase.price_per_liter)}/L</Text>
              </View>
            )}
            {purchase.price_per_liter != null && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="money-bill" size={11} color={Colors.textSecondary} />
                <Text style={styles.metaText}>XAF {fmtNum(purchase.total_quantity * purchase.price_per_liter)} total</Text>
              </View>
            )}
            {purchase.tom_card_number && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="credit-card" size={11} color={Colors.textSecondary} />
                <Text style={styles.metaText}>Card: {purchase.tom_card_number}</Text>
              </View>
            )}
            {purchase.station_name && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="gas-pump" size={11} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{purchase.station_name}</Text>
              </View>
            )}
            {purchase.truck_plate_number && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="truck" size={11} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{purchase.truck_plate_number}</Text>
              </View>
            )}
            <View style={[styles.metaItem, { backgroundColor: purchase.status === 'depleted' ? '#DCFCE7' : '#FEF9C3' }]}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: purchase.status === 'depleted' ? '#16A34A' : '#D97706' }}>
                {purchase.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Allocation list */}
        <Text style={styles.sectionTitle}>
          {t('site_allocations', 'Site Allocations')} · {purchase.allocations.length} {t('sites', 'sites')}
        </Text>

        {purchase.allocations.length === 0 ? (
          <View style={styles.emptyAllocations}>
            <FontAwesome5 name="map-marker-alt" size={32} color="#D1D5DB" />
            <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: 13 }}>
              {t('no_allocations_yet', 'No sites have drawn from this purchase yet')}
            </Text>
          </View>
        ) : (
          purchase.allocations.map((alloc, idx) => {
            const pct = purchase.total_quantity > 0
              ? Math.round((alloc.quantity / purchase.total_quantity) * 100) : 0;
            return (
              <View key={idx} style={styles.allocCard}>
                {/* Site info + quantity */}
                <View style={styles.allocHeader}>
                  <View style={styles.allocIndex}>
                    <Text style={styles.allocIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allocSite}>{alloc.site_name || alloc.site_id}</Text>
                    <Text style={styles.allocSiteId}>{alloc.site_id}</Text>
                    {alloc.cluster && <Text style={styles.allocCluster}>{alloc.cluster}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.allocQty}>{fmtNum(alloc.quantity)}L</Text>
                    <Text style={styles.allocPct}>{pct}% of purchase</Text>
                  </View>
                </View>

                {/* Mini progress bar */}
                <View style={[styles.progressTrack, { marginTop: 8, height: 4 }]}>
                  <View style={[styles.progressFill, { width: `${pct}%` as any, height: 4 }]} />
                </View>

                {/* Fuel request details */}
                <View style={styles.allocMeta}>
                  <Text style={styles.allocDate}>{fmtDate(alloc.allocated_at)}</Text>
                  {alloc.liters_approved != null && (
                    <Text style={styles.allocMetaText}>
                      {t('approved', 'Approved')}: {fmtNum(alloc.liters_approved)}L
                    </Text>
                  )}
                  {(alloc.balance_returned || 0) > 0 && (
                    <View style={styles.returnedBadge}>
                      <FontAwesome5 name="undo" size={9} color="#16A34A" />
                      <Text style={styles.returnedText}>
                        {fmtNum(alloc.balance_returned)}L {t('returned_to_budget', 'returned to budget')}
                      </Text>
                    </View>
                  )}
                  {alloc.urgency && (
                    <View style={[styles.urgencyBadge, {
                      backgroundColor: alloc.urgency==='critical'?'#FEE2E2': alloc.urgency==='high'?'#FEF3C7':'#EFF6FF'
                    }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: alloc.urgency==='critical'?'#DC2626': alloc.urgency==='high'?'#D97706':'#2563EB' }}>
                        {alloc.urgency.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Balance summary if remaining > 0 */}
        {balanceRemaining > 0 && (
          <View style={styles.remainingCard}>
            <FontAwesome5 name="info-circle" size={16} color="#2563EB" />
            <Text style={styles.remainingText}>
              <Text style={{ fontWeight: '700' }}>{fmtNum(balanceRemaining)}L</Text> {t('still_remaining', 'still remaining in this purchase batch')}.
              {t('remaining_usable', ' This balance can be selected for the next site refueling.')}
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F3F4F6' },
  header:       { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:    { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  backBtn:      { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  body:         { padding: 16 },
  summaryCard:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryRow:   { flexDirection: 'row' },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryDivider:{ borderLeftWidth: 1, borderLeftColor: '#E5E7EB' },
  summaryBig:   { fontSize: 24, fontWeight: '900', color: '#111827' },
  summaryLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  progressTrack:{ height: 7, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, backgroundColor: Colors.primary, borderRadius: 4 },
  metaGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F9FAFB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  metaText:     { fontSize: 11, color: '#374151' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  allocCard:    { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  allocHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  allocIndex:   { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  allocIndexText:{ color: '#fff', fontSize: 12, fontWeight: '800' },
  allocSite:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  allocSiteId:  { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  allocCluster: { fontSize: 10, color: Colors.textSecondary },
  allocQty:     { fontSize: 18, fontWeight: '800', color: Colors.primary },
  allocPct:     { fontSize: 10, color: Colors.textSecondary },
  allocMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  allocDate:    { fontSize: 11, color: Colors.textSecondary },
  allocMetaText:{ fontSize: 11, color: '#374151' },
  returnedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  returnedText: { fontSize: 10, color: '#16A34A', fontWeight: '600' },
  urgencyBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  emptyAllocations:{ alignItems: 'center', paddingVertical: 32 },
  remainingCard:{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#BFDBFE', marginTop: 4 },
  remainingText:{ flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 },
});
