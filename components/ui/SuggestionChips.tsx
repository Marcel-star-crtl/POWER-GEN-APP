import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

export interface SuggestionChipProps {
  text: string;
  icon?: string;
  onPress: () => void;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({ text, icon, onPress }) => {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.chipPressed
      ]}
      onPress={onPress}
    >
      {icon && (
        <FontAwesome5 
          name={icon} 
          size={14} 
          color={Colors.primary} 
          style={styles.icon}
        />
      )}
      <Text style={styles.chipText}>{text}</Text>
    </Pressable>
  );
};

export interface SuggestionChipsProps {
  suggestions: Array<{ id: number; text: string; icon?: string }>;
  onSuggestionPress: (text: string) => void;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ 
  suggestions, 
  onSuggestionPress 
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggestions</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((suggestion) => (
          <SuggestionChip
            key={suggestion.id}
            text={suggestion.text}
            icon={suggestion.icon}
            onPress={() => onSuggestionPress(suggestion.text)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipPressed: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  icon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 14,
    color: Colors.text,
  },
});
