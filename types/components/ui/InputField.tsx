import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface InputFieldProps extends TextInputProps {
  label: string;
  unit?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  unit,
  icon,
  error,
  required,
  style,
  ...props
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {icon && <Ionicons name={icon} size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />}
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textSecondary}
          {...props}
        />
        {unit && (
          <View style={styles.unitContainer}>
            <Text style={styles.unitText}>{unit}</Text>
          </View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  required: {
    color: Colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  unitContainer: {
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  unitText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
});
