// app/(technician)/pending-whatsapp-shares.tsx
//
// Every refueling report a technician chose "Share Later" on (or closed
// the popup without finishing) — see components/ui/WhatsAppSharePopup.tsx
// and lib/whatsappShareQueue.ts. Reachable from the dashboard's pending-
// shares banner (app/(technician)/dashboard.tsx) whenever the count is
// above zero. Purely local/device-side — this list is not synced to the
// server and has nothing to do with the offline sync_queue (that queue
// is about getting the *report data* onto the server; this one is about
// a *human* still needing to tap through a WhatsApp share).

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import {
  PendingWhatsAppShare,
  getPendingShares,
  removePendingShare,
} from "../../lib/whatsappShareQueue";
import { WhatsAppSharePopup } from "../../components/ui/WhatsAppSharePopup";

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function PendingWhatsAppSharesScreen() {
  const [items, setItems] = useState<PendingWhatsAppShare[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PendingWhatsAppShare | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getPendingShares());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDiscard = (item: PendingWhatsAppShare) => {
    Alert.alert(
      "Discard Report?",
      `This will permanently remove the unsent WhatsApp report for ${item.site_name}. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await removePendingShare(item.id);
            load();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Pending WhatsApp Shares</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {loading && !items ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
        ) : !items || items.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="logo-whatsapp" size={36} color="#c7c7c7" />
            <Text style={styles.emptyText}>
              Nothing waiting to be shared. Reports you tap "Share Later" on after submitting a
              refueling visit will show up here.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.siteName}>{item.site_name}</Text>
                <Text style={styles.meta}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={styles.siteId}>{item.site_id}</Text>
              {item.photos.length > 0 && (
                <Text style={styles.photoNote}>
                  {item.photos.length} photo{item.photos.length === 1 ? "" : "s"} attached
                </Text>
              )}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.discardBtn}
                  onPress={() => handleDiscard(item)}
                >
                  <Text style={styles.discardBtnText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => setActive(item)}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  <Text style={styles.shareBtnText}>Share Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {active && (
        <WhatsAppSharePopup
          visible
          siteName={active.site_name}
          message={active.message}
          photos={active.photos}
          onFinish={async ({ shared }) => {
            if (shared) {
              await removePendingShare(active.id);
            }
            setActive(null);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  backBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.text },
  list: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24, gap: 12 },
  emptyText: { fontSize: 13, color: "#888", lineHeight: 19, textAlign: "center" },
  card: {
    borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14, marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  siteName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  meta: { fontSize: 11, color: "#999" },
  siteId: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  photoNote: { fontSize: 11, color: "#6B7280", marginTop: 6 },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  discardBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingVertical: 10,
  },
  discardBtnText: { color: "#6B7280", fontWeight: "600", fontSize: 13 },
  shareBtn: {
    flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#25D366", borderRadius: 10, paddingVertical: 10,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
