import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { FormSection } from '../../../components/ui/FormSection';
import { InputField } from '../../../components/ui/InputField';
import { PhotoCapture, PhotoAttachment } from '../../../components/ui/PhotoCapture';
import { api, uploadAPI } from '../../../services/api';

export default function RefuelFormScreen() {
  const params = useLocalSearchParams<{ 
    siteId: string; 
    siteName: string;
    tankId: string;
    capacity: string;
    currentLevel: string;
    maintenanceId?: string;
  }>();

  // State
  const [loading, setLoading] = useState(false);
  
  // Meter Readings
  const [prevMeter, setPrevMeter] = useState('');
  const [currMeter, setCurrMeter] = useState('');
  
  // Fuel Info
  const [prevQty, setPrevQty] = useState(params.currentLevel || '0');
  const [fuelFound, setFuelFound] = useState('');
  const [fuelAdded, setFuelAdded] = useState('');
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

  // Values
  const [fuelConsumed, setFuelConsumed] = useState('Auto-calculated');
  const [runningHours, setRunningHours] = useState('Auto-calculated');
  const [currentTotal, setCurrentTotal] = useState('Auto-calculated');
  const [showDelivery, setShowDelivery] = useState(false);

  // Calculations
  useEffect(() => {
    // Current Total Logic
    const found = parseFloat(fuelFound) || 0;
    const added = parseFloat(fuelAdded) || 0;
    const total = found + added;
    setCurrentTotal(total > 0 ? `${total} L` : 'Auto-calculated');
    
    // Fuel Consumed Logic (Mock: Previous - Found)
    const prev = parseFloat(prevQty.replace(/,/g, '')) || 0;
    if (fuelFound && found >= 0) {
        const consumed = prev - found;
        setFuelConsumed(`${parseFloat(consumed.toFixed(1))} L`);
    } else {
        setFuelConsumed('Auto-calculated');
    }
  }, [fuelFound, fuelAdded, prevQty]);

  useEffect(() => {
    // Running hours logic
    const prev = parseFloat(prevMeter.replace(/[^0-9.]/g, '')) || 0;
    const curr = parseFloat(currMeter) || 0;
    
    if (curr > 0) {
        const diff = curr - prev;
        setRunningHours(diff >= 0 ? `+${diff} hrs` : 'Error: Current < Previous');
    } else {
        setRunningHours('Auto-calculated');
    }
  }, [currMeter, prevMeter]);

  const handleSubmit = async () => {
    if (!currMeter || !fuelFound || !fuelAdded) {
       Alert.alert('Missing Fields', 'Please fill in all required fields.');
       return;
    }
    
    try {
        setLoading(true);
        
        // Process and upload photos if any
        const processedPhotos = photos.length > 0 
          ? await uploadAPI.processAndUploadData(photos.map(p => p.uri))
          : [];
        
        const payload = {
          site_id: params.siteId,
          site_name: params.siteName,
          maintenanceId: params.maintenanceId,
          opening_level: parseFloat(prevQty),
          closing_level: parseFloat(fuelFound) + parseFloat(fuelAdded),
          fuel_added: parseFloat(fuelAdded),
          tank_capacity: parseFloat(params.capacity || '5000'),
          opening_hours: prevMeter ? parseFloat(prevMeter) : undefined,
          closing_hours: currMeter ? parseFloat(currMeter) : undefined,
          comments,
          photos: processedPhotos
        };
        
        const response = await api.post('/technician/refuel', payload);
        
        if (response.data.success) {
          Alert.alert('Success', 'Refueling record saved successfully', [
              { text: 'OK', onPress: () => router.push('/(technician)/dashboard') }
          ]);
        }
    } catch (error: any) {
        console.error('Submit refuel error:', error);
        const message = error?.response?.data?.error || error?.message || 'Failed to submit refueling record';
        Alert.alert('Error', message);
    } finally {
        setLoading(false);
    }
  };

  const calculateFullPercentage = () => {
      const cap = parseFloat(params.capacity || '5000');
      const found = parseFloat(fuelFound) || 0;
      const added = parseFloat(fuelAdded) || 0;
      const total = found + added;
      const percent = Math.min((total / cap) * 100, 100);
      return Math.round(percent > 0 ? percent : 0);
  }

  return (
    <SafeAreaView style={styles.container}>
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View>
                 <Text style={styles.headerTitle}>Refueling Entry</Text>
                 <Text style={styles.subTitle}>{params.siteName || 'Site A - Lagos'}</Text>
            </View>
            <View style={{ width: 40 }} />
         </View>

         <ScrollView contentContainerStyle={styles.scrollContent}>
            
            {/* Tank Info Card */}
            <View style={styles.tankCard}>
                <View style={styles.tankHeader}>
                     <View style={styles.iconBox}>
                        <Ionicons name="water" size={24} color="white" />
                     </View>
                     <View>
                        <Text style={styles.tankTitle}>Tank Information</Text>
                        <Text style={styles.tankId}>{params.tankId || 'TANK-001-A'}</Text>
                     </View>
                </View>
                <View style={styles.tankStats}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{params.capacity || '5000L'}</Text>
                        <Text style={styles.statLabel}>Capacity</Text>
                    </View>
                     <View style={[styles.statItem, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Text style={styles.statValue}>{calculateFullPercentage()}%</Text>
                        <Text style={styles.statLabel}>Current</Text>
                    </View>
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>U/G</Text>
                        <Text style={styles.statLabel}>Type</Text>
                    </View>
                </View>
            </View>

            <FormSection title="Meter Readings" icon="speedometer-outline">
                <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyLabel}>Previous Reading</Text>
                    <Text style={styles.readOnlyValue}>{prevMeter} hrs</Text>
                </View>
                
                <InputField 
                    label="Current Meter Reading" 
                    value={currMeter} 
                    onChangeText={setCurrMeter} 
                    unit="hrs" 
                    keyboardType="numeric" 
                    required 
                />

                <View style={[styles.calcBox, runningHours.startsWith('Error') ? styles.errorBox : styles.successBox]}>
                    <Ionicons name="trending-up" size={20} color={runningHours.startsWith('Error') ? Colors.danger : Colors.success} />
                    <Text style={styles.calcLabel}>Running Hours</Text>
                    <Text style={[styles.calcValue, { color: runningHours.startsWith('Error') ? Colors.danger : Colors.success }]}>
                        {runningHours}
                    </Text>
                </View>
            </FormSection>

            <FormSection title="Diesel Information" icon="water-outline">
                <View style={styles.row}>
                    <View style={[styles.readOnlyField, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.readOnlyLabel}>Previous QTY</Text>
                        <Text style={styles.readOnlyValue}>{prevQty} L</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <InputField 
                            label="Fuel Found" 
                            value={fuelFound} 
                            onChangeText={setFuelFound} 
                            unit="L" 
                            keyboardType="numeric" 
                            required 
                        />
                    </View>
                </View>

                 <View style={[styles.calcBox, styles.warningBox]}>
                    <Text style={styles.calcLabel}>Fuel Consumed</Text>
                    <Text style={[styles.calcValue, { color: '#ea580c' }]}>
                        {fuelConsumed}
                    </Text>
                </View>

                <InputField 
                    label="Fuel Added" 
                    value={fuelAdded} 
                    onChangeText={setFuelAdded} 
                    unit="L" 
                    keyboardType="numeric" 
                    required 
                />

                <View style={styles.totalBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                         <Ionicons name="checkmark-circle" size={24} color="white" />
                         <View>
                            <Text style={styles.totalLabel}>Current Total</Text>
                             <Text style={styles.totalValue}>{currentTotal}</Text>
                         </View>
                    </View>
                </View>
            </FormSection>

            {/* <TouchableOpacity style={styles.accordionHeader} onPress={() => setShowDelivery(!showDelivery)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.accordionIcon}>
                         <Ionicons name="location-outline" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.accordionTitle}>Delivery Information (Optional)</Text>
                </View>
                <Ionicons name={showDelivery ? "chevron-up" : "chevron-down"} size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            
            {showDelivery && (
                <View style={styles.accordionContent}>
                    <InputField label="Vendor Name" placeholder="Select Vendor" />
                    <InputField label="Waybill Number" placeholder="Enter number" />
                </View>
            )} */}

            <FormSection title="Documentation Photos" icon="camera-outline">
                <PhotoCapture 
                    label="Required: Meter, Tank Level, Receipt" 
                    photos={photos} 
                    onAddPhoto={(p) => setPhotos([...photos, p])} 
                    onRemovePhoto={(uri) => setPhotos(photos.filter(p => p.uri !== uri))} 
                    required 
                />
            </FormSection>

            <FormSection title="Additional Comments" icon="create-outline">
                 <InputField 
                    label="" 
                    placeholder="Any observations, delivery issues, or special notes..."
                    value={comments} 
                    onChangeText={setComments} 
                    multiline 
                    numberOfLines={4} 
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
            </FormSection>

         </ScrollView>

         <View style={styles.footer}>
             <TouchableOpacity style={styles.saveDraftBtn}>
                 <Text style={styles.saveDraftText}>Save Draft</Text>
             </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Submit Refueling</Text>}
            </TouchableOpacity>
         </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  subTitle: {
      fontSize: 12,
      color: Colors.textSecondary,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  tankCard: {
      backgroundColor: Colors.primary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
  },
  tankHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
  },
  iconBox: {
      width: 40, 
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  tankTitle: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
  },
  tankId: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
  },
  tankStats: {
      flexDirection: 'row',
      gap: 8,
  },
  statItem: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: 10,
      alignItems: 'center',
  },
  statValue: {
      color: 'white',
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 4,
  },
  statLabel: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 10,
  },
  readOnlyField: {
      backgroundColor: '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: Colors.border,
  },
  readOnlyLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 4,
  },
  readOnlyValue: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
  },
  calcBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
  },
  successBox: {
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0',
  },
  errorBox: {
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
  },
  warningBox: {
      backgroundColor: '#fff7ed',
     borderColor: '#fed7aa',
  },
  calcLabel: {
      fontSize: 14,
      color: Colors.text,
      fontWeight: '500',
      flex: 1,
      marginLeft: 8,
  },
  calcValue: {
      fontWeight: '700',
      fontSize: 16,
  },
  totalBox: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
  },
  totalLabel: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      marginBottom: 2,
  },
  totalValue: {
      color: 'white',
      fontSize: 24,
      fontWeight: '700',
  },
  accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: Colors.surface,
      padding: 16,
      marginBottom: 16,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
  },
  accordionIcon: {
      padding: 6,
      backgroundColor: '#eff6ff', 
      borderRadius: 8,
  },
  accordionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
  },
  accordionContent: {
      backgroundColor: Colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      marginTop: -8, // pull up closer to header if needed
  },
  row: {
      flexDirection: 'row',
  },
  footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.surface,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        flexDirection: 'row',
        gap: 12,    
  },
  saveDraftBtn: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    saveDraftText: {
        color: Colors.textSecondary,
        fontWeight: '600',
        fontSize: 16,
    },
    submitBtn: {
        flex: 1.5,
        backgroundColor: '#16a34a', // Green-600
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});
