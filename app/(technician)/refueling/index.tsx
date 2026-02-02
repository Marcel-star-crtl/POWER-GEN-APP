import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { api } from '../../../services/api';
import { ApiResponse } from '../../../types/common.types';

interface Site {
  _id: string;
  name: string;
  site_id: string;
  currentFuelLevel?: number;
  tankCapacity?: number;
  percentage?: number;
  lastRefuelDate?: string;
  scheduledDate?: string;
  maintenanceId?: string;
}

export default function RefuelingScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<Site[]>>('/technician/refuel/sites');
      if (response.data.data) {
        setSites(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch refueling sites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPercentage = (current: number, total: number) => {
    return Math.min(Math.round((current / total) * 100), 100);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage > 50) return Colors.success;
    if (percentage > 25) return '#F59E0B';
    return Colors.danger;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSites();
  };

  const filteredSites = sites.filter(site =>
    site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.site_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: Site }) => {
    const percentage = item.percentage || getPercentage(item.currentFuelLevel || 0, item.tankCapacity || 5000);
    const color = getStatusColor(percentage);

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push({
            pathname: '/(technician)/refueling/form',
            params: {
                siteId: item.site_id,
                siteName: item.name,
                tankId: item.site_id,
                capacity: item.tankCapacity?.toString() || '5000',
                currentLevel: item.currentFuelLevel?.toString() || '0',
                maintenanceId: item.maintenanceId || ''
            }
        })}
      >
        <View style={styles.cardHeader}>
            <View>
                <Text style={styles.siteName}>{item.name}</Text>
                <Text style={styles.lastRefuel}>
                  Last refuel: {item.lastRefuelDate ? new Date(item.lastRefuelDate).toLocaleDateString() : 'N/A'}
                </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.percentage, { color: color }]}>{percentage}%</Text>
                <Text style={styles.fuelLabel}>Fuel Level</Text>
            </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBackground}>
            <View style={[
                styles.progressBarFill, 
                { width: `${percentage}%`, backgroundColor: color }
            ]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
       <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refueling</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
            <FontAwesome5 name="search" size={16} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
            style={styles.searchInput}
            placeholder="Search sites..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            />
        </View>

        <FlatList
            data={filteredSites}
            renderItem={renderItem}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              !loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <FontAwesome5 name="tint-slash" size={48} color={Colors.textSecondary} />
                  <Text style={{ marginTop: 16, color: Colors.textSecondary }}>
                    No refueling tasks assigned
                  </Text>
                </View>
              ) : null
            }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontSize: 16,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  lastRefuel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  percentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fuelLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
