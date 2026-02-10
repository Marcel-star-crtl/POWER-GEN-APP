import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { operationsAPI, uploadAPI } from '../../services/api';
import { PhotoAttachment } from '../../components/ui/PhotoCapture';

interface DraftMeta {
  key: string;
  siteId: string;
  siteName: string;
  updatedAt: string;
  payload: any;
  photos: PhotoAttachment[];
  sectionPhotos?: Record<string, PhotoAttachment[]>;
}

export default function OperationsDrafts() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const sectionLabels: Record<string, string> = {
    site_details: 'Site Details',
    janitorial: 'Site Janitorial / Hygiene',
    fumigation: 'Fumigation',
    generator: 'Generator',
    ats_system: 'ATS System',
    grid: 'Grid (ENEO)',
    avr: 'AVR (Automatic Voltage Regulator)',
    fuel_tank: 'Fuel Tank',
    air_conditioning: 'Air Conditioning',
    canopy: 'Canopy Status',
    cable_tray: 'Cable & Cable Tray',
    fence: 'Fence',
    power_rectifiers: 'Power System - Rectifiers',
    power_batteries: 'Power System - Batteries',
    cooling_system_cabinet: 'Cooling System for Power Cabinet',
    solar_batteries: 'Solar System - Batteries',
    solar_panels: 'Solar Panels',
    earthing_system: 'Earthing System',
    alarms_system: 'Alarms System',
    signatures: 'Signatures',
    general: 'General Photos',
  };

  const loadDrafts = useCallback(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter((k) => k.startsWith('operations_audit_draft_'));
    const items: DraftMeta[] = [];

    for (const key of draftKeys) {
      const draftStr = await AsyncStorage.getItem(key);
      if (!draftStr) continue;
      const draft = JSON.parse(draftStr);
      items.push({
        key,
        siteId: draft.siteId,
        siteName: draft.siteName || 'Unknown site',
        updatedAt: draft.updatedAt,
        payload: draft.payload,
        photos: draft.photos || [],
        sectionPhotos: draft.sectionPhotos || {},
      });
    }

    setDrafts(items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  }, [loadDrafts]);

  const deleteDraft = async (key: string) => {
    await AsyncStorage.removeItem(key);
    await loadDrafts();
  };

  const submitDraft = async (draft: DraftMeta) => {
    try {
      const sectionedPhotos = [
        ...(draft.photos || []).map((photo) => ({ ...photo, __section: 'general' })),
        ...Object.entries(draft.sectionPhotos || {}).flatMap(([section, items]) =>
          (items || []).map((photo) => ({ ...photo, __section: section }))
        ),
      ];

      const processedPhotos = await uploadAPI.processAndUploadData(sectionedPhotos);
      const payload = {
        ...draft.payload,
        photos: (processedPhotos || []).map((p: any) => ({
          url: p.uri || p.url || p,
          category: 'general',
          description: sectionLabels[p.__section] || p.__section || ''
        })),
        status: 'submitted'
      };

      await operationsAPI.createAudit(payload);
      await AsyncStorage.removeItem(draft.key);
      await loadDrafts();
      Alert.alert('Submitted', 'Draft submitted successfully');
    } catch (error) {
      console.error('Draft submission error:', error);
      Alert.alert('Submission failed', 'Please try again when online');
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={drafts}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No drafts saved yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.siteName}</Text>
            <Text style={styles.cardMeta}>Last updated: {new Date(item.updatedAt).toLocaleString()}</Text>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push(`/(operations)/audit-form/${item.siteId}`)}
              >
                <Text style={styles.secondaryButtonText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => submitDraft(item)}
              >
                <Text style={styles.secondaryButtonText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={() => deleteDraft(item.key)}
              >
                <Text style={styles.dangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.text,
    fontWeight: '600',
  },
  dangerButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: Colors.danger,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: Colors.textSecondary,
  },
});
