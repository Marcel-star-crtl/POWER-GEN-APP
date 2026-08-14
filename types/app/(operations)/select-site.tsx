import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { operationsAPI } from '../../services/api';

interface SiteItem {
  _id: string;
  Site_Name?: string;
  IHS_ID_SITE?: string;
  Region?: string;
  Sites_Type?: string;
}

export default function OperationsSelectSite() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadSites = async () => {
      try {
        const response = await operationsAPI.getSites();
        setSites(response.data?.data || []);
      } catch (error) {
        console.error('Failed to load sites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSites();
  }, []);

  const filteredSites = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((site) =>
      [site.Site_Name, site.IHS_ID_SITE, site.Region]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    );
  }, [search, sites]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading sites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by site name, ID or region"
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={Colors.textSecondary}
      />

      <FlatList
        data={filteredSites}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.siteCard}
            onPress={() => router.push(`/(operations)/audit-form/${item._id}`)}
          >
            <Text style={styles.siteName}>{item.Site_Name || 'Unnamed site'}</Text>
            <Text style={styles.siteMeta}>ID: {item.IHS_ID_SITE || 'N/A'}</Text>
            <Text style={styles.siteMeta}>Region: {item.Region || 'N/A'}</Text>
            {item.Sites_Type && <Text style={styles.siteMeta}>Type: {item.Sites_Type}</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  siteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  siteMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
});
