// app/(technician)/debug-sync-queue.tsx
//
// Dev-only. Shows the real, live contents of this device's local
// SQLite sync_queue table — every offline-queued item, its status,
// retry count, last error (if any), and a preview of what it's
// actually carrying. Built specifically to answer "is the data really
// in the SQLite database" directly, rather than inferring it from
// server-side state or trusting that a sync attempt worked.
//
// Gated behind __DEV__ so this never reaches a production build —
// queue payloads can contain site-level operational data that has no
// reason to be browsable by a technician in the field. Reachable only
// by direct navigation (see profile.tsx's dev-only entry) while
// connected to this phone via a local Expo dev server.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { getAllItems, QueueItem } from '../../lib/syncQueue';
import { processQueue } from '../../services/syncManager';
import { Colors } from '../../constants/Colors';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  uploading: '#3b82f6',
  syncing: '#3b82f6',
  synced: '#16a34a',
  failed: '#dc2626',
};

/** Pulls a human-readable label out of a queue item's payload without
 * assuming every item type has the same shape — tank audits, refueling,
 * and parts requests each carry different fields. */
function describePayload(item: QueueItem): string {
  const p = item.payload || {};
  const site = p.site_name || p.siteName || p.site_id_ihs || p.siteId || p.site_id;
  const parts = [site].filter(Boolean);
  return parts.length ? parts.join(' — ') : '(no site info in payload)';
}

export default function DebugSyncQueue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllItems();
      setItems(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!__DEV__) {
    // Real safeguard, not just a UI nicety — if this screen is ever
    // reached in a production build (e.g. a stale deep link), it
    // refuses to show anything rather than silently expose queue
    // payload contents.
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>This screen is only available in development builds.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const counts = (items || []).reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});
  const tankAuditItems = (items || []).filter(i => i.type.startsWith('tank_audit'));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sync Queue (local SQLite)</Text>
      </View>

      <View style={styles.summaryRow}>
        {['pending', 'failed', 'synced'].map(s => (
          <View key={s} style={styles.summaryCard}>
            <Text style={[styles.summaryCount, { color: STATUS_COLORS[s] }]}>{counts[s] || 0}</Text>
            <Text style={styles.summaryLabel}>{s}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
        disabled={syncing}
        onPress={async () => {
          setSyncing(true);
          try {
            await processQueue();
            await load();
          } finally {
            setSyncing(false);
          }
        }}
      >
        {syncing
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.syncBtnText}>Run processQueue() now</Text>}
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Text style={styles.sectionLabel}>
          Tank audit items ({tankAuditItems.length} of {items?.length ?? 0} total in queue)
        </Text>
        {loading && !items ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : tankAuditItems.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              No tank_audit_draft or tank_audit_submit items in this device's local queue right now.
              {'\n\n'}
              This means either: everything has already synced (check the total counts above — if
              "synced" items were recently cleared, see the note below), or nothing was ever queued
              on this specific device to begin with.
            </Text>
          </View>
        ) : (
          tankAuditItems.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemType}>{item.type}</Text>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[item.status] || '#999' }]}>
                  <Text style={styles.statusPillText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.itemDesc}>{describePayload(item)}</Text>
              <Text style={styles.itemMeta}>
                attempts: {item.attempts}  ·  created {new Date(item.created_at).toLocaleString()}
              </Text>
              <Text style={styles.itemMeta}>
                updated {new Date(item.updated_at).toLocaleString()}
              </Text>
              {item.last_error ? (
                <Text style={styles.itemError} numberOfLines={3}>error: {item.last_error}</Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.footnote}>
          Note: successfully synced items are deleted from this table shortly after syncing (see
          services/syncManager.ts) — a "synced" status is a brief transitional state, not a
          permanent record. If a draft you expect isn't listed here and isn't in the counts above
          either, it most likely already synced and was cleaned up — cross-check with
          scripts/lookupTechnicianTankAudits.js on the server side to confirm it actually landed.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { padding: 24, alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  summaryCard: {
    flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2, textTransform: 'uppercase' },
  syncBtn: {
    marginHorizontal: 16, marginTop: 14, backgroundColor: Colors.primary,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 10, textTransform: 'uppercase' },
  emptyText: { fontSize: 13, color: '#888', lineHeight: 19, textAlign: 'center' },
  itemCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 10 },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemType: { fontSize: 13, fontWeight: '700', color: Colors.text },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  itemDesc: { fontSize: 13, color: Colors.text, marginTop: 6 },
  itemMeta: { fontSize: 11, color: '#999', marginTop: 3 },
  itemError: { fontSize: 11, color: '#dc2626', marginTop: 6 },
  footnote: { fontSize: 11, color: '#aaa', lineHeight: 16, marginTop: 16, paddingHorizontal: 4 },
});
