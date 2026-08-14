// app/(technician)/refueling-flow/scheduled-for-me.tsx
//
// Shows the authenticated technician/fuel user their approved FuelRequest
// assignments. When they tap "Start Refueling" it launches activate-site
// with the site pre-filled, feeding into the existing refueling workflow.
// Supports EN and FR via react-i18next.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { router }            from 'expo-router';
import { useTranslation }    from 'react-i18next';
import { FontAwesome5 }      from '@expo/vector-icons';
import { Colors }            from '../../../constants/Colors';
import { cachedGet }         from '../../../services/offlineApi';

interface ScheduledRequest {
  _id: string;
  site_id: string;
  site_name: string;
  cluster?: string;
  region?: string;
  cycle_key: string;
  liters_approved?: number;
  liters_requested: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  request_reason: string;
  current_fuel_level?: number;
  fuel_percentage_at_request?: number;
  tank_capacity?: number;
  budget_snapshot?: { budget_liters_remaining: number; budget_liters_total: number };
  createdAt: string;
}

const URGENCY: Record<string, { bg: string; fg: string }> = {
  critical: { bg: '#FEE2E2', fg: '#DC2626' },
  high:     { bg: '#FEF3C7', fg: '#D97706' },
  medium:   { bg: '#DBEAFE', fg: '#2563EB' },
  low:      { bg: '#DCFCE7', fg: '#16A34A' },
};

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  approved:      { label: 'Approved',    bg: '#EDE9FE', fg: '#7C3AED' },
  scheduled:     { label: 'Scheduled',   bg: '#DBEAFE', fg: '#2563EB' },
  purchase_made: { label: 'Fuel Bought', bg: '#DCFCE7', fg: '#059669' },
};

function fmtDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ScheduledForMeScreen() {
  const { t } = useTranslation();
  const [requests,   setRequests]   = useState<ScheduledRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline,  setIsOffline]  = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: res, fromCache } = await cachedGet('/fuel-requests/scheduled-for-me');
      setIsOffline(fromCache);
      const list: ScheduledRequest[] = res?.data || [];
      // Sort: critical first, then by creation date
      list.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        const diff = (order[a.urgency] ?? 2) - (order[b.urgency] ?? 2);
        if (diff !== 0) return diff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setRequests(list);
    } catch (e) {
      console.error('[ScheduledForMe] load:', e);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleStart = (req: ScheduledRequest) => {
    router.push({
      pathname: '/(technician)/refueling-flow/activate-site',
      params: {
        siteId:         req.site_id,
        siteCode:       req.site_id,
        siteName:       req.site_name,
        tankId:         req.site_id,
        capacity:       String(req.tank_capacity ?? 5000),
        currentLevel:   String(req.current_fuel_level ?? 0),
        fuelRequestId:  req._id,
        approvedLiters: String(req.liters_approved ?? req.liters_requested),
      },
    });
  };

  if (!loading && requests.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('my_assignments', 'My Assignments')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.empty}>
          <FontAwesome5 name="calendar-check" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('no_assignments', 'No assignments yet')}</Text>
          <Text style={styles.emptyDesc}>{t('no_assignments_desc', 'When a fuel request is approved and assigned to you, it will appear here.')}</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={load}>
            <FontAwesome5 name="sync-alt" size={14} color={Colors.primary} />
            <Text style={styles.refreshBtnText}>{t('refresh', 'Refresh')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('my_assignments', 'My Assignments')}</Text>
          <Text style={styles.headerSub}>{requests.length} {t('sites_assigned', 'sites assigned')}</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.backBtn}>
          <FontAwesome5 name="sync-alt" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <FontAwesome5 name="wifi" size={11} color="#92400E" />
          <Text style={styles.offlineText}>{t('offline_cached', 'Offline — showing last saved assignments')}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {requests.map(req => {
          const approved = req.liters_approved ?? req.liters_requested;
          // Use the server-computed value (respects each site's real
          // SiteBudget.xaf_per_liter rate) instead of recomputing with a
          // hardcoded 828 — the backend already returns the accurate figure
          // as xaf_approved/xaf_requested, and this is a request that's
          // already been through approval, so a locally-guessed number here
          // could visibly disagree with what Finance actually calculated.
          const xaf      = req.xaf_approved ?? req.xaf_requested ?? Math.round(approved * 828);
          const uc       = URGENCY[req.urgency] || URGENCY.medium;
          const sc       = STATUS_LABEL[req.status] || { label: req.status, bg: '#F3F4F6', fg: '#374151' };
          const isPurchased = req.status === 'purchase_made';

          return (
            <View key={req._id} style={[styles.card, req.urgency === 'critical' && styles.cardCritical]}>
              <View style={[styles.accentBar, { backgroundColor: uc.fg }]} />
              <View style={styles.cardBody}>

                {/* Site + badges */}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteName} numberOfLines={1}>{req.site_name}</Text>
                    <Text style={styles.siteId}>{req.site_id}{req.cluster ? ` · ${req.cluster}` : ''}</Text>
                  </View>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.badgeText, { color: sc.fg }]}>{sc.label}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: uc.bg }]}>
                      <Text style={[styles.badgeText, { color: uc.fg }]}>{req.urgency.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                {/* Approved quantity — BIG */}
                <View style={styles.quantityBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FontAwesome5 name="tint" size={22} color={Colors.primary} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.quantityL}>{approved} L</Text>
                      <Text style={styles.quantityXAF}>XAF {xaf.toLocaleString()}</Text>
                    </View>
                  </View>
                  {approved >= 100 && (
                    <View style={[styles.badge, { backgroundColor: '#FFF5F5' }]}>
                      <FontAwesome5 name="crown" size={11} color={Colors.primary} style={{ marginRight: 4 }} />
                      <Text style={[styles.badgeText, { color: Colors.primary }]}>{t('ceo_approved', 'CEO Approved')}</Text>
                    </View>
                  )}
                </View>

                {/* Budget remaining */}
                {req.budget_snapshot && (
                  <View style={[styles.infoRow, req.budget_snapshot.budget_liters_remaining < 50 && styles.infoRowWarn]}>
                    <FontAwesome5 name="wallet" size={12} color={req.budget_snapshot.budget_liters_remaining < 50 ? Colors.danger : '#6B7280'} />
                    <Text style={[styles.infoText, req.budget_snapshot.budget_liters_remaining < 50 && { color: Colors.danger }]}>
                      {t('budget_remaining', 'Budget')}: {req.budget_snapshot.budget_liters_remaining} L / {req.budget_snapshot.budget_liters_total} L
                      {req.budget_snapshot.budget_liters_remaining < 50 ? ' ⚠' : ''}
                    </Text>
                  </View>
                )}

                {/* Reason */}
                <Text style={styles.reason} numberOfLines={2}>"{req.request_reason}"</Text>

                {/* Purchase made banner */}
                {isPurchased && (
                  <View style={styles.purchasedBanner}>
                    <FontAwesome5 name="check-circle" size={13} color="#059669" />
                    <Text style={styles.purchasedText}>{t('fuel_purchased', 'Fuel purchased — proceed to site and complete the refueling form')}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => Alert.alert(
                      req.site_name,
                      [
                        `${t('site_id', 'Site ID')}: ${req.site_id}`,
                        `${t('cycle', 'Cycle')}: ${req.cycle_key}`,
                        `${t('approved', 'Approved')}: ${approved} L`,
                        `${t('urgency', 'Urgency')}: ${req.urgency.toUpperCase()}`,
                        `${t('reason', 'Reason')}: ${req.request_reason}`,
                      ].join('\n'),
                      [{ text: t('close', 'Close') }, { text: t('start_refueling', 'Start Refueling'), onPress: () => handleStart(req) }]
                    )}
                  >
                    <FontAwesome5 name="info-circle" size={14} color={Colors.primary} />
                    <Text style={styles.detailBtnText}>{t('details', 'Details')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(req)} activeOpacity={0.8}>
                    <FontAwesome5 name="play" size={14} color="#fff" />
                    <Text style={styles.startBtnText}>
                      {isPurchased ? t('continue_refueling', 'Continue Refueling') : t('start_refueling', 'Start Refueling')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header:      { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingVertical: 6, paddingHorizontal: 16 },
  offlineText:   { color: '#92400E', fontSize: 12, fontWeight: '500' },

  scroll: { padding: 16, paddingBottom: 32 },

  card:         { backgroundColor: '#fff', borderRadius: 12, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  cardCritical: { borderColor: '#FCA5A5' },
  accentBar:    { height: 4 },
  cardBody:     { padding: 16 },

  row:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  badges: { flexDirection: 'row', gap: 6, flexShrink: 0, flexWrap: 'wrap' },
  badge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800' },

  siteName: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  siteId:   { fontSize: 11, color: '#9CA3AF' },

  quantityBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 10, padding: 12, marginBottom: 10 },
  quantityL:   { fontSize: 26, fontWeight: '900', color: Colors.primary, lineHeight: 30 },
  quantityXAF: { fontSize: 11, color: '#FFCDD2' },

  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  infoRowWarn: { backgroundColor: '#FEF2F2' },
  infoText:    { fontSize: 11, color: '#6B7280', flex: 1 },

  reason: { fontSize: 12, color: '#374151', lineHeight: 18, fontStyle: 'italic', marginBottom: 10 },

  purchasedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10 },
  purchasedText:   { fontSize: 12, color: '#065F46', flex: 1 },

  actions:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  detailBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  detailBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  startBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 9 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 20, marginBottom: 8 },
  emptyDesc:    { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  refreshBtn:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, gap: 6 },
  refreshBtnText: { color: Colors.primary, fontWeight: '700' },
});
