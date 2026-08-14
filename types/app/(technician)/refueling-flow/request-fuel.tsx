// app/(technician)/refueling-flow/request-fuel.tsx
// Site search-and-select exactly as in user's preferred component.
// Biometric confirmation added before submit.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { cachedGet, generateClientId, submitOrQueue } from '../../../services/offlineApi';
import { useAuth } from '../../../context/AuthContext';

interface Site {
  _id: string;
  name: string;
  site_id: string;
  IHS_ID_SITE?: string;
  Fuel_Quantity_Found?: number;
  Tank_Capacity?: number;
  GRATO_Cluster?: string;
  Region?: string;
}

const URGENCY_OPTIONS = [
  { value: 'low',      labelKey: 'urgency_low',      label: 'Low',      color: '#22C55E' },
  { value: 'medium',   labelKey: 'urgency_medium',   label: 'Medium',   color: '#3B82F6' },
  { value: 'high',     labelKey: 'urgency_high',     label: 'High',     color: '#F59E0B' },
  { value: 'critical', labelKey: 'urgency_critical', label: 'Critical', color: '#DC2626' },
];

const CHAIN = [
  { level: 1, name: 'Minka Kevin',    role: 'Diesel Coordinator' },
  { level: 2, name: 'Pascal Assam',   role: 'Operations Manager' },
  { level: 3, name: 'Didier Oyong',   role: 'Technical Director' },
  { level: 4, name: 'Ranibell Mambo', role: 'Finance Officer' },
  { level: 5, name: 'Kelvin E.T',     role: 'Head of Business' },
  { level: 6, name: 'Tom (CEO)',       role: 'CEO (>=100L only)' },
];

