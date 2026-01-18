import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';

interface SiteItem {
  IHS_ID_SITE: string;
  Site_Name: string;
}

export default function SelectSite() {
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
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(s =>
      s.Site_Name?.toLowerCase().includes(q) || s.IHS_ID_SITE?.toLowerCase().includes(q)
    );
  }, [sites, query]);

  const handleSelect = (site: SiteItem) => {
    console.log('🏢 Selected site:', site.Site_Name, site.IHS_ID_SITE);
    const target = `/(technician)/create-visit?siteId=${encodeURIComponent(site.IHS_ID_SITE)}&siteName=${encodeURIComponent(site.Site_Name)}`;
    console.log('🗺 Target URL:', target);
    router.replace(target);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Site</Text>
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

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={filteredSites.length === 0 ? styles.emptyContainer : undefined}>
            {console.log(filteredSites)}
          {filteredSites.length === 0 ? (
            <Text style={styles.emptyText}>No sites found</Text>
          ) : (
            filteredSites.map((item) => (
              <TouchableOpacity key={item.IHS_ID_SITE} onPress={() => handleSelect(item)}>
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.siteName}>{item.Site_Name}</Text>
                    <FontAwesome5 name="chevron-right" size={16} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.siteId}>{item.IHS_ID_SITE}</Text>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
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
