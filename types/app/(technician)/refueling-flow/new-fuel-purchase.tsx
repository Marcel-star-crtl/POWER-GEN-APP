// app/(technician)/refueling-flow/new-fuel-purchase.tsx
//
// Records a bulk fuel purchase at the station.
// - Tom Card loaded from /technician/fuel-purchases/cards/:cycle_key
// - Cluster auto-filled from selected card
// - Records arrival_time at station and departure_time
// - Timestamps feed the workflow timeline on the dashboard
// Works offline: submitOrQueue handles upload + queueing.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { PhotoCapture, PhotoAttachment } from '../../../components/ui/PhotoCapture';
import { submitOrQueue, generateClientId, cachedGet } from '../../../services/offlineApi';
import { patchWorkflowStatus } from '../../../services/offlineWorkflow';
import { addLocalPurchase } from '../../../lib/localPurchases';

interface TomCard {
  cluster:       string;
  card_number:   string;
  fuel_vendor:   string;
  xaf_per_liter: number;
}

export default function NewFuelPurchaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    siteId?: string;
    siteCode?: string;
    siteName?: string;
    tankId?: string;
    capacity?: string;
    currentLevel?: string;
    maintenanceId?: string;
    workflowId?: string;
    workflowClientId?: string;
    cycleKey?: string;
  }>();

  const isSiteFlow = !!params.siteId;
  // Fast synchronous guess so the screen has something to render
  // immediately — corrected below via the real backend cycle lookup as
  // soon as it resolves. This guess is ONLY right for days 1-25 of a
  // month; days 26-31 belong to next month's cycle (see the fix note
  // below), so it must never be trusted on its own past this point.
  const [cycleKey, setCycleKey] = useState(params.cycleKey || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })());

  // Resolve the REAL current cycle from the backend — the same source of
  // truth (DieselCycle.getOrCreateCurrent, the 26th-25th billing rule)
  // that the Tom Card upload's cycle_key and the web dashboard already
  // use. Skipped entirely if the caller explicitly passed a cycleKey
  // param, so an intentional override is never silently replaced.
  useEffect(() => {
    if (params.cycleKey) return;
    (async () => {
      try {
        const { data } = await cachedGet('/cycles/current');
        const realCycleKey = data?.data?.cycle_key;
        if (realCycleKey) setCycleKey(realCycleKey);
      } catch (e) {
        // Non-fatal — keep the calendar-month guess rather than blocking
        // the screen. It'll only be wrong during the last ~6 days of a
        // cycle, and the "No Tom Cards found" message below at least
        // tells the technician which cycle it actually tried.
        console.warn('[NewFuelPurchase] Could not resolve current cycle, using calendar-month guess:', e);
      }
    })();
  }, [params.cycleKey]);

  // Tom Card state
  const [cards,          setCards]          = useState<TomCard[]>([]);
  const [cardsLoading,   setCardsLoading]   = useState(false);
  const [selectedCard,   setSelectedCard]   = useState<TomCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);

  // Form state
  const [photo,          setPhoto]          = useState<PhotoAttachment | null>(null);
  const [totalQty,       setTotalQty]       = useState('');
  const [pricePerLiter,  setPricePerLiter]  = useState('');
  const [truckPlate,     setTruckPlate]     = useState('');
  const [station,        setStation]        = useState('');
  const [arrivalTime,    setArrivalTime]    = useState(new Date().toISOString()); // stamp when screen opens
  const [loading,        setLoading]        = useState(false);

  // Load Tom Cards for the cycle
  const loadCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const { data } = await cachedGet(`/technician/fuel-purchases/cards/${cycleKey}`);
      const list: TomCard[] = data?.data || [];
      setCards(list);
      if (list.length === 1) setSelectedCard(list[0]); // auto-select if only one
    } catch (e) {
      console.warn('[NewFuelPurchase] Could not load Tom Cards:', e);
    } finally {
      setCardsLoading(false);
    }
  }, [cycleKey]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const qty          = parseFloat(totalQty) || 0;
  const ppl          = parseFloat(pricePerLiter) || (selectedCard?.xaf_per_liter || 828);
  const totalCostXAF = qty * ppl;

  const handleSave = async () => {
    if (!photo) {
      Alert.alert('Required', 'Please take a photo at the fuel station.');
      return;
    }
    if (!totalQty || qty <= 0) {
      Alert.alert('Required', 'Please enter the total quantity purchased.');
      return;
    }
    if (!selectedCard) {
      Alert.alert('Required', 'Please select the Tom Card used for this purchase.');
      return;
    }

    const departureTime = new Date().toISOString(); // stamp when they save = leaving station

    setLoading(true);
    try {
      const clientId = generateClientId();

      await addLocalPurchase({
        client_id:          clientId,
        purchase_date:      new Date().toISOString(),
        total_quantity:     qty,
        remaining_quantity: qty,
        truck_plate_number: truckPlate || undefined,
        tom_card_number:    selectedCard.card_number,
        cluster:            selectedCard.cluster,
        synced: false,
      });

      const result = await submitOrQueue(
        'fuel_purchase_create',
        '/technician/fuel-purchases',
        'POST',
        {
          client_id:          clientId,
          photo:              photo.uri,
          total_quantity:     qty,
          price_per_liter:    ppl,
          total_cost_xaf:     totalCostXAF,
          truck_plate_number: truckPlate  || undefined,
          supplier:           selectedCard.fuel_vendor,
          station:            station     || undefined,
          tom_card_number:    selectedCard.card_number,
          cluster:            selectedCard.cluster,
          arrival_time:       arrivalTime,
          departure_time:     departureTime,
          purchase_date:      new Date().toISOString(),
        },
      );

      const fuelPurchaseId = result.queued ? undefined : result.data?.data?._id;

      if (isSiteFlow && params.workflowId && params.workflowClientId) {
        await patchWorkflowStatus(
          params.siteId!,
          params.workflowId,
          params.workflowClientId,
          'purchase_selected',
          {
            fuelPurchaseId,
            fuelPurchaseClientId:  clientId,
            selectedAt:            new Date().toISOString(),
            tom_card_number:       selectedCard.card_number,
            cluster:               selectedCard.cluster,
            station,
            arrival_time_station:  arrivalTime,
            departure_time_station:departureTime,
          },
        );

        router.replace({
          pathname: '/(technician)/refueling-flow/check-in-site',
          params: { ...params },
        });
      } else {
        Alert.alert(
          'Purchase Saved',
          result.queued
            ? 'No connection — purchase saved and will sync automatically.'
            : `${qty} L recorded.\nCard: ${selectedCard.card_number} (${selectedCard.cluster})\nCost: XAF ${totalCostXAF.toLocaleString()}`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (err: any) {
      console.error('[NewFuelPurchase] error:', err?.message);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save fuel purchase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Record Fuel Purchase</Text>
          {isSiteFlow && params.siteName && (
            <Text style={styles.headerSub}>{params.siteName} · {params.siteCode}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Info */}
        <View style={styles.infoCard}>
          <FontAwesome5 name="info-circle" size={14} color="#1E40AF" />
          <Text style={styles.infoText}>
            This purchase can be shared across multiple sites. Your arrival time has been
            recorded automatically.
          </Text>
        </View>

        {/* Tom Card selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Tom Card <Text style={styles.req}>*</Text></Text>

          {cardsLoading ? (
            <View style={styles.cardLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.cardLoadingText}>Loading cards for {cycleKey}…</Text>
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.noCards}>
              <FontAwesome5 name="exclamation-triangle" size={14} color="#D97706" />
              <Text style={styles.noCardsText}>
                No Tom Cards found for cycle {cycleKey}. Upload the card template first.
              </Text>
            </View>
          ) : selectedCard ? (
            <TouchableOpacity style={styles.selectedCard} onPress={() => setShowCardPicker(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedCardNumber}>Card {selectedCard.card_number}</Text>
                <Text style={styles.selectedCardSub}>
                  {selectedCard.cluster} · {selectedCard.fuel_vendor}
                </Text>
              </View>
              <FontAwesome5 name="chevron-down" size={13} color="#6B7280" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cardPickerBtn} onPress={() => setShowCardPicker(true)}>
              <FontAwesome5 name="credit-card" size={14} color={Colors.primary} />
              <Text style={styles.cardPickerText}>Select Tom Card</Text>
              <FontAwesome5 name="chevron-down" size={12} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {showCardPicker && (
            <View style={styles.cardDropdown}>
              {cards.map(c => (
                <TouchableOpacity key={c.card_number} style={styles.cardOption}
                  onPress={() => { setSelectedCard(c); setShowCardPicker(false); }}>
                  <Text style={styles.cardOptionNumber}>Card {c.card_number}</Text>
                  <Text style={styles.cardOptionSub}>{c.cluster} · {c.fuel_vendor} · XAF {c.xaf_per_liter}/L</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Station name */}
        <View style={styles.section}>
          <Text style={styles.label}>Station / Location</Text>
          <TextInput style={styles.input} placeholder="e.g. Total Bonaberi" placeholderTextColor="#9CA3AF"
            value={station} onChangeText={setStation} />
        </View>

        {/* Photo */}
        <View style={styles.section}>
          <PhotoCapture
            label="Photo at Fuel Station *"
            photos={photo ? [photo] : []}
            onAddPhoto={p => setPhoto(p)}
            onRemovePhoto={() => setPhoto(null)}
            required
          />
        </View>

        {/* Quantity */}
        <View style={styles.section}>
          <Text style={styles.label}>Total Quantity Purchased (L) <Text style={styles.req}>*</Text></Text>
          <View style={styles.qtyRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="e.g. 1000"
              placeholderTextColor="#9CA3AF" keyboardType="numeric"
              value={totalQty} onChangeText={setTotalQty} />
            <View style={styles.qtyUnit}><Text style={styles.qtyUnitText}>L</Text></View>
          </View>
        </View>

        {/* Price */}
        <View style={styles.section}>
          <Text style={styles.label}>Price per Litre (XAF)</Text>
          <TextInput style={styles.input}
            placeholder={selectedCard ? `Default: XAF ${selectedCard.xaf_per_liter}` : 'e.g. 828'}
            placeholderTextColor="#9CA3AF" keyboardType="numeric"
            value={pricePerLiter} onChangeText={setPricePerLiter} />
          {qty > 0 && (
            <Text style={styles.totalCost}>
              Total cost: XAF {totalCostXAF.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Truck plate */}
        <View style={styles.section}>
          <Text style={styles.label}>Truck / Vehicle Plate</Text>
          <TextInput style={styles.input} placeholder="e.g. LT 1234 AB" placeholderTextColor="#9CA3AF"
            value={truckPlate} onChangeText={setTruckPlate} />
        </View>

        {/* Arrival time stamp */}
        <View style={styles.timestampBadge}>
          <FontAwesome5 name="clock" size={12} color="#2563EB" />
          <Text style={styles.timestampText}>
            Arrival at station recorded: {new Date(arrivalTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.btn, (!photo || !totalQty || !selectedCard || loading) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!photo || !totalQty || !selectedCard || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <FontAwesome5 name="check" size={15} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>{isSiteFlow ? 'Save & Continue →' : 'Save Purchase'}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F3F4F6' },
  header:            { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerTitle:       { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub:         { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  backBtn:           { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  body:              { padding: 16, gap: 14 },
  infoCard:          { flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  infoText:          { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  section:           { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  label:             { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  req:               { color: Colors.primary },
  input:             { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, height: 46, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  qtyRow:            { flexDirection: 'row', gap: 8 },
  qtyUnit:           { width: 40, height: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  qtyUnitText:       { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  totalCost:         { fontSize: 12, color: '#16A34A', fontWeight: '700', marginTop: 6 },
  cardLoading:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  cardLoadingText:   { fontSize: 13, color: '#6B7280' },
  noCards:           { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8 },
  noCardsText:       { flex: 1, fontSize: 12, color: '#D97706' },
  selectedCard:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8, padding: 12, backgroundColor: '#FFF5F5' },
  selectedCardNumber:{ fontSize: 15, fontWeight: '700', color: '#111827' },
  selectedCardSub:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardPickerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8, padding: 12, borderStyle: 'dashed' },
  cardPickerText:    { flex: 1, fontSize: 14, color: Colors.primary, fontWeight: '600' },
  cardDropdown:      { marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  cardOption:        { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  cardOptionNumber:  { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardOptionSub:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  timestampBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  timestampText:     { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  btn:               { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnDisabled:       { opacity: 0.45 },
  btnText:           { color: '#fff', fontWeight: '800', fontSize: 16 },
});












// // app/(technician)/refueling-flow/new-fuel-purchase.tsx
// //
// // Captures ONE bulk fuel purchase (photo + total quantity bought, optional
// // price/truck info). Works fully offline: the purchase is added to a local
// // overlay list immediately (so it's usable for OTHER sites in the same
// // offline session, before it ever syncs) and queued for the server. If
// // launched from within a site's refuel flow (siteId/workflowId params
// // present), it also attaches itself to that site's workflow and continues
// // to check-in. If launched standalone, it just records the purchase.

// import React, { useState } from "react";
// import {
//   View, Text, StyleSheet, TextInput, TouchableOpacity,
//   Alert, ActivityIndicator, ScrollView,
// } from "react-native";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import { PhotoCapture, PhotoAttachment } from "../../../components/ui/PhotoCapture";
// import { submitOrQueue, generateClientId } from "../../../services/offlineApi";
// import { patchWorkflowStatus } from "../../../services/offlineWorkflow";
// import { addLocalPurchase } from "../../../lib/localPurchases";
// import { Colors } from "../../../constants/Colors";
// import { FontAwesome5 } from "@expo/vector-icons";

// export default function NewFuelPurchaseScreen() {
//   const router = useRouter();
//   const params = useLocalSearchParams<{
//     siteId?: string;
//     siteCode?: string;
//     siteName?: string;
//     tankId?: string;
//     capacity?: string;
//     currentLevel?: string;
//     maintenanceId?: string;
//     workflowId?: string;
//     workflowClientId?: string;
//   }>();

//   const isSiteFlow = !!params.siteId;

//   const [photo, setPhoto] = useState<PhotoAttachment | null>(null);
//   const [totalQty, setTotalQty] = useState("");
//   const [pricePerLiter, setPricePerLiter] = useState("");
//   const [truckPlate, setTruckPlate] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleSave = async () => {
//     if (!photo) {
//       Alert.alert("Required", "Please take a photo at the fuel station.");
//       return;
//     }
//     if (!totalQty || isNaN(Number(totalQty)) || Number(totalQty) <= 0) {
//       Alert.alert("Required", "Please enter a valid total quantity purchased.");
//       return;
//     }

//     setLoading(true);
//     try {
//       const clientId = generateClientId();
//       const qty = Number(totalQty);

//       // Add to the local overlay FIRST, before attempting the network call
//       // at all -- this purchase must be selectable for another site right
//       // away regardless of whether the create below succeeds immediately
//       // or ends up queued.
//       await addLocalPurchase({
//         client_id: clientId,
//         purchase_date: new Date().toISOString(),
//         total_quantity: qty,
//         remaining_quantity: qty,
//         truck_plate_number: truckPlate || undefined,
//         synced: false,
//       });

//       const result = await submitOrQueue(
//         "fuel_purchase_create",
//         "/technician/fuel-purchases",
//         "POST",
//         {
//           client_id: clientId,
//           photo: photo.uri, // raw local uri -- submitOrQueue uploads it for us
//           total_quantity: qty,
//           price_per_liter: pricePerLiter ? Number(pricePerLiter) : undefined,
//           truck_plate_number: truckPlate || undefined,
//         },
//       );

//       const fuelPurchaseId = result.queued ? undefined : result.data?.data?._id;

//       if (isSiteFlow && params.workflowId && params.workflowClientId) {
//         // Attach this purchase to the current site's workflow and continue.
//         // patchWorkflowStatus always succeeds -- local cache updates
//         // immediately, server patch is queued regardless of connectivity.
//         await patchWorkflowStatus(
//           params.siteId!,
//           params.workflowId,
//           params.workflowClientId,
//           "purchase_selected",
//           {
//             fuelPurchaseId,
//             fuelPurchaseClientId: clientId,
//             selectedAt: new Date().toISOString(),
//           },
//         );

//         router.replace({
//           pathname: "/(technician)/refueling-flow/check-in-site",
//           params: { ...params },
//         });
//       } else {
//         Alert.alert(
//           "Saved",
//           result.queued
//             ? "No connection — purchase saved and will sync automatically."
//             : "Fuel purchase recorded.",
//           [{ text: "OK", onPress: () => router.back() }],
//         );
//       }
//     } catch (err: any) {
//       console.error("[NewFuelPurchase] error:", err?.message);
//       Alert.alert("Error", err?.response?.data?.error || "Failed to save fuel purchase.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => router.back()} style={styles.back}>
//           <FontAwesome5 name="arrow-left" size={20} color="#fff" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Record Fuel Purchase</Text>
//         <View style={{ width: 40 }} />
//       </View>

//       <View style={styles.body}>
//         {isSiteFlow && (
//           <>
//             <Text style={styles.siteName}>{params.siteName}</Text>
//             <Text style={styles.siteCode}>{params.siteCode}</Text>
//           </>
//         )}

//         <View style={styles.infoCard}>
//           <FontAwesome5 name="info-circle" size={16} color="#1E40AF" />
//           <Text style={styles.infoText}>
//             This purchase can be reused across multiple sites — you won't need to re-enter it
//             until the balance runs out. Works fully offline.
//           </Text>
//         </View>

//         <PhotoCapture
//           label="Photo at Fuel Station *"
//           photos={photo ? [photo] : []}
//           onAddPhoto={(p) => setPhoto(p)}
//           onRemovePhoto={() => setPhoto(null)}
//           required
//         />

//         <Text style={styles.label}>Total Quantity Purchased (L) *</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="e.g. 1000"
//           keyboardType="numeric"
//           value={totalQty}
//           onChangeText={setTotalQty}
//         />

//         <Text style={styles.label}>Price per Liter (Optional)</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="e.g. 750"
//           keyboardType="numeric"
//           value={pricePerLiter}
//           onChangeText={setPricePerLiter}
//         />

//         <Text style={styles.label}>Truck / Vehicle Plate Number (Optional)</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="e.g. LT 1234 AB"
//           value={truckPlate}
//           onChangeText={setTruckPlate}
//         />

//         <TouchableOpacity
//           style={[styles.btn, loading && { opacity: 0.6 }]}
//           onPress={handleSave}
//           disabled={loading}
//         >
//           {loading
//             ? <ActivityIndicator color="#fff" />
//             : <Text style={styles.btnText}>
//                 {isSiteFlow ? "Save & Continue →" : "Save Purchase"}
//               </Text>}
//         </TouchableOpacity>
//       </View>
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flexGrow: 1, backgroundColor: "#F3F4F6" },
//   header: {
//     backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center",
//     justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14,
//   },
//   headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
//   back: { padding: 4 },
//   body: { padding: 20, gap: 16 },
//   siteName: { fontSize: 20, fontWeight: "700", color: "#111827" },
//   siteCode: { fontSize: 14, color: "#6B7280", marginTop: -8 },
//   infoCard: {
//     flexDirection: "row", alignItems: "center", gap: 10,
//     backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14,
//     borderWidth: 1, borderColor: "#BFDBFE",
//   },
//   infoText: { flex: 1, fontSize: 13, color: "#1E40AF" },
//   label: { fontSize: 14, fontWeight: "600", color: "#374151" },
//   input: {
//     backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
//     borderRadius: 10, padding: 12, fontSize: 16, color: "#111827",
//   },
//   btn: {
//     backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
//     alignItems: "center", marginTop: 8,
//   },
//   btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
// });






