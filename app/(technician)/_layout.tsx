import { Tabs } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { api } from '../../services/api';

export default function TechnicianLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/technician/notifications');
      if (response.data.data) {
        const unread = response.data.data.filter((n: any) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
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
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="tasks" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <View>
              <FontAwesome5 name="bell" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
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
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user-alt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="ai-assistant" options={{ href: null }} />
      <Tabs.Screen name="create-visit" options={{ href: null }} />
      <Tabs.Screen name="install-part" options={{ href: null }} />
      <Tabs.Screen name="parts" options={{ href: null }} />
      <Tabs.Screen name="request-part" options={{ href: null }} />
      <Tabs.Screen name="select-site" options={{ href: null }} />
      <Tabs.Screen name="task-detail" options={{ href: null }} />
      <Tabs.Screen name="maintenance" options={{ href: null }} />
      <Tabs.Screen name="maintenance/index" options={{ href: null }} />
      <Tabs.Screen name="maintenance/equipment" options={{ href: null }} />
      <Tabs.Screen name="maintenance/equipment/[type]" options={{ href: null }} />
      <Tabs.Screen name="maintenance/[id]" options={{ href: null }} />
      <Tabs.Screen name="refueling" options={{ href: null }} />
      <Tabs.Screen name="refueling/index" options={{ href: null }} />
      <Tabs.Screen name="refueling/form" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
