import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { ApiResponse } from '../../types/common.types';
import { router } from 'expo-router';
import { SummaryCard } from '../../components/SummaryCard';
import { QuickActionCard } from '../../components/QuickActionCard';
import { ActiveVisitCard } from '../../components/ActiveVisitCard';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';

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

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      // Short preview of logic - kept original logic
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.get<ApiResponse<DashboardStats>>('/technician/dashboard/me');

      // Fetch active visit
      try {
          const visitRes = await api.get('/technician/visit/current');
          if (visitRes.data.success) {
            setActiveVisit(visitRes.data.data);
          } else {
            setActiveVisit(null);
          }
      } catch (error) {
           // 404 or other error typically means no active visit
           setActiveVisit(null);
      }

      console.log('📊 Dashboard Response:', JSON.stringify(response.data, null, 2));
      if (response.data.data) {
        // Calculate aggregations if backend doesn't provide them yet
        const data = response.data.data;
        if (data.actionCounts) {
           const counts = data.actionCounts;
           // Aggregate for Preventive if not present
           if (counts.preventive === undefined) {
             counts.preventive = (counts.generator || 0) + (counts.cleaning || 0) + (counts.power_cabinet || 0) + (counts.grid || 0) + (counts.shelter || 0);
           }
           // Use raw fuel_refill for refueling if not present
           if (counts.refueling === undefined) {
             counts.refueling = counts.fuel_refill || 0;
           }
           // Corrective is pending - use 0 or some other metric if available, for now 0 is safe
           if (counts.corrective === undefined) {
             counts.corrective = 0; // Needs backend support
           }
        }
        setStats(data);
      }
    } catch (error: any) {
      console.error('Fetch dashboard error', error);
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

  const navigateToSiteSelection = (type: string) => {
    // Corrective maintenance goes directly to parts (no assignment required)
    if (type === 'corrective') {
      router.push({ pathname: '/(technician)/parts' });
      return;
    }

    router.push({
      pathname: '/(technician)/select-site',
      params: { requiredAction: type }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
       <LoadingOverlay visible={loading} />
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

        {/* Active Visit Section */}
        {activeVisit ? (
            <ActiveVisitCard 
                visit={activeVisit} 
                onCheckOut={() => {
                    setActiveVisit(null);
                    fetchDashboard();
                }} 
            />
        ) : (
             <TouchableOpacity 
                style={styles.checkInButton}
                onPress={() => navigateToSiteSelection('check-in')}
             >
                <View style={styles.checkInIconContainer}>
                    <Ionicons name="location" size={24} color={Colors.white} />
                </View>
                <View>
                    <Text style={styles.checkInTitle}>Start Site Visit</Text>
                    <Text style={styles.checkInSubtitle}>Check in to begin work</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.white} style={{ marginLeft: 'auto' }} />
             </TouchableOpacity>
        )}

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

        {/* Quick Actions Section (Updated) */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        
        <View style={styles.actionsContainer}>
          <QuickActionCard
            title="PREVENTIVE MAINTENANCE"
            subtitle="Scheduled Checks"
            badgeText={stats?.actionCounts?.preventive ? `${stats.actionCounts.preventive} Assigned` : "0 Assigned"}
            icon="clipboard-check"
            color={Colors.primary}
            onPress={() => navigateToSiteSelection('preventive')}
          />
          <QuickActionCard
            title="REFUELING MANAGEMENT"
            subtitle="Fuel Log & Tank Level"
            badgeText={stats?.actionCounts?.refueling ? `${stats.actionCounts.refueling} Assigned` : "0 Assigned"}
            icon="water"
            color={Colors.warning}
            onPress={() => router.push('/(technician)/refueling')}
          />
           <QuickActionCard
            title="CORRECTIVE MAINTENANCE"
            subtitle="Repairs & Issues"
            badgeText={stats?.actionCounts?.corrective ? `${stats.actionCounts.corrective} Assigned` : "0 Assigned"}
            icon="construct"
            color={Colors.error}
            onPress={() => navigateToSiteSelection('corrective')}
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
  actionsContainer: {
    marginBottom: 24,
  },
  checkInButton: {
    backgroundColor: Colors.success, // Use success green for starting
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  checkInTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  checkInSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
});
