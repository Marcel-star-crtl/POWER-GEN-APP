import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './ui/Card';
import { Colors } from '../constants/Colors';

interface SummaryCardProps {
  label: string;
  count: number;
  type: 'pending' | 'completed' | 'overdue' | 'neutral';
  style?: ViewStyle;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ label, count, type, style }) => {
  const getStatusColor = () => {
    switch (type) {
      case 'pending': return Colors.warning;
      case 'completed': return Colors.success;
      case 'overdue': return Colors.danger;
      default: return Colors.primary;
    }
  };

  return (
    <Card style={[styles.card, style]}>
      <Text style={[styles.count, { color: getStatusColor() }]}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16, // Increased padding
    paddingHorizontal: 8,
    minWidth: 100, // Ensure decent width
  },
  count: {
    fontSize: 28, // Larger number
    fontWeight: 'bold',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});
