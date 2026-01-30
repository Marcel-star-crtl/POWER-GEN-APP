import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';

interface SiteItem {
  IHS_ID_SITE: string;
  Site_Name: string;
  next_maintenance?: {
    maintenance_id: string;
    date: string | Date;
    type: string;
    priority: string;
  };
}

export default function SelectSite() {
  const params = useLocalSearchParams<{ nextPath?: string; requiredAction?: string }>();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true);
        const response = await api.get('/technician/sites');
        const list: SiteItem[] = response?.data?.data || [];
        setSites(list);
        console.log('✅ SelectSite loaded sites:', list.length);
      } catch (error: any) {
        console.error('❌ Failed to load sites:', error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, []);

  const filteredSites = useMemo(() => {
    let result = sites;
    
    // Filter by required action if present
    if (params.requiredAction) {
       const reqAction = params.requiredAction!.toLowerCase().trim();
       
       result = result.filter(s => {
          if (!s.next_maintenance?.type) return false;
          
          const type = s.next_maintenance.type.toUpperCase();
          
          if (reqAction === 'preventive') {
              return type.includes('PM');
          } else if (reqAction === 'refueling') {
              return type.includes('RF');
          } else if (reqAction === 'corrective') {
              return type.includes('END');
          }
          
          return false;
       });
    }

    const q = query.trim().toLowerCase();
    if (!q) return result;
    
    return result.filter(s =>
      s.Site_Name?.toLowerCase().includes(q) || s.IHS_ID_SITE?.toLowerCase().includes(q)
    );
  }, [sites, query, params.requiredAction]);

  const handleSelect = (site: SiteItem) => {
    console.log('🏢 Selected site:', site.Site_Name, site.IHS_ID_SITE, 'Maintenance ID:', site.next_maintenance?.maintenance_id);
    
    const maintenanceId = site.next_maintenance?.maintenance_id || '';
    
    if (params.nextPath) {
        // Construct the next URL with site params
        // Decode nextPath in case it was encoded
        const basePath = decodeURIComponent(params.nextPath);
        const separator = basePath.includes('?') ? '&' : '?';
        let target = `${basePath}${separator}siteId=${encodeURIComponent(site.IHS_ID_SITE)}&siteName=${encodeURIComponent(site.Site_Name)}`;
        if (maintenanceId) {
          target += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
        }
        console.log('🔗 Redirecting to:', target);
        router.push(target);
    } else {
        // If coming from quick action
        const reqAction = params.requiredAction || 'preventive';
        
        // Navigate to Checklist screen
        let target = `/(technician)/maintenance/checklist?siteId=${encodeURIComponent(site.IHS_ID_SITE)}&siteName=${encodeURIComponent(site.Site_Name)}&type=${reqAction}`;
        
        if (maintenanceId) {
           target += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
        }
        
        console.log('🔗 Redirecting to CheckList:', target);
        router.push(target);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LoadingOverlay visible={loading} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
           {params.requiredAction ? `Select Site` : 'Select Site'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or ID"
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

        <ScrollView contentContainerStyle={filteredSites.length === 0 ? styles.emptyContainer : undefined}>
          {filteredSites.length === 0 && !loading ? (
            <Text style={styles.emptyText}>No assigned sites found for this action.</Text>
          ) : (
            filteredSites.map((item) => (
              <TouchableOpacity key={item.IHS_ID_SITE} onPress={() => handleSelect(item)}>
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.siteName}>{item.Site_Name}</Text>
                    <FontAwesome5 name="chevron-right" size={16} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.siteId}>{item.IHS_ID_SITE}</Text>
                  {item.next_maintenance?.type && (
                      <View style={{marginTop: 8, flexDirection: 'row'}}>
                          <Text style={{fontSize: 12, color: Colors.primary, backgroundColor: Colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4}}>
                              {item.next_maintenance.type}
                          </Text>
                      </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    // Note: removed backgroundColor/borderWidth to match design if needed, but kept for clarity
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: Colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  siteId: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    paddingTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
  },
});
