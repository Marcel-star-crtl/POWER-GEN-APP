// components/ui/WhatsAppSharePopup.tsx
//
// Post-submit popup offering to share a just-filed report to a WhatsApp
// group of the technician's choosing. Two genuinely separate shares
// happen here, because WhatsApp itself doesn't offer one action that
// does both:
//
//  1. The formatted TEXT report — sent via the `wa.me` universal link,
//     which opens WhatsApp's own chat/group picker with the text
//     pre-filled. This deliberately does NOT use the `whatsapp://`
//     custom scheme, which on Android 11+ needs a <queries> manifest
//     entry to reliably pass Linking.canOpenURL/openURL — `wa.me` needs
//     no such configuration and works the same on iOS and Android.
//  2. PHOTOS — shared one at a time through the OS share sheet
//     (expo-sharing), so the technician picks "WhatsApp" and the same
//     chat/group again for each one. There is no lightweight (no
//     native-rebuild) way to send pre-filled text AND multiple images
//     to WhatsApp in a single action — that needs a heavier native
//     module (e.g. react-native-share) which wasn't part of this app's
//     dependencies and would require a new native build to add. If
//     that's ever added, this component is the only place that would
//     need to change.
//
// Nothing here silently loses a report: closing via the X, the
// backdrop, or "Share Later" all queue it (onFinish({ shared: false })
// — see lib/whatsappShareQueue.ts) so it can be re-sent later from
// app/(technician)/pending-whatsapp-shares.tsx. Only the explicit
// "Done — I've Shared This" button dismisses without queueing.

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../../constants/Colors";

export interface WhatsAppSharePhoto {
  uri: string;
  label: string;
}

interface WhatsAppSharePopupProps {
  visible: boolean;
  siteName: string;
  message: string;
  photos: WhatsAppSharePhoto[];
  /** queuedOffline: true when the submission itself is still sitting in
   * the offline outbox (see services/offlineApi.ts) rather than already
   * on the server — shown as a note so the technician isn't confused
   * about what "submitted" means right now. */
  queuedOffline?: boolean;
  /** Called exactly once when the popup is dismissed, however that
   * happens. `shared: false` means "queue this for later" (safe
   * default); `shared: true` means "the technician says they already
   * sent it, don't queue it again". */
  onFinish: (result: { shared: boolean }) => void;
}

export function WhatsAppSharePopup({
  visible,
  siteName,
  message,
  photos,
  queuedOffline,
  onFinish,
}: WhatsAppSharePopupProps) {
  const [copying, setCopying] = useState(false);
  const [sharingPhotoUri, setSharingPhotoUri] = useState<string | null>(null);

  const handleShareText = async () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Couldn't Open WhatsApp",
        "WhatsApp may not be installed on this device. Use \"Copy Text\" below and paste it into a chat manually, or tap \"Share Later\" to send it once you can.",
      );
    }
  };

  const handleCopyText = async () => {
    setCopying(true);
    try {
      await Clipboard.setStringAsync(message);
      Alert.alert("Copied", "Report text copied — paste it into any chat.");
    } catch {
      Alert.alert("Error", "Could not copy text to the clipboard.");
    } finally {
      setCopying(false);
    }
  };

  const handleSharePhoto = async (photo: WhatsAppSharePhoto) => {
    setSharingPhotoUri(photo.uri);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Not Available", "Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(photo.uri, {
        dialogTitle: `Share ${photo.label}`,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not share this photo.");
    } finally {
      setSharingPhotoUri(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => onFinish({ shared: false })}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Share Report to WhatsApp</Text>
              <Text style={styles.subtitle}>{siteName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => onFinish({ shared: false })}
              style={styles.closeBtn}
              accessibilityLabel="Close — share later"
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.successBannerText}>
              {queuedOffline
                ? "Saved — no connection right now, this will sync automatically. You can still share the report below."
                : "Refueling submitted successfully."}
            </Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={styles.sectionLabel}>REPORT TEXT</Text>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareText}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.whatsappBtnText}>Share Text to WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyText}
                disabled={copying}
              >
                {copying ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>Copy Text</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.helperNote}>
              Opens WhatsApp's own chat picker with this text pre-filled — pick any chat or group.
            </Text>

            {photos.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                  PICTURES ({photos.length})
                </Text>
                <Text style={styles.helperNote}>
                  WhatsApp can't take pre-filled text and photos in one tap. Share each photo below,
                  then pick the same WhatsApp chat again.
                </Text>
                {photos.map((photo, idx) => (
                  <View key={`${photo.uri}_${idx}`} style={styles.photoRow}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <Text style={styles.photoLabel} numberOfLines={2}>
                      {photo.label}
                    </Text>
                    <TouchableOpacity
                      style={styles.photoShareBtn}
                      onPress={() => handleSharePhoto(photo)}
                      disabled={sharingPhotoUri === photo.uri}
                    >
                      {sharingPhotoUri === photo.uri ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Ionicons name="share-outline" size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.laterBtn}
              onPress={() => onFinish({ shared: false })}
            >
              <Text style={styles.laterBtnText}>Not Now — Share Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => onFinish({ shared: true })}
            >
              <Text style={styles.doneBtnText}>Done — I've Shared This</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4, marginLeft: 8 },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  successBannerText: { flex: 1, fontSize: 12.5, color: "#166534", lineHeight: 17 },

  body: { paddingHorizontal: 18, paddingTop: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  messageBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
  },
  messageText: { fontSize: 12.5, color: Colors.text, lineHeight: 19 },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  whatsappBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 12,
  },
  whatsappBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  copyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  copyBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 13.5 },
  helperNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 8, lineHeight: 15 },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  photoThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#eee" },
  photoLabel: { flex: 1, fontSize: 12.5, color: Colors.text },
  photoShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  laterBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  laterBtnText: { color: Colors.textSecondary, fontWeight: "600", fontSize: 13.5 },
  doneBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 13,
    backgroundColor: Colors.primary,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
});
