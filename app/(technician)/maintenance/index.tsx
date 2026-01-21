// app/(technician)/maintenance/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { api } from '../../../services/api';
import { ApiResponse } from '../../../types/common.types';
import { Site } from '../../../types/site.types';
import { Ionicons } from '@expo/vector-icons';

export default function MaintenanceList() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const fetchSites = async () => {
    try {
      const response = await api.get<ApiResponse<Site[]>>('/sites');
      if (response.data.data) {
        // Map and mock status for demo/prototype purposes as requested
        const mappedSites = response.data.data.map((site, index) => {
          // Mock logic for status based on index or existing data
          let status: Site['status'] = 'scheduled';
          let visitDate = new Date();

          // If last visit exists, next one is due e.g. 30 days later
          if (site.Actual_Date_Visit) {
             const lastVisit = new Date(site.Actual_Date_Visit);
             visitDate = new Date(lastVisit);
             visitDate.setDate(visitDate.getDate() + 30); // 30 days cycle
          } else {
             // Randomly distribute dates for demo
             const randomDays = (index % 5) - 2; // -2 to +2 days
             visitDate.setDate(visitDate.getDate() + randomDays);
          }
          
          const now = new Date();
          const isToday = visitDate.toDateString() === now.toDateString();
          
          if (visitDate < now && !isToday) status = 'overdue';
          else if (isToday) status = 'scheduled'; // Will show as Today color
          else status = 'scheduled';

          return {
            ...site,
            status,
            visit_date: visitDate
          };
        });
        setSites(mappedSites);
      } else {
        setSites([]);
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error);
      // Mock data in case of error
      setSites([
        {
          _id: '1',
          Site_Name: 'Downtown Generator A',
          IHS_ID_SITE: 'SITE-001',
          Region: 'Lagos',
          visit_date: new Date(),
          status: 'scheduled',
          Sites_Priority: 'P1'
        },
        {
          _id: '2',
          Site_Name: 'Uptown Backup',
          IHS_ID_SITE: 'SITE-005',
          Region: 'Abuja',
          visit_date: new Date(Date.now() - 86400000), // Yesterday
          status: 'overdue',
          Sites_Priority: 'P2'
        },
        {
            _id: '3',
            Site_Name: 'Lekki Phase 1',
            IHS_ID_SITE: 'SITE-012',
            Region: 'Lagos',
            visit_date: new Date(Date.now() + 86400000), // Tomorrow
            status: 'scheduled',
            Sites_Priority: 'P3'
        }
      ] as Site[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSites();
  };

  const filteredSites = sites.filter(site => 
    site.Site_Name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    site.IHS_ID_SITE?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string, date: string | Date | undefined) => {
      const d = date ? new Date(date) : new Date();
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      
      if (status === 'overdue' || (d < now && !isToday && status !== 'completed')) return Colors.danger; // Red
      if (isToday) return '#F97316'; // Orange-500
      return Colors.primary; // Blue
  };

  const getStatusLabel = (status: string, date: string | Date | undefined) => {
      const d = date ? new Date(date) : new Date();
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();

      if (status === 'overdue' || (d < now && !isToday && status !== 'completed')) return 'Overdue';
      if (isToday) return 'Today';
      return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const renderItem = ({ item }: { item: Site }) => {
     // Mock location based on mocked fields or real ones
     const location = item.Region || item.GRATO_Cluster || "Unknown Location";
     
     // Determine display date and status
     const visitDate = item.visit_date ? new Date(item.visit_date) : new Date();
     const status = item.status || 'scheduled';

     const badgeColor = getStatusColor(status, visitDate);
     const badgeLabel = getStatusLabel(status, visitDate);

     return (
        <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/maintenance/${item._id}?siteName=${encodeURIComponent(item.Site_Name)}`)}
        >
        <View style={styles.cardLeft}>
            <Text style={styles.siteName}>{item.Site_Name || `Site ${item.IHS_ID_SITE}`}</Text>
            <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.locationText}>{location}</Text>
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
        </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Sites</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
            style={styles.searchInput}
            placeholder="Search sites..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <FlatList
        data={filteredSites}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
            !loading ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No sites found</Text>
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
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
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
  }
});
