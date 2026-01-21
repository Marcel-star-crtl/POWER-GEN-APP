import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { ApiResponse } from '../../types/common.types';
import { router } from 'expo-router';
import { SummaryCard } from '../../components/SummaryCard';
import { ActivityCard } from '../../components/ActivityCard';

 interface DashboardStats {
  pendingTasks: number;
  scheduledTasks: number;
  inProgressTasks: number;
  completedThisMonth: number;
  totalCompleted: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      console.log('📊 Fetching dashboard...');
      const token = await AsyncStorage.getItem('accessToken');
      console.log('🔑 Token exists:', !!token);
      if (token) {
        console.log('🔑 Token preview:', token.substring(0, 20) + '...');
      }
      
      const response = await api.get<ApiResponse<DashboardStats>>('/technician/dashboard/me');
      console.log('✅ Dashboard response:', response.data);
      if (response.data.data) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch dashboard:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <SafeAreaView style={styles.container}>
       <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi, {user?.fullName?.split(' ')[0]}</Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>

        {/* Summary Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Summary</Text>
        </View>
        <View style={styles.summaryContainer}>
          <SummaryCard 
            label="Pending" 
            count={stats?.pendingTasks || 0} 
            type="pending" 
            style={{ flex: 1, marginRight: 8 }}
          />
          <SummaryCard 
            label="In Progress" 
            count={stats?.inProgressTasks || 0} 
            type="neutral" 
            style={{ flex: 1, marginRight: 8 }}
          />
           <SummaryCard 
            label="Completed" 
            count={stats?.completedThisMonth || 0} 
            type="completed" 
            style={{ flex: 1 }}
          />
        </View>

        {/* Activity Section */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Activity</Text>
        </View>
        
        <View style={styles.activityList}>
            <ActivityCard 
                title="Preventive Maintenance" 
                subtitle="Routine checks and service schedules"
                iconName="tools" 
                iconColor={Colors.primary}
                onPress={() => router.push('/(technician)/maintenance')} 
            />
            <ActivityCard 
                title="Corrective Maintenance" 
                subtitle="Report and fix unexpected issues"
                iconName="wrench" 
                iconColor={Colors.warning}
                onPress={() => router.push('/(technician)/parts')} 
            />
            <ActivityCard 
                title="Refueling Management" 
                subtitle="Log fuel levels and requests"
                iconName="gas-pump" 
                iconColor={Colors.secondary}
                onPress={() => router.push('/(technician)/refueling')} 
            />
            <ActivityCard 
                title="Parts Request" 
                subtitle="Order new parts and inventory"
                iconName="cogs" 
                iconColor={Colors.secondary}
                onPress={() => router.push('/(technician)/parts')} 
            />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  activityList: {
    gap: 4
  }
});
