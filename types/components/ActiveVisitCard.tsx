import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

interface ActiveVisitCardProps {
  visit: {
    _id: string;
    site_id: {
      Site_Name: string;
      IHS_ID_SITE: string;
    };
    check_in_time: string;
  };
  onCheckOut: () => void;
}

export const ActiveVisitCard: React.FC<ActiveVisitCardProps> = ({ visit, onCheckOut }) => {
  const [duration, setDuration] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const updateDuration = () => {
      const start = new Date(visit.check_in_time).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setDuration(`${hours}h ${minutes}m`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [visit.check_in_time]);

  const handleCreateCheckOut = async () => {
    try {
      setLoading(true);
      Alert.alert(
        "Confirm Check Out",
        "Are you sure you want to check out from this site?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Check Out", 
            style: "destructive",
            onPress: async () => {
                try {
                     await api.post('/technician/visit/check-out', { visitId: visit._id });
                     onCheckOut();
                } catch (error) {
                    Alert.alert("Error", "Failed to check out. Please try again.");
                } finally {
                    setLoading(false);
                }
            }
          }
        ]
      );
    } catch (error) {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="location" size={20} color={Colors.white} />
          <Text style={styles.title}>Active Site Visit</Text>
        </View>
        <View style={styles.badge}>
            <Text style={styles.badgeText}>IN PROGRESS</Text>
        </View>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.siteName}>{visit.site_id.Site_Name}</Text>
        <Text style={styles.siteId}>{visit.site_id.IHS_ID_SITE}</Text>
        
        <View style={styles.timeContainer}>
            <View style={styles.timeBlock}>
                <Text style={styles.label}>Check In Time</Text>
                <Text style={styles.value}>
                    {new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.timeBlock}>
                <Text style={styles.label}>Duration</Text>
                <Text style={styles.value}>{duration}</Text>
            </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.checkOutButton} 
        onPress={handleCreateCheckOut}
        disabled={loading}
      >
        <Text style={styles.checkOutText}>Check Out</Text>
        <Ionicons name="log-out-outline" size={20} color={Colors.white} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  siteName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  siteId: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  checkOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    padding: 14,
    borderRadius: 12,
  },
  checkOutText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  }
});
