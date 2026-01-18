import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { Part, PartRequest } from '../../types/parts.types';
import { ApiResponse } from '../../types/common.types';
import { format } from 'date-fns';

type Tab = 'catalog' | 'requests';

export default function PartsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchParts();
    } else {
      fetchRequests();
    }
  }, [activeTab]);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<Part[]>>('/parts', {
        params: { search: searchQuery, status: 'active' }
      });
      if (response.data.data) {
        setParts(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching parts:', error);
      Alert.alert('Error', 'Failed to load parts catalog');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<PartRequest[]>>('/parts/requests/my');
      if (response.data.data) {
        setRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to load request history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'fulfilled': return Colors.success;
      case 'pending': return Colors.warning;
      case 'rejected': return Colors.danger;
      default: return Colors.textSecondary;
    }
  };

  const renderPartItem = ({ item }: { item: Part }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <FontAwesome5 name="cogs" size={20} color={Colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.partName}>{item.name}</Text>
          <Text style={styles.partNumber}>{item.part_number}</Text>
        </View>
        <View style={styles.stockBadge}>
          <Text style={styles.stockText}>
            {item.inventory?.stock || 0} left
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
         <Text style={styles.category}>{item.category}</Text>
         <TouchableOpacity 
            style={styles.requestButton}
            onPress={() => router.push({
              pathname: '/(technician)/request-part',
              params: { partId: item._id, partName: item.name }
            })}
         >
           <Text style={styles.requestButtonText}>Request</Text>
         </TouchableOpacity>
      </View>
    </Card>
  );

  const renderRequestItem = ({ item }: { item: PartRequest }) => (
    <Card style={styles.card}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestId}>{item.request_id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.requestItems}>
        {item.items.map((reqItem, idx) => (
          <Text key={idx} style={styles.itemText}>
            • {reqItem.part_name || 'Part'} x{reqItem.quantity}
          </Text>
        ))}
      </View>

      <View style={styles.requestFooter}>
        <Text style={styles.dateText}>
          {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
        </Text>
        {item.urgency === 'critical' && (
          <View style={styles.criticalBadge}>
            <FontAwesome5 name="exclamation-circle" size={12} color="#fff" />
            <Text style={styles.criticalText}>Critical</Text>
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parts Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'catalog' && styles.activeTab]}
          onPress={() => setActiveTab('catalog')}
        >
          <Text style={[styles.tabText, activeTab === 'catalog' && styles.activeTabText]}>Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>My Requests</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'catalog' && (
          <View style={styles.searchContainer}>
            <FontAwesome5 name="search" size={16} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search parts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={fetchParts}
            />
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={activeTab === 'catalog' ? parts : requests}
            renderItem={activeTab === 'catalog' ? renderPartItem as any : renderRequestItem as any}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="box-open" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>
                  {activeTab === 'catalog' ? 'No parts found' : 'No requests found'}
                </Text>
              </View>
            }
          />
        )}
      </View>
      
      {activeTab === 'requests' && (
        <TouchableOpacity 
            style={styles.fab}
            onPress={() => router.push('/(technician)/request-part')}
        >
            <FontAwesome5 name="plus" size={24} color="#fff" />
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
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
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  list: {
    padding: 16,
  },
  loader: {
    marginTop: 32,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  partName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  partNumber: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  stockBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  category: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  requestButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestItems: {
    marginBottom: 12,
  },
  itemText: {
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  criticalText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
