// app/(technician)/refueling-flow/select-fuel-purchase.tsx
//
// Lists fuel purchases with remaining balance -- merging the server-cached
// list (works offline via cachedGet) with any purchases created locally in
// this offline session that haven't synced yet (so they're immediately
// usable for the next site, not just after eventually syncing).

import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, RefreshControl,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { cachedGet } from "../../../services/offlineApi";
import { patchWorkflowStatus } from "../../../services/offlineWorkflow";
import { getLocalPurchases, LocalFuelPurchase } from "../../../lib/localPurchases";
import { Colors } from "../../../constants/Colors";

interface FuelPurchase {
  _id: string;
  client_id?: string;
  purchase_date: string;
  total_quantity: number;
  remaining_quantity: number;
  truck_plate_number?: string;
  supplier?: string;
  isLocalOnly?: boolean;
}

export default function SelectFuelPurchaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    siteId: string;
    siteCode: string;
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId: string;
    workflowId: string;
    workflowClientId: string;
  }>();

  const [purchases, setPurchases] = useState<FuelPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const fetchPurchases = useCallback(async () => {
    try {
      let serverPurchases: FuelPurchase[] = [];
      let fromCache = false;
      try {
        const result = await cachedGet("/technician/fuel-purchases/active");
        fromCache = result.fromCache;
        serverPurchases = result.data?.data || [];
      } catch {
        // Genuinely no cache and no connection yet -- fine, local overlay
        // below may still have something to show.
        fromCache = true;
      }
      setIsOffline(fromCache);

      // Merge in purchases created locally this session that haven't
      // synced yet -- these won't be in the server cache above.
      const local: LocalFuelPurchase[] = await getLocalPurchases();
      const localAsPurchases: FuelPurchase[] = local
        .filter((p) => p.remaining_quantity > 0)
        .map((p) => ({
          _id: `local:${p.client_id}`,
          client_id: p.client_id,
          purchase_date: p.purchase_date,
          total_quantity: p.total_quantity,
          remaining_quantity: p.remaining_quantity,
          truck_plate_number: p.truck_plate_number,
          isLocalOnly: true,
        }));

      // De-dupe: once a local purchase syncs, it appears in serverPurchases
      // by client_id and should replace the local-overlay entry, not
      // duplicate it.
      const serverClientIds = new Set(serverPurchases.map((p) => p.client_id).filter(Boolean));
      const dedupedLocal = localAsPurchases.filter((p) => !serverClientIds.has(p.client_id));

      setPurchases([...dedupedLocal, ...serverPurchases]);
    } catch (err) {
      console.error("[SelectFuelPurchase] failed to load purchases:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Re-fetch whenever we return here (e.g. after creating a new purchase)
  useFocusEffect(
    useCallback(() => {
      fetchPurchases();
    }, [fetchPurchases]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPurchases();
  };

  const handleSelect = async (purchase: FuelPurchase) => {
    setSelectingId(purchase._id);
    try {
      // patchWorkflowStatus always succeeds -- updates the local workflow
      // cache immediately and queues the server patch, resolved by
      // whichever id (real or client-generated) the workflow currently has.
      await patchWorkflowStatus(
        params.siteId,
        params.workflowId,
        params.workflowClientId,
        "purchase_selected",
        {
          fuelPurchaseId: purchase.isLocalOnly ? undefined : purchase._id,
          fuelPurchaseClientId: purchase.client_id,
          selectedAt: new Date().toISOString(),
        },
      );

      router.replace({
        pathname: "/(technician)/refueling-flow/check-in-site",
        params: { ...params },
      });
    } catch (err: any) {
      console.error("[SelectFuelPurchase] select error:", err?.message);
      Alert.alert("Error", "Failed to select fuel purchase.");
    } finally {
      setSelectingId(null);
    }
  };

  const handleNewPurchase = () => {
    router.push({
      pathname: "/(technician)/refueling-flow/new-fuel-purchase",
      params: { ...params },
    });
  };

  const fmtDate = (ts?: string) => (ts ? new Date(ts).toLocaleDateString() : "-");

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Fuel Purchase</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.siteName}>{params.siteName}</Text>
        <Text style={styles.siteCode}>{params.siteCode}</Text>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <FontAwesome5 name="wifi" size={11} color="#92400E" />
            <Text style={styles.offlineBannerText}>Offline — showing locally saved purchases</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <FontAwesome5 name="info-circle" size={16} color="#1E40AF" />
          <Text style={styles.infoText}>
            Pick the fuel batch you're using for this site, or record a new purchase if you just
            bought more. Works fully offline — everything syncs automatically once you're
            reconnected.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
        ) : purchases.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="gas-pump" size={40} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No fuel purchases with remaining balance.</Text>
          </View>
        ) : (
          purchases.map((p) => (
            <TouchableOpacity
              key={p._id}
              style={styles.purchaseCard}
              onPress={() => handleSelect(p)}
              disabled={selectingId !== null}
            >
              <View style={styles.purchaseIconBox}>
                <FontAwesome5 name="gas-pump" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.purchaseQty}>{p.remaining_quantity} L remaining</Text>
                <Text style={styles.purchaseSub}>
                  of {p.total_quantity} L • bought {fmtDate(p.purchase_date)}
                </Text>
                {p.truck_plate_number ? (
                  <Text style={styles.purchaseSub}>Truck: {p.truck_plate_number}</Text>
                ) : null}
                {p.isLocalOnly && (
                  <View style={styles.pendingSyncBadge}>
                    <FontAwesome5 name="clock" size={9} color="#92400E" />
                    <Text style={styles.pendingSyncText}>Not yet synced</Text>
                  </View>
                )}
              </View>
              {selectingId === p._id ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <FontAwesome5 name="chevron-right" size={16} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.newPurchaseBtn} onPress={handleNewPurchase}>
          <FontAwesome5 name="plus" size={16} color="#fff" />
          <Text style={styles.newPurchaseBtnText}>Record New Fuel Purchase</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#F3F4F6" },
  header: {
    backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  back: { padding: 4 },
  body: { padding: 20, gap: 14 },
  siteName: { fontSize: 20, fontWeight: "700", color: "#111827" },
  siteCode: { fontSize: 14, color: "#6B7280", marginTop: -8 },
  offlineBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
  },
  offlineBannerText: { color: "#92400E", fontSize: 12, fontWeight: "500" },
  infoCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoText: { flex: 1, fontSize: 13, color: "#1E40AF" },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: "center" },
  purchaseCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  purchaseIconBox: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center",
  },
  purchaseQty: { fontSize: 16, fontWeight: "700", color: "#111827" },
  purchaseSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  pendingSyncBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4,
    backgroundColor: "#FEF3C7", alignSelf: "flex-start",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  pendingSyncText: { color: "#92400E", fontSize: 10, fontWeight: "600" },
  newPurchaseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, marginTop: 8,
  },
  newPurchaseBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});






