// app/(technician)/_layout.tsx
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";

export default function TechnicianLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/technician/notifications");
      if (response.data.data) {
        const unread = response.data.data.filter((n: any) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarSafeAreaInsets: { bottom: 0 },
      }}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tab_dashboard", "Dashboard"),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: t("tab_maintenance", "Maintenance"),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="clipboard-list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tab_notifications", "Notifications"),
          tabBarIcon: ({ color, size }) => (
            <View>
              <FontAwesome5 name="bell" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile", "Profile"),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user-alt" size={size} color={color} />
          ),
        }}
      />

      {/* ── Hidden screens (href: null = no tab bar entry) ── */}
      <Tabs.Screen name="ai-assistant"                              options={{ href: null }} />
      <Tabs.Screen name="audit-form/[siteId]"                      options={{ href: null }} />
      <Tabs.Screen name="create-visit"                             options={{ href: null }} />
      <Tabs.Screen name="hse-form/[siteId]"                        options={{ href: null }} />
      <Tabs.Screen name="install-part"                             options={{ href: null }} />
      <Tabs.Screen name="parts"                                    options={{ href: null }} />
      <Tabs.Screen name="request-part"                             options={{ href: null }} />
      <Tabs.Screen name="select-site"                              options={{ href: null }} />
      <Tabs.Screen name="select-site-audit"                        options={{ href: null }} />
      <Tabs.Screen name="select-site-hse"                          options={{ href: null }} />
      <Tabs.Screen name="task-detail"                              options={{ href: null }} />
      <Tabs.Screen name="tasks"                                    options={{ href: null }} />

      <Tabs.Screen name="maintenance-flow/activate-site"  options={{ href: null }} />
      <Tabs.Screen name="maintenance-flow/summary"        options={{ href: null }} />
      <Tabs.Screen name="maintenance-flow/checkout-site"  options={{ href: null }} />

      {/* Refueling screens */}
      <Tabs.Screen name="refueling/index"                          options={{ href: null }} />
      <Tabs.Screen name="refueling/select-site"                    options={{ href: null }} />
      <Tabs.Screen name="refueling/form"                           options={{ href: null }} />

      {/* Refueling flow screens — note: individual files, NOT a folder route */}
      <Tabs.Screen name="refueling-flow/activate-site"             options={{ href: null }} />
      <Tabs.Screen name="refueling-flow/activate-fuel-station"     options={{ href: null }} />
      <Tabs.Screen name="refueling-flow/check-in-site"             options={{ href: null }} />
      <Tabs.Screen name="refueling-flow/checkout-site"             options={{ href: null }} />
      <Tabs.Screen name="refueling-flow/summary"                   options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -6,
    top: -4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});



