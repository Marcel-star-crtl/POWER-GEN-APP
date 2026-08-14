// components/EquipmentChecklist.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

type CheckStatus = 'OK' | 'Replaced' | 'Issue' | string;

interface EquipmentChecklistProps {
  label: string;
  status?: CheckStatus;
  onChange: (status: CheckStatus) => void;
}

export const EquipmentChecklist: React.FC<EquipmentChecklistProps> = ({ 
  label, 
  status, 
  onChange 
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.replace(/_/g, ' ')}</Text>
      <View style={styles.optionsContainer}>
        {(['OK', 'Replaced', 'Issue'] as const).map((option) => {
          const isSelected = status === option;
          let activeColor = Colors.primary;
          if (option === 'OK') activeColor = Colors.success;
          if (option === 'Issue') activeColor = Colors.danger;
          if (option === 'Replaced') activeColor = Colors.warning;

          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                isSelected && { backgroundColor: activeColor, borderColor: activeColor }
              ]}
              onPress={() => onChange(option)}
            >
              <Text 
                style={[
                  styles.optionText, 
                  isSelected && styles.optionTextSelected,
                  (!isSelected && option === 'Issue') && { color: Colors.danger },
                  (!isSelected && option === 'OK') && { color: Colors.success },
                  (!isSelected && option === 'Replaced') && { color: Colors.warning },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    paddingBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  optionTextSelected: {
    color: '#fff',
  },
});
