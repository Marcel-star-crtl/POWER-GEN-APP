// components/StatusBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { StatusType } from '../types/common.types';

interface StatusBadgeProps {
  status: StatusType | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'approved':
        return { bg: '#dcfce7', text: Colors.success }; // green-100
      case 'scheduled':
      case 'pending':
        return { bg: Colors.primaryLight, text: Colors.primary };
      case 'in_progress':
        return { bg: '#fff7ed', text: Colors.warning }; // orange-50
      case 'overdue':
      case 'rejected':
      case 'issue':
        return { bg: '#fee2e2', text: Colors.danger }; // red-100
      case 'draft':
        return { bg: Colors.lightGray, text: Colors.textSecondary };
      default:
        return { bg: Colors.lightGray, text: Colors.textSecondary };
    }
  };

  const { bg, text } = getStatusColor(status);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
});
