import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface SiteItem {
  IHS_ID_SITE: string;
  Site_Name: string;
}

export default function SelectSiteAudit() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true);
        const response = await api.get('/technician/sites');
        setSites(response?.data?.data || []);
      } catch (error) {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    fetchSites();
  }, []);

  const filteredSites = sites.filter(s =>
    s.Site_Name?.toLowerCase().includes(query.toLowerCase()) ||
    s.IHS_ID_SITE?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('select_site_for_audit')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('search_site_name_or_id')}
        value={query}
        onChangeText={setQuery}
      />
      {loading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        <ScrollView>
          {filteredSites.map(site => (
            <TouchableOpacity
              key={site.IHS_ID_SITE}
              style={styles.siteCard}
              onPress={() => router.push({ pathname: '/(technician)/audit-form/[siteId]', params: { siteId: site.IHS_ID_SITE } })}
            >
              <Text style={styles.siteName}>{site.Site_Name}</Text>
              <Text style={styles.siteId}>{site.IHS_ID_SITE}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 16,
  },
  siteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
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
  siteId: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
