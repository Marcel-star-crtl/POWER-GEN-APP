import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import { operationsAPI } from '../../services/api';

interface AuditItem {
  _id: string;
  site_name?: string;
  site_code?: string;
  region?: string;
  createdAt?: string;
  total_score?: number;
  status?: string;
}

export default function SubmittedAudits() {
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAudits = useCallback(async () => {
    try {
      const response = await operationsAPI.listAudits({ status: 'submitted', limit: 50 });
      const data = response.data?.data || [];
      setAudits(data);
    } catch (error) {
      console.error('Failed to load submitted audits:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAudits();
    setRefreshing(false);
  }, [loadAudits]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Submitted Audits</Text>
      <Text style={styles.subtitle}>Latest submitted site audits</Text>

      {loading ? (
        <Text style={styles.emptyText}>Loading audits...</Text>
      ) : audits.length === 0 ? (
        <Text style={styles.emptyText}>No submitted audits yet.</Text>
      ) : (
        <View style={styles.list}>
          {audits.map((audit) => (
            <View key={audit._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{audit.site_name || 'Site'}</Text>
                <Text style={styles.cardStatus}>{audit.status || 'submitted'}</Text>
              </View>
              <Text style={styles.cardMeta}>{audit.site_code || 'Site ID'} · {audit.region || 'Region'}</Text>
              <Text style={styles.cardMeta}>
                {audit.createdAt ? new Date(audit.createdAt).toLocaleString() : 'Date unknown'}
              </Text>
              {typeof audit.total_score === 'number' && (
                <Text style={styles.score}>Total Score: {audit.total_score.toFixed(2)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
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
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  score: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyText: {
    marginTop: 24,
    color: Colors.textSecondary,
  },
});
