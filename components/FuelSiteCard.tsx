import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";

export interface FuelSiteCardProps {
  name: string;
  lastRefuelDate?: string;
  percentage: number;
  onPress?: () => void;
  scheduledDate?: string;
  priority?: string | number;
  maintenanceStatus?: string;
}

export const FuelSiteCard: React.FC<FuelSiteCardProps> = ({
  name,
  lastRefuelDate,
  percentage,
  onPress,
  scheduledDate,
  priority,
  maintenanceStatus,
}) => {
  const getStatusColor = (percentage: number) => {
    if (percentage > 50) return Colors.success;
    if (percentage > 25) return "#F59E0B";
    return Colors.danger;
  };
  const color = getStatusColor(percentage);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.siteName}>{name}</Text>
          <Text style={styles.lastRefuel}>
            Last refuel: {lastRefuelDate ? new Date(lastRefuelDate).toLocaleDateString() : "N/A"}
          </Text>
          {scheduledDate && (
            <Text style={styles.metaText}>Scheduled: {new Date(scheduledDate).toLocaleString()}</Text>
          )}
          {priority && (
            <Text style={styles.metaText}>Priority: {priority}</Text>
          )}
          {maintenanceStatus && (
            <Text style={styles.metaText}>Maintenance: {maintenanceStatus}</Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.percentage, { color }]}>{percentage}%</Text>
          <Text style={styles.fuelLabel}>Fuel Level</Text>
        </View>
      </View>
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${percentage}%`, backgroundColor: color },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  siteName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  lastRefuel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  percentage: {
    fontSize: 18,
    fontWeight: "bold",
  },
  fuelLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
});
