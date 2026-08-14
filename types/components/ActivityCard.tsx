import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Card } from './ui/Card';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

interface ActivityCardProps {
  title: string;
  iconName: string;
  onPress: () => void;
  iconColor?: string;
  subtitle?: string;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ 
  title, 
  iconName, 
  onPress, 
  iconColor = Colors.primary,
  subtitle 
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
          <FontAwesome5 name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.arrow}>
             <FontAwesome5 name="chevron-right" size={14} color={Colors.textSecondary} />
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
      fontSize: 13,
      color: Colors.textSecondary,
  },
  arrow: {
      padding: 4
  }
});
