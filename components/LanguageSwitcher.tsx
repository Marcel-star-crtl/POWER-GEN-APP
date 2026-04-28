import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang).then(() => {
      setCurrentLang(lang);
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, currentLang === 'en' && styles.activeButton]}
        onPress={() => changeLanguage('en')}
        disabled={currentLang === 'en'}
      >
        <Text style={[styles.text, currentLang === 'en' && styles.activeText]}>
          ENGLISH
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, currentLang === 'fr' && styles.activeButton]}
        onPress={() => changeLanguage('fr')}
        disabled={currentLang === 'fr'}
      >
        <Text style={[styles.text, currentLang === 'fr' && styles.activeText]}>
          FRANÇAIS
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 12,
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  activeButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeText: {
    color: '#fff',
  },
});