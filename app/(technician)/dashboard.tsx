import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { ApiResponse } from '../../types/common.types';
import { Button } from '../../components/ui/Button';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { router } from 'expo-router';

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>Here's your activity overview</Text>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.pendingTasks || 0}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.scheduledTasks || 0}</Text>
            <Text style={styles.statLabel}>Scheduled</Text>
          </Card>
        </View>
        
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
             <Text style={[styles.statValue, { color: Colors.primary }]}>{stats?.inProgressTasks || 0}</Text>
             <Text style={styles.statLabel}>In Progress</Text>
           </Card>
           <Card style={styles.statCard}>
             <Text style={[styles.statValue, { color: Colors.success }]}>{stats?.completedThisMonth || 0}</Text>
             <Text style={styles.statLabel}>Completed (Month)</Text>
           </Card>
        </View>

        <View style={styles.actions}>
            <Button onPress={() => router.push('/(technician)/tasks')} style={styles.actionButton}>View All Tasks</Button>
            <Button 
              onPress={() => router.push('/(technician)/parts')} 
              variant="outline"
              style={styles.actionButton}
            >
              Parts & Inventory
            </Button>
        </View>

      </ScrollView>
      
      <FloatingActionButton 
        onPress={() => router.push('/(technician)/create-visit')}
        icon="plus"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 24,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    width: '100%',
  }
});
