// app/(technician)/refueling-flow/check-in-site.tsx
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PhotoCapture, PhotoAttachment } from "../../../components/ui/PhotoCapture";
import { patchWorkflowStatus } from "../../../services/offlineWorkflow";
import { Colors } from "../../../constants/Colors";
import { FontAwesome5 } from "@expo/vector-icons";

export default function CheckInSiteScreen() {
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

  const [photo, setPhoto]     = useState<PhotoAttachment | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // Photo stays as a raw local uri -- patchWorkflowStatus's underlying
      // submitOrQueue call handles uploading it (online) or persisting it
      // for later upload (offline) automatically, since it recurses into
      // the meta object looking for anything with a `.uri`. No direct
      // upload call here means this never throws just for being offline.
      await patchWorkflowStatus(
        params.siteId,
        params.workflowId,
        params.workflowClientId,
        "checked_in",
        {
          photo: photo ? { uri: photo.uri } : undefined,
          checkedInAt: new Date().toISOString(),
        },
      );

      console.log("[CheckIn] Patched checked_in, workflowId:", params.workflowId);

      router.replace({
        pathname: "/(technician)/refueling/form",
        params: { ...params },
      });
    } catch (err: any) {
      // patchWorkflowStatus itself doesn't throw for connectivity reasons --
      // this catch only fires for genuine unexpected errors, so it's safe
      // to surface as a real error here.
      console.error("[CheckIn] error:", err?.message);
      Alert.alert("Error", "Failed to save check-in data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check-In at Site</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.siteName}>{params.siteName}</Text>
        <Text style={styles.siteCode}>{params.siteCode}</Text>

        <View style={styles.infoCard}>
          <FontAwesome5 name="map-marker-alt" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>Take an optional photo when you arrive at the site.</Text>
        </View>

        <PhotoCapture
          label="Site Arrival Photo (Optional)"
          photos={photo ? [photo] : []}
          onAddPhoto={(p) => setPhoto(p)}
          onRemovePhoto={() => setPhoto(null)}
          required={false}
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleCheckIn}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Check In & Open Form →</Text>}
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
  back:        { padding: 4 },
  body:        { padding: 20, gap: 16 },
  siteName:    { fontSize: 20, fontWeight: "700", color: "#111827" },
  siteCode:    { fontSize: 14, color: "#6B7280", marginTop: -8 },
  infoCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoText: { flex: 1, fontSize: 14, color: "#1E40AF" },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});










// // app/(technician)/refueling-flow/check-in-site.tsx
// import React, { useState } from "react";
// import {
//   View, Text, StyleSheet, TouchableOpacity, Alert,
//   ActivityIndicator, ScrollView,
// } from "react-native";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import { PhotoCapture, PhotoAttachment } from "../../../components/ui/PhotoCapture";
// import { refuelWorkflowAPI } from "../../../services/refuelWorkflowAPI";
// import { uploadAPI } from "../../../services/api";
// import { Colors } from "../../../constants/Colors";
// import { FontAwesome5 } from "@expo/vector-icons";

// export default function CheckInSiteScreen() {
//   const router = useRouter();
//   const params = useLocalSearchParams<{
//     siteId: string;
//     siteCode: string;
//     siteName: string;
//     tankId: string;
//     capacity: string;
//     currentLevel: string;
//     maintenanceId: string;
//     workflowId: string;
//   }>();

//   const [photo, setPhoto]     = useState<PhotoAttachment | null>(null);
//   const [loading, setLoading] = useState(false);

//   const handleCheckIn = async () => {
//     if (!params.workflowId) {
//       Alert.alert("Error", "Workflow ID missing. Please restart the process.");
//       router.back();
//       return;
//     }

//     try {
//       setLoading(true);

//       let photoUrl: string | undefined;
//       if (photo) {
//         const uploaded = await uploadAPI.processAndUploadData([photo.uri]);
//         photoUrl = uploaded?.[0] ?? photo.uri;
//       }

//       await refuelWorkflowAPI.updateStatus(params.workflowId, "checked_in", {
//         photo:       photoUrl,
//         checkedInAt: new Date().toISOString(),
//       });

//       console.log("[CheckIn] Patched checked_in, workflowId:", params.workflowId);

//       router.replace({
//         pathname: "/(technician)/refueling/form",
//         params: { ...params },
//       });
//     } catch (err: any) {
//       console.error("[CheckIn] error:", err?.message);
//       Alert.alert("Error", "Failed to save check-in data.");
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
//         <Text style={styles.headerTitle}>Check-In at Site</Text>
//         <View style={{ width: 40 }} />
//       </View>

//       <View style={styles.body}>
//         <Text style={styles.siteName}>{params.siteName}</Text>
//         <Text style={styles.siteCode}>{params.siteCode}</Text>

//         <View style={styles.infoCard}>
//           <FontAwesome5 name="map-marker-alt" size={18} color={Colors.primary} />
//           <Text style={styles.infoText}>Take an optional photo when you arrive at the site.</Text>
//         </View>

//         <PhotoCapture
//           label="Site Arrival Photo (Optional)"
//           photos={photo ? [photo] : []}
//           onAddPhoto={(p) => setPhoto(p)}
//           onRemovePhoto={() => setPhoto(null)}
//           required={false}
//         />

//         <TouchableOpacity
//           style={[styles.btn, loading && { opacity: 0.6 }]}
//           onPress={handleCheckIn}
//           disabled={loading}
//         >
//           {loading
//             ? <ActivityIndicator color="#fff" />
//             : <Text style={styles.btnText}>Check In & Open Form →</Text>}
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
//   back:        { padding: 4 },
//   body:        { padding: 20, gap: 16 },
//   siteName:    { fontSize: 20, fontWeight: "700", color: "#111827" },
//   siteCode:    { fontSize: 14, color: "#6B7280", marginTop: -8 },
//   infoCard: {
//     flexDirection: "row", alignItems: "center", gap: 10,
//     backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14,
//     borderWidth: 1, borderColor: "#BFDBFE",
//   },
//   infoText: { flex: 1, fontSize: 14, color: "#1E40AF" },
//   btn: {
//     backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
//     alignItems: "center", marginTop: 8,
//   },
//   btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
// });


