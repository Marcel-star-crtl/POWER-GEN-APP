import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface FuelLevelIndicatorProps {
  currentLevel: number;
  capacity: number;
  height?: number;
}

export const FuelLevelIndicator: React.FC<FuelLevelIndicatorProps> = ({ 
  currentLevel, 
  capacity,
  height = 20 
}) => {
  const percentage = Math.min(100, Math.max(0, (currentLevel / capacity) * 100));
  
  let color = Colors.success;
  if (percentage < 30) color = Colors.danger;
  else if (percentage < 50) color = Colors.warning;

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.percentageText}>{percentage.toFixed(0)}%</Text>
        <Text style={styles.valText}>{currentLevel} / {capacity} L</Text>
      </View>
      <View style={[styles.track, { height }]}>
        <View 
          style={[
            styles.fill, 
            { 
              width: `${percentage}%`, 
              backgroundColor: color,
              height: '100%' 
            }
          ]} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  percentageText: {
    fontWeight: 'bold',
    color: Colors.text,
    fontSize: 14,
  },
  valText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  track: {
    width: '100%',
    backgroundColor: Colors.lightGray,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fill: {
    borderRadius: 10,
  },
});