export default function RequestFuelScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [sites,        setSites]        = useState<Site[]>([]);
  const [siteSearch,   setSiteSearch]   = useState('');
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showSiteList, setShowSiteList] = useState(false);
  const [liters,       setLiters]       = useState('');
  const [urgency,      setUrgency]      = useState('medium');
  const [reason,       setReason]       = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);

  const needsCEO = parseFloat(liters || '0') >= 100;

  const loadSites = useCallback(async () => {
    setSitesLoading(true);
    try {
      const { data: res } = await cachedGet('/fuel-requests/sites');
      setSites(res?.data || res || []);
    } catch (e) {
      console.error('[RequestFuel] loadSites:', e);
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);

  const filteredSites = sites.filter(s => {
    const q = siteSearch.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.site_id?.toLowerCase().includes(q) ||
      s.IHS_ID_SITE?.toLowerCase().includes(q)
    );
  }).slice(0, 20);

  const handleSubmit = async () => {
    if (!selectedSite) {
      Alert.alert(t('error', 'Error'), t('select_site_required', 'Please select a site'));
      return;
    }
    if (!liters || parseFloat(liters) <= 0) {
      Alert.alert(t('error', 'Error'), t('liters_required', 'Enter litres needed'));
      return;
    }
    if (!reason.trim()) {
      Alert.alert(t('error', 'Error'), t('reason_required', 'Please describe the reason'));
      return;
    }

    // Biometric confirmation
    try {
      const LocalAuth = require('expo-local-authentication');
      const hasHw = await LocalAuth.hasHardwareAsync();
      const isEnr = await LocalAuth.isEnrolledAsync();
      if (hasHw && isEnr) {
        const bio = await LocalAuth.authenticateAsync({
          promptMessage: t('confirm_submit', 'Confirm submission'),
          fallbackLabel: t('use_pin', 'Use PIN'),
        });
        if (!bio.success) {
          Alert.alert(t('cancelled', 'Cancelled'), t('auth_required', 'Authentication required.'));
          return;
        }
      }
    } catch { /* proceed without biometrics */ }

    Alert.alert(
      t('confirm_request', 'Confirm Fuel Request'),
      selectedSite.name + '\n' + liters + ' L · ' + urgency.toUpperCase() + '\n\n' + reason,
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('submit', 'Submit'),
          onPress: async () => {
            setSubmitting(true);
            try {
              const payload = {
                client_id:          generateClientId(),
                site_id:            selectedSite.site_id || selectedSite.IHS_ID_SITE || selectedSite._id,
                site_name:          selectedSite.name,
                liters_requested:   parseFloat(liters),
                urgency,
                request_reason:     reason.trim(),
                current_fuel_level: selectedSite.Fuel_Quantity_Found,
                tank_capacity:      selectedSite.Tank_Capacity,
                cluster:            selectedSite.GRATO_Cluster,
                region:             selectedSite.Region,
                requested_by_name:  user?.fullName,
              };
              const result = await submitOrQueue('fuel_request', '/fuel-requests', 'POST', payload);
              if (result.queued) {
                Alert.alert(
                  t('queued_offline', 'Saved Offline'),
                  t('request_queued', 'Your fuel request has been saved and will be submitted when you reconnect.'),
                  [{ text: 'OK', onPress: () => router.back() }],
                );
              } else {
                Alert.alert(
                  t('request_submitted', 'Request Submitted'),
                  t('request_submitted_desc', 'Your fuel request is now in the approval chain.'),
                  [{ text: 'OK', onPress: () => router.back() }],
                );
              }
            } catch (err: any) {
              Alert.alert(
                t('error', 'Error'),
                err?.response?.data?.error || t('submit_failed', 'Failed to submit. Please try again.'),
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('request_fuel', 'Request Fuel')}</Text>
            <Text style={styles.headerSub}>{t('raise_fuel_request', 'Raise a refueling request')}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Site Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('site', 'Site')} <Text style={styles.required}>*</Text></Text>

            {selectedSite ? (
              <TouchableOpacity
                style={styles.selectedSite}
                onPress={() => { setSelectedSite(null); setSiteSearch(''); setShowSiteList(false); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedSiteName}>{selectedSite.name}</Text>
                  <Text style={styles.selectedSiteId}>{selectedSite.site_id || selectedSite.IHS_ID_SITE}</Text>
                  {selectedSite.Fuel_Quantity_Found != null && (
                    <Text style={styles.selectedSiteFuel}>
                      {t('current_fuel', 'Current fuel')}: {selectedSite.Fuel_Quantity_Found} L
                      {selectedSite.Tank_Capacity ? ' / ' + selectedSite.Tank_Capacity + ' L' : ''}
                    </Text>
                  )}
                </View>
                <FontAwesome5 name="times-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <View>
                <View style={styles.searchBox}>
                  <FontAwesome5 name="search" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('search_site', 'Search by site name or ID...')}
                    placeholderTextColor="#9CA3AF"
                    value={siteSearch}
                    onChangeText={v => { setSiteSearch(v); setShowSiteList(true); }}
                    onFocus={() => setShowSiteList(true)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {sitesLoading && <ActivityIndicator size="small" color={Colors.primary} />}
                </View>

                {showSiteList && siteSearch.length > 0 && (
                  <View style={styles.dropdown}>
                    {filteredSites.length === 0 ? (
                      <Text style={styles.dropdownEmpty}>{t('no_sites_found', 'No sites found')}</Text>
                    ) : (
                      filteredSites.map(s => (
                        <TouchableOpacity
                          key={s._id}
                          style={styles.dropdownItem}
                          onPress={() => { setSelectedSite(s); setSiteSearch(''); setShowSiteList(false); }}
                        >
                          <Text style={styles.dropdownName}>{s.name}</Text>
                          <Text style={styles.dropdownId}>{s.site_id || s.IHS_ID_SITE}</Text>
                          {s.Fuel_Quantity_Found != null && (
                            <Text style={styles.dropdownFuel}>
                              {s.Fuel_Quantity_Found} L / {s.Tank_Capacity || '---'} L
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Litres */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('litres_needed', 'Litres Needed')} <Text style={styles.required}>*</Text></Text>
            <View style={styles.litresBox}>
              <TextInput
                style={styles.litresInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={liters}
                onChangeText={setLiters}
              />
              <Text style={styles.litresUnit}>L</Text>
            </View>
            {liters && parseFloat(liters) > 0 && (
              <Text style={styles.xafPreview}>
                {'~XAF ' + Math.round(parseFloat(liters) * 828).toLocaleString() + ' (estimate)'}
              </Text>
            )}
            {needsCEO && (
              <View style={styles.ceoBadge}>
                <FontAwesome5 name="crown" size={12} color={Colors.primary} />
                <Text style={styles.ceoText}>{t('ceo_required', 'CEO approval required (>=100 L)')}</Text>
              </View>
            )}
          </View>

          {/* Urgency */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('urgency', 'Urgency')} <Text style={styles.required}>*</Text></Text>
            <View style={styles.urgencyRow}>
              {URGENCY_OPTIONS.map(u => (
                <TouchableOpacity
                  key={u.value}
                  style={[styles.urgencyBtn, urgency === u.value && { backgroundColor: u.color, borderColor: u.color }]}
                  onPress={() => setUrgency(u.value)}
                >
                  <Text style={[styles.urgencyText, urgency === u.value && { color: '#fff' }]}>
                    {t(u.labelKey, u.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reason */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('reason', 'Reason')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.reasonInput}
              multiline
              numberOfLines={4}
              placeholder={t('reason_placeholder', 'Describe why fuel is needed, current situation, and any urgency factors...')}
              placeholderTextColor="#9CA3AF"
              value={reason}
              onChangeText={setReason}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{reason.length + ' ' + t('chars', 'chars')}</Text>
          </View>

          {/* Approval Chain Preview */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('approval_chain', 'Approval Chain')}</Text>
            <View style={styles.chainBox}>
              {CHAIN.filter(s => s.level < 6 || needsCEO).map((s, i, arr) => (
                <View key={s.level} style={styles.chainStep}>
                  <View style={styles.chainDot}>
                    <Text style={styles.chainDotText}>{s.level}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chainName}>{s.name}</Text>
                    <Text style={styles.chainRole}>{s.role}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.chainLine} />}
                </View>
              ))}
              {!needsCEO && (
                <Text style={styles.chainNote}>
                  {t('ceo_not_required', '* CEO approval only triggered for >=100 L requests')}
                </Text>
              )}
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!selectedSite || !liters || !reason.trim() || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedSite || !liters || !reason.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitText}>{t('submit_request', 'Submit Request')}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F3F4F6' },
  header:       { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  backBtn:      { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  body:         { padding: 16 },
  section:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  label:        { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  required:     { color: Colors.primary },
  searchBox:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, height: 44, backgroundColor: '#F9FAFB' },
  searchInput:  { flex: 1, fontSize: 14, color: '#111827' },
  dropdown:     { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: 4, backgroundColor: '#fff', maxHeight: 280 },
  dropdownEmpty:{ padding: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 13 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  dropdownId:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  dropdownFuel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  selectedSite:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, borderRadius: 8, padding: 12, backgroundColor: '#FFF5F5' },
  selectedSiteName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  selectedSiteId:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  selectedSiteFuel: { fontSize: 12, color: Colors.primary, marginTop: 3, fontWeight: '600' },
  litresBox:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  litresInput:  { flex: 1, fontSize: 28, fontWeight: '800', color: '#111827', padding: 12, textAlign: 'center' },
  litresUnit:   { paddingHorizontal: 16, fontSize: 18, fontWeight: '700', color: '#9CA3AF', backgroundColor: '#F9FAFB', paddingVertical: 12 },
  xafPreview:   { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  ceoBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF5F5', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginTop: 8, borderWidth: 1, borderColor: '#FFCDD2' },
  ceoText:      { fontSize: 12, color: Colors.primary, fontWeight: '600', flex: 1 },
  urgencyRow:   { flexDirection: 'row', gap: 8 },
  urgencyBtn:   { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
  urgencyText:  { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  reasonInput:  { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', minHeight: 110, backgroundColor: '#F9FAFB' },
  charCount:    { fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  chainBox:     { backgroundColor: '#FFF5F5', borderRadius: 8, padding: 12 },
  chainStep:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, position: 'relative' },
  chainDot:     { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2, flexShrink: 0 },
  chainDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  chainName:    { fontSize: 13, fontWeight: '700', color: '#111827' },
  chainRole:    { fontSize: 11, color: '#6B7280', marginTop: 1 },
  chainLine:    { position: 'absolute', left: 11, top: 26, width: 2, height: 12, backgroundColor: '#FFCDD2' },
  chainNote:    { fontSize: 10, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  submitBtn:         { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.45 },
  submitText:        { color: '#fff', fontSize: 16, fontWeight: '800' },
});