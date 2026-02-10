import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
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
  auditId?: string;
  createdBy?: string;
}

export default function OperationsDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ submitted: 0, drafts: 0, total: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const getCurrentUserId = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return undefined;
      const user = JSON.parse(userStr);
      return user?.id || user?._id;
    } catch {
      return undefined;
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await operationsAPI.listAudits({ status: 'submitted', limit: 1 });
      const totalResponse = await operationsAPI.listAudits({ limit: 1 });

      const currentUserId = await getCurrentUserId();
      const draftKeys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('operations_audit_draft_'));
      let ownDraftsCount = 0;

      for (const key of draftKeys) {
        const draftStr = await AsyncStorage.getItem(key);
        if (!draftStr) continue;
        const draft = JSON.parse(draftStr) as DraftMeta;
        if (!draft.createdBy || !currentUserId || draft.createdBy === currentUserId) {
          ownDraftsCount += 1;
        }
      }

      setStats({
        submitted: response.data?.pagination?.total || 0,
        total: totalResponse.data?.pagination?.total || 0,
        drafts: ownDraftsCount,
      });
    } catch (error) {
      console.error('Operations dashboard stats error:', error);
    }
  }, [getCurrentUserId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const syncDrafts = async () => {
    try {
      const currentUserId = await getCurrentUserId();
      const draftKeys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('operations_audit_draft_'));
      if (draftKeys.length === 0) {
        Alert.alert('No drafts', 'There are no drafts to sync.');
        return;
      }

      for (const key of draftKeys) {
        const draftStr = await AsyncStorage.getItem(key);
        if (!draftStr) continue;
        const draft = JSON.parse(draftStr) as DraftMeta;
        if (draft.createdBy && currentUserId && draft.createdBy !== currentUserId) {
          continue;
        }

        const sectionedPhotos = [
          ...(draft.photos || []).map((photo) => ({ ...photo, __section: 'general' })),
          ...Object.entries(draft.sectionPhotos || {}).flatMap(([section, items]) =>
            (items || []).map((photo) => ({ ...photo, __section: section }))
          ),
        ];

        const processedPhotos = sectionedPhotos.length > 0
          ? await uploadAPI.processAndUploadData(sectionedPhotos)
          : [];

        const payload = {
          ...draft.payload,
          photos: (processedPhotos || []).map((p: any) => ({
            url: p.uri || p.url || p,
            category: 'general',
            description: p.__section || ''
          })),
          status: 'draft'
        };

        if (draft.auditId) {
          try {
            await operationsAPI.updateAudit(draft.auditId, payload);
          } catch (updateError) {
            console.warn('Draft update failed, creating a new draft instead:', updateError);
            const res = await operationsAPI.createAudit(payload);
            draft.auditId = res.data?.data?._id;
            await AsyncStorage.setItem(key, JSON.stringify({ ...draft, auditId: draft.auditId }));
          }
        } else {
          const res = await operationsAPI.createAudit(payload);
          draft.auditId = res.data?.data?._id;
          await AsyncStorage.setItem(key, JSON.stringify({ ...draft, auditId: draft.auditId }));
        }
      }

      Alert.alert('Synced', 'All drafts have been synced to the web as drafts.');
      await loadStats();
    } catch (error) {
      console.error('Draft sync error:', error);
      Alert.alert('Sync failed', 'Some drafts could not be synced.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Operations Dashboard</Text>
      <Text style={styles.subtitle}>Site Audit Checklist</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Audits</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.submitted}</Text>
          <Text style={styles.statLabel}>Submitted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.drafts}</Text>
          <Text style={styles.statLabel}>Drafts</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(operations)/select-site')}>
          <Text style={styles.primaryButtonText}>Start New Audit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(operations)/drafts')}>
          <Text style={styles.secondaryButtonText}>View Drafts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(operations)/submitted')}>
          <Text style={styles.secondaryButtonText}>View Submitted Audits</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={syncDrafts}>
          <Text style={styles.secondaryButtonText}>Sync Drafts</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
     backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
     backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
});
