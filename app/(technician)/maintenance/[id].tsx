// app/(technician)/maintenance/[id].tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { api } from '../../../services/api';
import { ApiResponse } from '../../../types/common.types';
import { Maintenance } from '../../../types/maintenance.types';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

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
  const [submitting, setSubmitting] = useState(false);
  
  // Local state to track progress for this session
  const [inspections, setInspections] = useState<InspectionItem[]>(INITIAL_INSPECTIONS);

  const loadTaskAndProgress = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<Maintenance>>(`/technician/maintenance/${id}`);
      if (response.data.data) {
        const taskData = response.data.data;
        setTask(taskData);
        
        // Update inspections status
        const updatedInspections = INITIAL_INSPECTIONS.map(item => {
          // Check if the equipment check has actual data AND check status
          let isCompleted = false;
          
          if (item.type === 'generator') {
            const genChecks = taskData.equipment_checks?.generator_checks;
            const hasData = Array.isArray(genChecks) && genChecks.length > 0 && genChecks[0]?.batteryStatus !== undefined;
            const isApproved = genChecks && genChecks[0]?.status === 'approved';
            isCompleted = hasData && (isApproved || genChecks[0]?.status === 'pending_approval');
          } else if (item.type === 'cleaning') {
            const cleanChecks = taskData.equipment_checks?.cleaning_checks;
            const hasData = cleanChecks && (
              cleanChecks.isClean !== undefined || 
              cleanChecks.spillage !== undefined ||
              cleanChecks.securityLight !== undefined
            );
            const isApproved = cleanChecks?.check_status === 'approved';
            isCompleted = hasData && (isApproved || cleanChecks?.check_status === 'pending_approval');
          } else if (item.type === 'grid') {
            const gridChecks = taskData.equipment_checks?.grid_checks;
            const hasData = gridChecks && (
              gridChecks.gridStatus !== undefined || 
              gridChecks.breakerStatus !== undefined
            );
            const isApproved = gridChecks?.check_status === 'approved';
            isCompleted = hasData && (isApproved || gridChecks?.check_status === 'pending_approval');
          } else if (item.type === 'shelter') {
            const shelterChecks = taskData.equipment_checks?.shelter_checks;
            const hasData = shelterChecks && (
              shelterChecks.shelterStatus !== undefined ||
              shelterChecks.doorStatus !== undefined
            );
            const isApproved = shelterChecks?.check_status === 'approved';
            isCompleted = hasData && (isApproved || shelterChecks?.check_status === 'pending_approval');
          } else if (item.type === 'fuel_tank') {
            const fuelChecks = taskData.equipment_checks?.fuel_tank_checks;
            const hasData = fuelChecks && (
              fuelChecks.tankStatus !== undefined ||
              fuelChecks.waterInTank !== undefined
            );
            const isApproved = fuelChecks?.check_status === 'approved';
            isCompleted = hasData && (isApproved || fuelChecks?.check_status === 'pending_approval');
          } else if (item.type === 'power_cabinet') {
            const cabinetChecks = taskData.equipment_checks?.power_cabinet_checks;
            const hasData = Array.isArray(cabinetChecks) && cabinetChecks.length > 0;
            const isApproved = cabinetChecks && cabinetChecks[0]?.status === 'approved';
            isCompleted = hasData && (isApproved || cabinetChecks[0]?.status === 'pending_approval');
          }
                              
          return {
            ...item,
            status: isCompleted ? 'completed' : 'pending'
          };
        });
        setInspections(updatedInspections);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      Alert.alert('Error', 'Failed to load maintenance task');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaskAndProgress();
  }, [id]);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadTaskAndProgress();
    }, [id])
  );

  const completedCount = inspections.filter(i => i.status === 'completed').length;
  const progress = completedCount / inspections.length;
  const percentage = Math.round(progress * 100);

  const handleNavigate = (type: string) => {
      router.push(`/(technician)/maintenance/equipment/${type}?id=${id}&siteId=${task?.site_id || ''}&siteName=${task?.site_name || ''}`);
  };

  const handleSubmitForApproval = async () => {
    if (!task || !id) return;

    // Check if all required checks are completed
    const allCompleted = inspections.every(i => i.status === 'completed');
    if (!allCompleted) {
      Alert.alert(
        'Incomplete Checks',
        'Please complete all required equipment checks before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Submit for Approval',
      'Are you sure you want to submit this maintenance for supervisor approval?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setSubmitting(true);
              console.log('🚀 SUBMITTING maintenance for approval:', id);
              console.log('📝 Work performed:', `Completed ${inspections.length} equipment checks`);
              
              const response = await api.post(`/technician/maintenance/${id}/submit`, {
                work_performed: `Completed ${inspections.length} equipment checks`
              });
              
              console.log('✅ Submit response:', response.data);
              console.log('📊 New status:', response.data?.data?.status);
              
              Alert.alert(
                'Success',
                'Maintenance submitted for approval!',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              console.error('❌ Error submitting:', error);
              console.error('Response data:', error.response?.data);
              Alert.alert('Error', error.response?.data?.message || 'Failed to submit maintenance');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
      return (
          <SafeAreaView style={styles.container}>
              <ActivityIndicator size="large" color={Colors.primary} style={{marginTop: 40}} />
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

        {/* Submit for Approval Button */}
        {inspections.every(i => i.status === 'completed') && task?.status === 'in_progress' && (
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleSubmitForApproval}
            disabled={submitting}
          >
            <Ionicons name="checkmark-circle" size={24} color="white" />
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </Text>
          </TouchableOpacity>
        )}

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
  },
  submitButton: {
      backgroundColor: Colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 24,
      gap: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
  },
  submitButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
  }
});
