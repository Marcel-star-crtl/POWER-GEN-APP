import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../services/api';
import { ApiResponse } from '../../types/common.types';
import { Maintenance } from '../../types/maintenance.types';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { FontAwesome5 } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function TasksList() {
  const [tasks, setTasks] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state could be added here (pending vs completed, etc)

  const fetchTasks = async () => {
    try {
      // Fetch technician tasks (unified tasks/visits)
      const response = await api.get<ApiResponse<Maintenance[]>>('/technician/maintenance/tasks');
      if (response.data.data) {
        setTasks(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'completed': return Colors.success;
      case 'rejected': return Colors.danger;
      case 'pending_approval': return Colors.warning;
      case 'in_progress': return Colors.primary;
      case 'scheduled': return '#6366f1'; // indigo
      default: return Colors.textSecondary;
    }
  };

  const handleTaskPress = (task: Maintenance) => {
    console.log('Navigating to task detail:', task._id);
    router.push({
      pathname: '/(technician)/task-detail',
      params: { id: task._id },
    });
  };

  const renderItem = ({ item }: { item: Maintenance }) => (
    <TouchableOpacity onPress={() => handleTaskPress(item)}>
      <Card style={styles.taskCard}>
        <View style={styles.cardHeader}>
          <View style={styles.siteInfo}>
            <Text style={styles.siteName}>{item.site_details?.Site_Name || item.site_name || item.site_id}</Text>
            <Text style={styles.siteRegion}>{item.site_details?.Region || 'Unknown Region'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
             <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
               {item.status.replace('_', ' ').toUpperCase()}
             </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <FontAwesome5 name="tools" size={14} color={Colors.textSecondary} style={{ width: 20 }} />
            <Text style={styles.infoText}>{item.visit_type}</Text>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome5 name="calendar-alt" size={14} color={Colors.textSecondary} style={{ width: 20 }} />
            <Text style={styles.infoText}>
               {item.scheduled_date ? format(new Date(item.scheduled_date), 'MMM dd, yyyy') : 
                item.visit_date ? format(new Date(item.visit_date), 'MMM dd, yyyy') : 'No Date'}
            </Text>
          </View>
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to view details</Text>
            <FontAwesome5 name="chevron-right" size={12} color={Colors.textSecondary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks found</Text>
            </View>
          }
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  listContent: {
    padding: 16,
  },
  taskCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  siteRegion: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  tapHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
