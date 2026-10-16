import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Colors } from '../../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { changeLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n';
import { router } from 'expo-router';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
};

export default function Profile() {
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.fullName}</Text>
          <Text style={styles.role}>{user?.role?.toUpperCase()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('contact_information', 'Contact Information')}</Text>
          <View style={styles.infoRow}>
            <FontAwesome5 name="envelope" size={16} color={Colors.textSecondary} style={{ width: 24 }} />
            <Text style={styles.infoText}>{user?.email}</Text>
          </View>
          {user?.phone && (
            <View style={styles.infoRow}>
               <FontAwesome5 name="phone" size={16} color={Colors.textSecondary} style={{ width: 24 }} />
               <Text style={styles.infoText}>{user.phone}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language', 'Language')}</Text>
          <View style={styles.languageRow}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = i18n.language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  onPress={() => changeLanguage(lang)}
                  style={[styles.languageOption, active && styles.languageOptionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>
                    {LANGUAGE_LABELS[lang]}
                  </Text>
                  {active && <FontAwesome5 name="check" size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.devDebugRow}
              onPress={() => router.push('/(technician)/debug-sync-queue')}
            >
              <FontAwesome5 name="database" size={16} color={Colors.textSecondary || '#888'} />
              <Text style={styles.devDebugText}>Dev: View local sync queue</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Button variant="danger" onPress={signOut} style={styles.logoutButton}>
            {t('sign_out', 'Sign Out')}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: Colors.text,
  },
  logoutButton: {
    width: '100%',
  },
  devDebugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  devDebugText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  languageOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  languageOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  languageOptionTextActive: {
    color: '#fff',
  },
});
