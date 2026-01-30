// app/(technician)/maintenance/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { api } from '../../../services/api';
import { ApiResponse } from '../../../types/common.types';
import { Maintenance } from '../../../types/maintenance.types';
import { Ionicons } from '@expo/vector-icons';

export default function MaintenanceList() {
  const [tasks, setTasks] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const fetchTasks = async () => {
    try {
      const response = await api.get<ApiResponse<Maintenance[]>>('/technician/maintenance/tasks');
      if (response.data.data) {
        setTasks(response.data.data);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to fetch maintenance tasks:', error);
      setTasks([]);
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

  const filteredTasks = tasks.filter(task => 
    task.site_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    task.site_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.check_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
      switch(status) {
        case 'scheduled':
          return '#3B82F6'; // Blue for scheduled
        case 'approved':
          return Colors.success; // Green for approved
        case 'in_progress':
          return '#F97316'; // Orange
        case 'pending_approval':
          return '#EAB308'; // Yellow
        case 'completed':
          return Colors.success; // Green
        case 'rejected':
          return Colors.danger; // Red
        case 'draft':
          return '#94A3B8'; // Gray for draft
        default:
          return Colors.textSecondary;
      }
  };

  const getStatusLabel = (status: string) => {
      switch(status) {
        case 'scheduled': return 'Scheduled';
        case 'approved': return 'Approved';
        case 'in_progress': return 'In Progress';
        case 'pending_approval': return 'Pending Approval';
        case 'completed': return 'Completed';
        case 'rejected': return 'Rejected';
        case 'draft': return 'Draft';
        default: return status;
      }
  };

  const renderItem = ({ item }: { item: any }) => {
     const badgeColor = getStatusColor(item.status);
     const badgeLabel = getStatusLabel(item.status);
     const visitDate = new Date(item.visit_date);

     return (
        <TouchableOpacity 
        style={styles.card} 
        onPress={() => {
          const path = `/(technician)/maintenance/equipment/${item.check_type}?id=${item.maintenance_id}&siteId=${item.site_id}&siteName=${encodeURIComponent(item.site_name || item.site_id)}`;
          console.log('🔍 Navigating to:', path);
          router.push(path);
        }}
        >
        <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name={(item.check_icon || 'clipboard') as any} size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardLeft}>
                <Text style={styles.checkTitle}>{item.check_title || 'Equipment Check'}</Text>
                <Text style={styles.siteName}>{item.site_name || item.site_id}</Text>
                <View style={styles.locationContainer}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.locationText}>{item.site_id}</Text>
                </View>
                <View style={styles.dateContainer}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.dateText}>
                        {visitDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                </View>
            </View>
            
            <View style={styles.cardRight}>
                <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                    <Text style={styles.badgeText}>{badgeLabel}</Text>
                </View>
            </View>
        </View>
        </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Maintenance Tasks</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderItem}
        keyExtractor={(item) => item._id || item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
            !loading ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No maintenance tasks found</Text>
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
    backgroundColor: Colors.lightGray,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: Colors.text,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  checkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  cardRight: {
      justifyContent: 'center',
  },
  siteName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  locationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
  },
  locationText: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginLeft: 4,
  },
  dateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  dateText: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginLeft: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
      padding: 20,
      alignItems: 'center',
  },
  emptyText: {
      color: Colors.textSecondary,
      fontSize: 16,
  },
  actionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
      alignItems: 'center',
  },
  actionBadge: {
      backgroundColor: Colors.primaryLight || '#E0F2FE',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
  },
  actionText: {
      fontSize: 11,
      color: Colors.primary,
      fontWeight: '500',
      textTransform: 'capitalize',
  },
  moreText: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontWeight: '500',
  }
});
