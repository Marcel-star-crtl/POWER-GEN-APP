// app/(technician)/maintenance/[id].tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { api } from '../../../services/api';
import { ApiResponse } from '../../../types/common.types';
import { Maintenance } from '../../../types/maintenance.types';
import { Ionicons } from '@expo/vector-icons';

type InspectionItem = {
    id: string;
    type: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    status: 'completed' | 'pending';
};

const INITIAL_INSPECTIONS: InspectionItem[] = [
    { id: '1', type: 'generator', title: 'Generator', icon: 'flash', status: 'pending' },
    { id: '2', type: 'power_cabinet', title: 'Power Cabinet', icon: 'plug', status: 'pending' },
    { id: '3', type: 'grid', title: 'Grid', icon: 'battery-charging', status: 'pending' },
    { id: '4', type: 'shelter', title: 'Shelter', icon: 'home', status: 'completed' }, // Mocking one as completed
    { id: '5', type: 'fuel_tank', title: 'Fuel Tank', icon: 'water', status: 'pending' },
    { id: '6', type: 'cleaning', title: 'Site Cleaning', icon: 'brush', status: 'pending' },
];

export default function MaintenanceChecklist() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [task, setTask] = useState<Maintenance | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Local state to track progress for this session
  const [inspections, setInspections] = useState<InspectionItem[]>(INITIAL_INSPECTIONS);

  useEffect(() => {
    const fetchTaskDetails = async () => {
        try {
          const response = await api.get<ApiResponse<Maintenance>>(`/maintenance/${id}`);
          if (response.data.data) {
            setTask(response.data.data);
          } else {
             // Mock fallback
             setTask({
                 _id: id as string,
                 site_name: 'Victoria Island Site A',
                 site_id: 'VI-001',
                 visit_date: new Date(),
             } as any);
          }
        } catch (error) {
           // Mock fallback on error
           setTask({
                _id: id as string,
                site_name: 'Victoria Island Site A',
                site_id: 'VI-001',
                visit_date: new Date(),
           } as any);
        } finally {
          setLoading(false);
        }
    };

    if (id) fetchTaskDetails();
  }, [id]);

  const completedCount = inspections.filter(i => i.status === 'completed').length;
  const progress = completedCount / inspections.length;
  const percentage = Math.round(progress * 100);

  const handleNavigate = (type: string) => {
      router.push(`/maintenance/equipment/${type}?id=${id}`);
  };

  if (loading) {
      return (
          <SafeAreaView style={styles.container}>
              <Text style={{padding: 20}}>Loading...</Text>
          </SafeAreaView>
      )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header Overrides Default */}
      <Stack.Screen options={{ title: task?.site_name || 'Maintenance', headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>{task?.site_name || 'Site Name'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Info Card */}
        <View style={styles.infoCard}>
            <View style={styles.infoRow}>
                <View>
                    <Text style={styles.infoLabel}>Site ID</Text>
                    <Text style={styles.infoValue}>{task?.site_id || 'N/A'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.infoLabel}>Last Visit</Text>
                    <Text style={styles.infoValue}>
                        {/* Mocking last visit as 1 month ago */}
                        {new Date(Date.now() - 2592000000).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                    <Text style={styles.progressText}>Progress: {completedCount}/{inspections.length} completed</Text>
                    <Text style={styles.percentageText}>{percentage}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
                </View>
            </View>
        </View>

        {/* Checklist Grid/List */}
        <View style={styles.grid}>
            {inspections.map((item) => (
                <TouchableOpacity 
                    key={item.id} 
                    style={styles.card}
                    onPress={() => handleNavigate(item.type)}
                >
                    <View style={styles.cardIconContainer}>
                        <Ionicons 
                            name={item.icon} 
                            size={28} 
                            color={item.status === 'completed' ? Colors.success : Colors.primary} 
                        />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <View style={[
                            styles.statusBadge, 
                            item.status === 'completed' ? styles.statusSuccess : styles.statusPending
                        ]}>
                            <Text style={[
                                styles.statusText,
                                item.status === 'completed' ? styles.textSuccess : styles.textPending
                            ]}>
                                {item.status === 'completed' ? 'Completed' : 'Not started'}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.text,
      marginLeft: 4,
  },
  content: {
      padding: 16,
  },
  infoCard: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
  },
  infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
  },
  infoLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 4,
  },
  infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
  },
  progressSection: {
      marginTop: 8,
  },
  progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
  },
  progressText: {
      fontSize: 13,
      color: Colors.textSecondary,
  },
  percentageText: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.primary,
  },
  progressBarBg: {
      height: 8,
      backgroundColor: Colors.lightGray,
      borderRadius: 4,
      overflow: 'hidden',
  },
  progressBarFill: {
      height: '100%',
      backgroundColor: Colors.primary,
      borderRadius: 4,
  },
  grid: {
      gap: 12,
  },
  card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
  },
  cardIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.lightGray,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
  },
  cardContent: {
      flex: 1,
  },
  cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
      marginBottom: 4,
  },
  statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
  },
  statusPending: {
      backgroundColor: '#F1F5F9', // slate-100
  },
  statusSuccess: {
      backgroundColor: '#DCFCE7', // green-100
  },
  statusText: {
      fontSize: 12,
      fontWeight: '500',
  },
  textPending: {
      color: Colors.textSecondary,
  },
  textSuccess: {
      color: Colors.success,
  }
});
