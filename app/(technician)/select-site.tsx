import { FontAwesome5 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/ui/Card";
import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
import { Colors } from "../../constants/Colors";
import { cachedGet } from "../../services/offlineApi";
import { useSyncCompletion } from "../../hooks/useSyncCompletion";

interface SiteItem {
  IHS_ID_SITE: string;
  Site_Name: string;
  next_maintenance?: {
    maintenance_id: string;
    date: string | Date;
    type: string;
    priority: string;
    status: "pending" | "scheduled" | "in_progress" | "completed" | "approved";
  };
}

export default function SelectSite() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    nextPath?: string;
    requiredAction?: string;
  }>();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "in_progress" | "completed"
  >("pending");

  const fetchSites = async () => {
    try {
      setLoading(true);
      // Cached: shows the last-loaded site list immediately when offline,
      // and silently refreshes + re-caches whenever a connection is available.
      const { data: response, fromCache } = await cachedGet("/technician/sites");
      setIsOffline(fromCache);
      const list: SiteItem[] = response?.data || [];
      setSites(list);
      console.log("✅ SelectSite loaded sites:", list.length, fromCache ? "(from cache)" : "(fresh)");
    } catch (error: any) {
      console.error(
        "❌ Failed to load sites:",
        error.response?.data || error.message,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // Whatever synced while offline (e.g. a completed visit at this site)
  // now reflects on the server -- refresh automatically.
  useSyncCompletion(fetchSites);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();

    // If searching, skip status filter and search all sites
    if (q) {
      return sites.filter(
        (s) =>
          s.Site_Name?.toLowerCase().includes(q) ||
          s.IHS_ID_SITE?.toLowerCase().includes(q),
      );
    }

    // No query: apply status filter as before
    return sites.filter((s) => {
      const status = s.next_maintenance?.status?.toLowerCase();
      const type = s.next_maintenance?.type?.toUpperCase();
      if (type === "RF") return false;
      if (statusFilter === "pending") {
        return (
          status === "pending" ||
          status === "scheduled" ||
          status === "approved"
        );
      } else if (statusFilter === "in_progress") {
        return status === "in_progress";
      } else if (statusFilter === "completed") {
        return status === "completed" || status === "pending_approval";
      }
      return false;
    });
  }, [sites, query, statusFilter]);

  const handleSelect = (site: SiteItem) => {
    const maintenanceId = site.next_maintenance?.maintenance_id || "";

    if (params.nextPath) {
      const basePath = decodeURIComponent(params.nextPath);
      const separator = basePath.includes("?") ? "&" : "?";
      let target = `${basePath}${separator}siteId=${encodeURIComponent(site.IHS_ID_SITE)}&siteName=${encodeURIComponent(site.Site_Name)}`;
      if (maintenanceId)
        target += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
      router.push(target);
      return;
    }

    router.push({
      pathname: "/(technician)/maintenance-flow/activate-site",
      params: {
        maintenanceId,
        siteId: site.IHS_ID_SITE,
        siteName: site.Site_Name,
        visitDate: site.next_maintenance?.date
          ? String(site.next_maintenance.date)
          : "",
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <LoadingOverlay visible={loading} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("select_site")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <FontAwesome5 name="wifi" size={12} color="#92400E" />
          <Text style={styles.offlineBannerText}>
            Offline — showing last saved sites
          </Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("search_by_name_or_id")}
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            statusFilter === "pending" && styles.filterTabActive,
          ]}
          onPress={() => setStatusFilter("pending")}
        >
          <Text
            style={[
              styles.filterTabText,
              statusFilter === "pending" && styles.filterTabTextActive,
            ]}
          >
            {t("pending")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            statusFilter === "in_progress" && styles.filterTabActive,
          ]}
          onPress={() => setStatusFilter("in_progress")}
        >
          <Text
            style={[
              styles.filterTabText,
              statusFilter === "in_progress" && styles.filterTabTextActive,
            ]}
          >
            {t("in_progress")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            statusFilter === "completed" && styles.filterTabActive,
          ]}
          onPress={() => setStatusFilter("completed")}
        >
          <Text
            style={[
              styles.filterTabText,
              statusFilter === "completed" && styles.filterTabTextActive,
            ]}
          >
            {t("completed")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={
          filteredSites.length === 0 ? styles.emptyContainer : undefined
        }
      >
        {filteredSites.length === 0 && !loading ? (
          <Text style={styles.emptyText}>{t("no_sites_found")}</Text>
        ) : (
          Object.entries(
            filteredSites.reduce(
              (acc, site) => {
                const schedDate = site.next_maintenance?.scheduled_date;
                const mainDate = site.next_maintenance?.date;
                let dateObj = null;
                if (schedDate) {
                  dateObj =
                    typeof schedDate === "string"
                      ? new Date(schedDate)
                      : schedDate;
                } else if (mainDate) {
                  dateObj =
                    typeof mainDate === "string"
                      ? new Date(mainDate)
                      : mainDate;
                }
                const dateKey = dateObj
                  ? dateObj.toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })
                  : "No Date";
                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push(site);
                return acc;
              },
              /** @type {Record<string, SiteItem[]>} */ {},
            ),
          )
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([dateKey, sitesForDate]) => (
              <View key={dateKey} style={styles.dateSection}>
                <View style={styles.dateHeader}>
                  <View style={styles.dateInfo}>
                    <FontAwesome5
                      name="calendar-alt"
                      size={18}
                      color={Colors.primary}
                      style={styles.dateIcon}
                    />
                    <Text style={styles.dateText}>
                      {dateKey !== "No Date"
                        ? new Date(dateKey).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })
                        : t("no_date")}
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {sitesForDate.length}
                    </Text>
                  </View>
                </View>
                {sitesForDate.map((item) => (
                  <TouchableOpacity
                    key={item.IHS_ID_SITE}
                    onPress={() => handleSelect(item)}
                  >
                    <Card style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.siteName}>{item.Site_Name}</Text>
                        <FontAwesome5
                          name="chevron-right"
                          size={16}
                          color={Colors.textSecondary}
                        />
                      </View>
                      <Text style={styles.siteId}>{item.IHS_ID_SITE}</Text>
                      <View style={styles.maintenanceRow}>
                        {item.next_maintenance?.type && (
                          <Text style={styles.maintenanceType}>
                            {item.next_maintenance.type}
                          </Text>
                        )}
                        {item.next_maintenance?.priority && (
                          <View
                            style={[
                              styles.priorityBadge,
                              { backgroundColor: Colors.warning },
                            ]}
                          >
                            <Text style={styles.priorityText}>
                              {item.next_maintenance.priority?.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineBannerText: { color: "#92400E", fontSize: 12, fontWeight: "500" },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: "#FFF",
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: Colors.surface,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  siteName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  siteId: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  maintenanceRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  maintenanceType: {
    fontSize: 12,
    color: Colors.primary,
    backgroundColor: Colors.primary + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    paddingTop: 32,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textSecondary,
  },
});







