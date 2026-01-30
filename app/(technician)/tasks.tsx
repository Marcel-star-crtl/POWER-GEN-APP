import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';

// Define Task Interface
interface TaskItem {
  id: string; // maintenanceId or composite key
  siteId: string;
  siteName: string; // might need to fetch or cache
  type: string; // 'Preventive' | 'Corrective' etc.
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Pending';
  date: string;
  checkCount?: number;
}

export default function Tasks() {
  const [activeTab, setActiveTab] = useState<'drafts' | 'submitted'>('submitted');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const allDrafts: TaskItem[] = [];

      // 1. Fetch Drafts from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const draftKeys = keys.filter(k => k.startsWith('draft_'));
      
      // Group drafts by maintenanceId/siteId
      // Key format: draft_${type}_${siteId}_${maintenanceId}
      const draftGroups: {[key: string]: {siteId: string, maintenanceId: string, types: Set<string>}} = {};
      
      for (const key of draftKeys) {
        const parts = key.split('_'); 
        // parts[0] = draft
        // parts[1] = type (generator, cleaning, etc.)
        // parts[2] = siteId
        // parts[3] = maintenanceId (or 'adhoc')
        
        if (parts.length >= 4) {
            const type = parts[1];
            const siteId = parts[2];
            const maintenanceId = parts[3];
            const groupKey = `${siteId}_${maintenanceId}`;
            
            if (!draftGroups[groupKey]) {
                draftGroups[groupKey] = { siteId, maintenanceId, types: new Set() };
            }
            draftGroups[groupKey].types.add(type);
        }
      }

      // Convert groups to TaskItems
      Object.values(draftGroups).forEach(group => {
           allDrafts.push({
               id: group.maintenanceId,
               siteId: group.siteId,
               siteName: `Site ${group.siteId}`, // Placeholder
               type: 'Preventive', // Infer or generic
               status: 'Draft',
               date: new Date().toISOString(), 
               checkCount: group.types.size
           });
      });

      // 2. Fetch Submitted from API
      if (activeTab === 'submitted') {
          try {
             // Reusing the endpoint from original tasks.tsx but assuming it returns user tasks
             const response = await api.get('/technician/maintenance/assigned?status=completed,pending_approval,approved,rejected');
             if (response.data.data) {
                 const serverTasks = response.data.data.map((m: any) => ({
                     id: m.maintenance_id,
                     siteId: m.site_id,
                     siteName: m.site_name || `Site ${m.site_id}`,
                     type: m.type || 'Maintenance',
                     status: m.status === 'pending_approval' ? 'Pending' : (m.status === 'completed' ? 'Submitted' : (m.status.charAt(0).toUpperCase() + m.status.slice(1))), // Map to UI status
                     date: m.scheduled_date || m.created_at,
                     checkCount: 0 
                 }));
                 setTasks(serverTasks);
             } else {
                 setTasks([]);
             }
          } catch (e) {
              console.error('Fetch server tasks failed', e);
          }
      } else {
          // If drafts tab, show drafts
          setTasks(allDrafts);
      }

    } catch (e) {
      console.error('Error loading tasks', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handlePressTask = (task: TaskItem) => {
      if (task.status === 'Draft') {
          // Open Checklist in Draft Mode
          router.push({
              pathname: '/(technician)/maintenance/checklist',
              params: { siteId: task.siteId, siteName: task.siteName, type: 'preventive', maintenanceId: task.id === 'adhoc' ? '' : task.id }
          });
      } else {
          // Open Submitted View (Read Only or Status)
          // Could reuse checklist with a 'readOnly' param or similar
           router.push({
              pathname: '/(technician)/maintenance/checklist',
              params: { siteId: task.siteId, siteName: task.siteName, type: 'preventive', maintenanceId: task.id, readOnly: 'true' }
          });
      }
  };

  const renderItem = ({ item }: { item: TaskItem }) => (
    <TouchableOpacity onPress={() => handlePressTask(item)}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
             <View style={[styles.iconContainer, { backgroundColor: item.status === 'Draft' ? Colors.warning + '20' : Colors.success + '20' }]}>
                <FontAwesome5 
                    name={item.status === 'Draft' ? 'edit' : 'check-circle'} 
                    size={16} 
                    color={item.status === 'Draft' ? Colors.warning : Colors.success} 
                />
             </View>
             <View>
                 <Text style={styles.siteName}>{item.siteName}</Text>
                 <Text style={styles.taskType}>{item.type}</Text>
             </View>
          </View>
          <View style={[styles.statusBadge, { 
              backgroundColor: item.status === 'Draft' ? Colors.warning : 
                             item.status === 'Approved' ? Colors.success : 
                             item.status === 'Rejected' ? Colors.error : Colors.primary 
          }]}>
             <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
             <Text style={styles.dateText}>
                 <FontAwesome5 name="calendar-alt" size={12} /> {new Date(item.date).toLocaleDateString()}
             </Text>
             {item.status === 'Draft' && (
                 <Text style={styles.draftInfo}>{item.checkCount} checks started</Text>
             )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay visible={loading && !refreshing} />
      
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
            style={[styles.tab, activeTab === 'submitted' && styles.activeTab]}
            onPress={() => setActiveTab('submitted')}
        >
            <Text style={[styles.tabText, activeTab === 'submitted' && styles.activeTabText]}>Submitted</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            style={[styles.tab, activeTab === 'drafts' && styles.activeTab]}
            onPress={() => setActiveTab('drafts')}
        >
            <Text style={[styles.tabText, activeTab === 'drafts' && styles.activeTabText]}>Drafts</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => `${item.id}_${item.status}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="clipboard-list" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No {activeTab} tasks found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    marginRight: 24,
    paddingBottom: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1, 
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderRadius: 8
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  iconContainer: {
     width: 32,
     height: 32,
     borderRadius: 16,
     alignItems: 'center',
     justifyContent: 'center',
     marginRight: 12,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  taskType: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  draftInfo: {
      fontSize: 12,
      color: Colors.warning,
      fontWeight: '500', 
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    marginTop: 16,
    color: Colors.textSecondary,
    fontSize: 16,
  }
});
