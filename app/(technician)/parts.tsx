import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FontAwesome5 } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { Card } from "../../components/ui/Card";
import { cachedGet } from "../../services/offlineApi";
import { Part, PartRequest } from "../../types/parts.types";
import { ApiResponse } from "../../types/common.types";
import { format } from "date-fns";

type MainTab = "catalog" | "requests";
type RequestStatusTab = "pending" | "approved" | "rejected";

export default function PartsScreen() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<MainTab>("catalog");
  const [requestStatusTab, setRequestStatusTab] = useState<RequestStatusTab>("pending");
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (activeTab === "catalog") fetchParts();
    else fetchRequests();
  }, [activeTab]);

  const fetchParts = async () => {
    try {
      setLoading(true);
      // Cached so the catalog still browses offline (search is client-side
      // once loaded, so this only affects the initial params-based fetch).
      const { data: response, fromCache } = await cachedGet<ApiResponse<Part[]>>(
        "/parts",
        { search: searchQuery, status: "active" },
      );
      setIsOffline(fromCache);
      if (response.data) setParts(response.data);
    } catch (error) {
      console.error("Error fetching parts:", error);
      Alert.alert(t("error", "Error"), t("failed_load_parts", "Failed to load parts catalog"));
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data: response, fromCache } = await cachedGet<ApiResponse<PartRequest[]>>(
        "/parts/requests/my",
      );
      setIsOffline(fromCache);
      if (response.data) setRequests(response.data);
    } catch (error) {
      console.error("Error fetching requests:", error);
      Alert.alert(t("error", "Error"), t("failed_load_requests", "Failed to load request history"));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRequests = () => {
    if (!requests) return [];
    return requests.filter((req) => {
      const s = req.status.toLowerCase();
      if (requestStatusTab === "pending")
        return s === "pending" || s === "pending_approval" || s === "submitted";
      if (requestStatusTab === "approved") return s === "approved" || s === "assigned";
      if (requestStatusTab === "rejected") return s === "rejected";
      return false;
    });
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "approved":
      case "fulfilled": return Colors.success;
      case "pending":
      case "pending_approval":
      case "submitted": return Colors.warning;
      case "rejected": return Colors.danger;
      default: return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === "pending" || s === "pending_approval" || s === "submitted")
      return t("pending_approval", "Pending Approval");
    if (s === "approved") return t("approved", "Approved");
    if (s === "rejected") return t("rejected", "Rejected");
    if (s === "assigned") return t("assigned", "Assigned");
    if (s === "fulfilled") return t("fulfilled", "Fulfilled");
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getPriorityLabel = (urgency: string) => {
    const map: Record<string, string> = {
      high: t("high_priority", "High Priority"),
      medium: t("medium_priority", "Medium Priority"),
      low: t("low_priority", "Low Priority"),
    };
    return map[urgency] ?? urgency;
  };

  const renderPartItem = ({ item }: { item: Part }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.partName}>{item.name}</Text>
          <Text style={styles.partNumber}>{item.part_number}</Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
        <View
          style={[
            styles.stockBadge,
            {
              backgroundColor:
                (item.inventory?.stock || 0) > 0 ? "#E6FFFA" : "#FFF5F5",
            },
          ]}
        >
          <Text
            style={[
              styles.stockText,
              {
                color:
                  (item.inventory?.stock || 0) > 0 ? "#047857" : "#C53030",
              },
            ]}
          >
            {(item.inventory?.stock || 0) > 0
              ? t("in_stock", "In Stock")
              : t("out_of_stock", "Out of Stock")}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() =>
          router.push({
            pathname: "/(technician)/request-part",
            params: { partId: item._id, partName: item.name },
          })
        }
      >
        <Text style={styles.actionButtonText}>{t("request_part", "Request Part")}</Text>
      </TouchableOpacity>
    </Card>
  );

  const renderRequestItem = ({ item }: { item: PartRequest }) => {
    const s = item.status.toLowerCase();
    const isApproved = s === "approved" || s === "assigned";
    const firstItem =
      item.items && item.items.length > 0
        ? item.items[0]
        : { part_name: t("unknown_part", "Unknown Part"), quantity: 0 };
    const partName = firstItem.part_name || t("part_request", "Part Request");

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.partName}>{partName}</Text>
            <Text style={styles.partNumber}>
              {item.site_name || t("unknown_site", "Unknown Site")}
            </Text>
            <Text style={styles.category}>
              {t("requested", "Requested")}:{" "}
              {format(new Date(item.createdAt), "MMM dd, yyyy")}
            </Text>
            {item.urgency && (
              <Text
                style={[
                  styles.priorityText,
                  {
                    color:
                      item.urgency === "high"
                        ? "#C53030"
                        : item.urgency === "medium"
                          ? "#9C4221"
                          : "#0369A1",
                    marginTop: 4,
                  },
                ]}
              >
                {getPriorityLabel(item.urgency)}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) + "20" },
            ]}
          >
            <Text
              style={[styles.statusText, { color: getStatusColor(item.status) }]}
            >
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {isApproved ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.success, marginTop: 12 }]}
            onPress={() =>
              router.push({
                pathname: "/(technician)/install-part",
                params: {
                  requestId: item._id,
                  partName,
                  siteName: item.site_name || "",
                  approvalDate: item.updatedAt
                    ? format(new Date(item.updatedAt), "MMM dd, yyyy")
                    : "",
                  approvedBy: item.updatedBy_name || "",
                  isReplacement: "true",
                },
              })
            }
          >
            <Text style={styles.actionButtonText}>{t("install_part", "Install Part")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.outlineButton, { marginTop: 12 }]}
            onPress={() => {
              Alert.alert(
                t("details", "Details"),
                `${t("request_for", "Request for")} ${partName} x${firstItem.quantity || 1}\n${t("status", "Status")}: ${s}`,
              );
            }}
          >
            <Text style={[styles.actionButtonText, styles.outlineButtonText]}>
              {t("view_details", "View Details")}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("corrective_maintenance_title", "Corrective Maintenance")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <FontAwesome5 name="wifi" size={11} color="#92400E" />
          <Text style={styles.offlineBannerText}>Offline — showing last saved data</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Main tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "catalog" && styles.activeTab]}
            onPress={() => setActiveTab("catalog")}
          >
            <Text style={[styles.tabText, activeTab === "catalog" && styles.activeTabText]}>
              {t("available_parts", "Available Parts")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "requests" && styles.activeTab]}
            onPress={() => setActiveTab("requests")}
          >
            <Text style={[styles.tabText, activeTab === "requests" && styles.activeTabText]}>
              {t("my_requests", "My Requests")}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "catalog" && (
          <View style={styles.searchContainer}>
            <FontAwesome5
              name="search"
              size={16}
              color={Colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t("search_parts", "Search parts...")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => fetchParts()}
            />
          </View>
        )}

        {activeTab === "requests" && (
          <View style={styles.subTabs}>
            {(["pending", "approved", "rejected"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setRequestStatusTab(status)}
                style={[
                  styles.subTab,
                  requestStatusTab === status && styles.activeSubTab,
                ]}
              >
                <Text
                  style={[
                    styles.subTabText,
                    requestStatusTab === status && styles.activeSubTabText,
                  ]}
                >
                  {status === "pending"
                    ? t("pending", "Pending")
                    : status === "approved"
                      ? t("approved", "Approved")
                      : t("rejected", "Rejected")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.primary}
            style={styles.loader}
          />
        ) : (
          <FlatList
            data={activeTab === "catalog" ? parts : getFilteredRequests()}
            renderItem={
              activeTab === "catalog"
                ? (renderPartItem as any)
                : (renderRequestItem as any)
            }
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome5
                  name="box-open"
                  size={48}
                  color={Colors.textSecondary}
                />
                <Text style={styles.emptyText}>
                  {activeTab === "catalog"
                    ? t("no_parts_found", "No parts found")
                    : t("no_requests_found", "No requests found")}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  backButton: { padding: 4 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineBannerText: { color: "#92400E", fontSize: 12, fontWeight: "500" },
  content: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: "100%", color: Colors.text },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: "500" },
  activeTabText: { color: "#fff", fontWeight: "600" },
  subTabs: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  subTab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  activeSubTab: { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
  subTabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  activeSubTabText: { color: "#92400E" },
  list: { padding: 16, paddingTop: 0 },
  card: { padding: 16, marginBottom: 12 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardInfo: { flex: 1 },
  partName: { fontSize: 16, fontWeight: "600", color: Colors.text, marginBottom: 2 },
  partNumber: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  category: { fontSize: 13, color: Colors.textSecondary, fontStyle: "italic" },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  stockText: { fontSize: 12, fontWeight: "500" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  priorityText: { fontSize: 12, fontWeight: "500" },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outlineButtonText: { color: Colors.text },
  loader: { marginTop: 32 },
  emptyContainer: { alignItems: "center", marginTop: 48 },
  emptyText: { marginTop: 16, color: Colors.textSecondary, fontSize: 16 },
});







