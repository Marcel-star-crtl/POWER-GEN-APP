import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/Colors";
import { cachedGet } from "../../services/offlineApi";

interface SiteItem {
  IHS_ID_SITE: string;
  Site_Name: string;
}

export default function SelectSiteHSE() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true);
        const { data: response, fromCache } = await cachedGet("/technician/sites");
        setIsOffline(fromCache);
        setSites(response?.data || []);
      } catch (error) {
        console.error("Failed to load sites", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, []);

  const filteredSites = sites.filter(
    (s) =>
      s.Site_Name?.toLowerCase().includes(query.toLowerCase()) ||
      s.IHS_ID_SITE?.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>HSE Inspection</Text>
          <Text style={styles.subtitle}>Select a site to inspect</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#92400E" />
          <Text style={styles.offlineBannerText}>Offline — showing last saved sites</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color={Colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Search by site name or ID..."
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredSites.length === 0 ? (
            <View style={styles.center}>
              <Ionicons
                name="location-outline"
                size={48}
                color={Colors.textSecondary}
              />
              <Text style={styles.emptyText}>No sites found</Text>
            </View>
          ) : (
            filteredSites.map((site) => (
              <TouchableOpacity
                key={site.IHS_ID_SITE}
                style={styles.siteCard}
                onPress={() =>
                  router.push({
                    pathname: "/(technician)/hse-form/[siteId]",
                    params: {
                      siteId: site.IHS_ID_SITE,
                      siteName: site.Site_Name,
                    },
                  })
                }
              >
                <View style={styles.siteIconContainer}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={22}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.siteInfo}>
                  <Text style={styles.siteName}>{site.Site_Name}</Text>
                  <Text style={styles.siteId}>{site.IHS_ID_SITE}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 4 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: "center" },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineBannerText: { color: "#92400E", fontSize: 12, fontWeight: "500" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: { marginTop: 12, color: Colors.textSecondary, fontSize: 15 },
  siteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  siteIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  siteInfo: { flex: 1 },
  siteName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  siteId: { marginTop: 2, fontSize: 12, color: Colors.textSecondary },
});






