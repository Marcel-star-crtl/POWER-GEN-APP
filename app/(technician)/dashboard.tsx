import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { QuickActionCard } from "../../components/QuickActionCard";
import { SummaryCard } from "../../components/SummaryCard";
import { LoadingOverlay } from "../../components/ui/LoadingOverlay";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { ApiResponse } from "../../types/common.types";
// import { isRestrictedAcScopeRole } from "../../utils/roles";
import { isFuelRole, isRestrictedAcScopeRole } from "../../utils/roles";

interface DashboardStats {
  pendingTasks: number;
  scheduledTasks: number;
  inProgressTasks: number;
  completedThisMonth: number;
  totalCompleted: number;
  actionCounts?: {
    generator: number;
    fuel_refill: number;
    cleaning: number;
    power_cabinet: number;
    grid: number;
    shelter: number;
    preventive?: number;
    corrective?: number;
    refueling?: number;
  };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function TechnicianDashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isAcTechnician = isRestrictedAcScopeRole(user?.role);
  const isFuelTechnician = isFuelRole(user?.role);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const syncOfflineVisits = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter((k) => k.startsWith("offline_visit_"));

      for (const key of offlineKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        let record: any = null;
        try {
          record = JSON.parse(raw);
        } catch {
          continue;
        }

        if (!record?.siteId) continue;

        const formData = new FormData();
        if (record.fields?.Actual_Date_Visit) {
          formData.append("Actual_Date_Visit", record.fields.Actual_Date_Visit);
        }
        if (record.fields?.Type_of_Visit) {
          formData.append("Type_of_Visit", record.fields.Type_of_Visit);
        }
        if (record.fields?.technician_id) {
          formData.append("technician_id", record.fields.technician_id);
        }
        formData.append("submit_type", record.submit_type || "draft");

        if (record.fields?.hours_on_site) {
          formData.append("hours_on_site", record.fields.hours_on_site);
        }
        if (record.fields?.work_performed) {
          formData.append("work_performed", record.fields.work_performed);
        }
        if (record.fields?.generators_checked) {
          formData.append(
            "generators_checked",
            JSON.stringify(record.fields.generators_checked),
          );
        }
        if (record.fields?.fuel_data) {
          formData.append("fuel_data", JSON.stringify(record.fields.fuel_data));
        }
        if (record.fields?.electrical_data) {
          formData.append(
            "electrical_data",
            JSON.stringify(record.fields.electrical_data),
          );
        }
        if (record.fields?.Issues_Found) {
          formData.append(
            "Issues_Found",
            JSON.stringify(record.fields.Issues_Found),
          );
        }

        (record.photos || []).forEach((photo: any, index: number) => {
          formData.append("photos", {
            uri: photo.uri,
            name: `offline_${index}.jpg`,
            type: "image/jpeg",
          } as any);
        });

        try {
          await api.post(`/sites/${record.siteId}/visit`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          await AsyncStorage.removeItem(key);
        } catch (err: any) {
          if (!err?.response) {
            break;
          }
        }
      }
    } catch (error) {
      console.error("Offline visit sync failed:", error);
    }
  };

  const fetchDashboard = async () => {
    try {
      await syncOfflineVisits();
      const response = await api.get<ApiResponse<DashboardStats>>(
        "/technician/dashboard/me",
      );

      // Fetch daily attendance
      try {
        const attendanceRes = await api.get("/technician/daily-status");
        if (attendanceRes.data.success && attendanceRes.data.checkedIn) {
          setDailyAttendance(attendanceRes.data.data);
        } else {
          setDailyAttendance(null);
        }
      } catch {
        setDailyAttendance(null);
      }

      console.log(
        "📊 Dashboard Response:",
        JSON.stringify(response.data, null, 2),
      );

      if (response.data.data) {
        const data = response.data.data;
        if (data.actionCounts) {
          const counts = data.actionCounts;
          if (counts.preventive === undefined) {
            counts.preventive =
              (counts.generator || 0) +
              (counts.cleaning || 0) +
              (counts.power_cabinet || 0) +
              (counts.grid || 0) +
              (counts.shelter || 0);
          }
          if (counts.refueling === undefined) {
            counts.refueling = counts.fuel_refill || 0;
          }
          if (counts.corrective === undefined) {
            counts.corrective = 0;
          }
          // if (isAcTechnician) {
          //   counts.preventive = (counts.cleaning || 0) + (counts.shelter || 0);
          //   counts.refueling = 0;
          //   counts.corrective = 0;
          // }
          // if (isFuelTechnician) {
          //   counts.preventive = 0;
          //   counts.corrective = 0;
          //   // refueling stays as-is
          // }
          if (isAcTechnician) {
            counts.preventive = (counts.cleaning || 0) + (counts.shelter || 0);
            counts.refueling = 0;
            counts.corrective = 0;
          }
          if (isFuelTechnician) {
            counts.preventive = counts.fuel_refill || 0;
            counts.corrective = 0;
          }
        }
        setStats(data);
      }
    } catch (error: any) {
      console.error("Fetch dashboard error", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString(
    i18n.language === "fr" ? "fr-FR" : "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const res = await api.post("/technician/daily-check-in", {});
      if (res.data.success) {
        setDailyAttendance(res.data.data);
        alert("Checked in successfully!");
        fetchDashboard();
      }
    } catch (error) {
      console.error("Check in failed", error);
      alert("Check in failed");
    } finally {
      setLoading(false);
    }
  };

  const navigateToSiteSelection = (type: string) => {
    if (type === "corrective") {
      router.push({ pathname: "/(technician)/parts" });
      return;
    }
    router.push({
      pathname: "/(technician)/select-site",
      params: { requiredAction: type },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LanguageSwitcher />
      <LoadingOverlay visible={loading} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {t("hi")}, {user?.fullName?.split(" ")[0]}
            </Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>

        {/* Daily Attendance Section */}
        {dailyAttendance ? (
          <View
            style={{
              backgroundColor: Colors.surface,
              padding: 16,
              borderRadius: 12,
              marginBottom: 20,
              elevation: 2,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={Colors.success}
              />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 18,
                  fontWeight: "bold",
                  color: Colors.text,
                }}
              >
                {t("checked_in")}
              </Text>
            </View>
            <Text style={{ color: Colors.textSecondary }}>
              {t("checked_in_for_today_at", {
                time: new Date(dailyAttendance.checkInTime).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                ),
              })}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={handleCheckIn}
          >
            <View style={styles.checkInIconContainer}>
              <Ionicons name="location" size={24} color={Colors.surface} />
            </View>
            <View>
              <Text style={styles.checkInTitle}>{t("check_in_for_today")}</Text>
              <Text style={styles.checkInSubtitle}>
                {t("tap_to_mark_attendance")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={Colors.surface}
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
        )}

        {/* Summary Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("todays_summary")}</Text>
        </View>
        <View style={styles.summaryContainer}>
          {/* <SummaryCard
            label={"pending"}
            count={stats?.pendingTasks || 0}
            type="pending"
            style={{ flex: 1, marginRight: 8 }}
          /> */}
          <SummaryCard
            label={"scheduled"}
            count={stats?.scheduledTasks || 0}
            type="neutral"
            style={{ flex: 1, marginRight: 8 }}
          />
          <SummaryCard
            label={"in_progress"}
            count={stats?.inProgressTasks || 0}
            type="neutral"
            style={{ flex: 1, marginRight: 8 }}
          />
          {/* <SummaryCard
            label={"approved"}
            count={stats?.approvedTasks || 0}
            type="neutral"
            style={{ flex: 1, marginRight: 8 }}
          />
          <SummaryCard
            label={"draft"}
            count={stats?.draftTasks || 0}
            type="neutral"
            style={{ flex: 1, marginRight: 8 }}
          /> */}
          <SummaryCard
            label={"completed"}
            count={stats?.completedTasks || 0}
            type="completed"
            style={{ flex: 1 }}
          />
        </View>

        {/* Quick Actions Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("quick_actions")}</Text>
        </View>

        <View style={styles.actionsContainer}>
          <QuickActionCard
            title={"sync_now"}
            subtitle={"upload_offline_visits"}
            badgeText={"manual_sync"}
            icon="cloud-upload"
            color={Colors.success}
            onPress={async () => {
              await syncOfflineVisits();
              await fetchDashboard();
            }}
          />
          {!isFuelTechnician && (
            <QuickActionCard
              title={"preventive_maintenance"}
              subtitle={"scheduled_checks"}
              badgeText={{
                key: "assigned_count",
                count: stats?.actionCounts?.preventive || 0,
              }}
              icon="clipboard-check"
              color={Colors.primary}
              onPress={() => navigateToSiteSelection("preventive")}
            />
          )}
          {!isAcTechnician && (
            <QuickActionCard
              title={"refueling_management"}
              subtitle={"fuel_log_tank_level"}
              badgeText={{
                key: "assigned_count",
                count: stats?.actionCounts?.refueling || 0,
              }}
              icon="water"
              color={Colors.warning}
              onPress={() => router.push("/(technician)/refueling")}
            />
          )}
          {!isAcTechnician && !isFuelTechnician && (
            <QuickActionCard
              title={"corrective_maintenance"}
              subtitle={"repairs_issues"}
              badgeText={{
                key: "assigned_count",
                count: stats?.actionCounts?.corrective || 0,
              }}
              icon="construct"
              color={Colors.error}
              onPress={() => navigateToSiteSelection("corrective")}
            />
          )}
          {!isFuelTechnician && (
            <QuickActionCard
              title={"site_audit"}
              subtitle={"audit_a_site"}
              badgeText={"new"}
              icon="search"
              color={Colors.warning}
              onPress={() => router.push("/(technician)/select-site-audit")}
            />
          )}
          {/* HSE Inspection — hidden for Fuel users */}
          {!isFuelTechnician && (
            <QuickActionCard
              title={"hse_inspection"}
              subtitle={"site_integrity_checklist"}
              badgeText={"hse"}
              icon="shield-checkmark"
              color="#c0392b"
              onPress={() => router.push("/(technician)/select-site-hse")}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  checkInButton: {
    backgroundColor: Colors.success,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkInIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  checkInTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.surface,
    marginBottom: 4,
  },
  checkInSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
});
