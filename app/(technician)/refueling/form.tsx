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
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { api } from '../../../services/api';

export default function RefuelFormScreen() {
  const params = useLocalSearchParams<{ 
    siteId: string; 
    siteName: string;
    tankId: string;
    capacity: string;
  }>();

  // State
  const [loading, setLoading] = useState(false);
  
  // Meter Readings
  const [prevMeter, setPrevMeter] = useState('12,450 hrs'); // Mocked previous
  const [currMeter, setCurrMeter] = useState('');
  
  // Fuel Info
  const [prevQty, setPrevQty] = useState('1,200'); // Mocked
  const [fuelFound, setFuelFound] = useState('');
  const [fuelAdded, setFuelAdded] = useState('');
  const [comments, setComments] = useState('');

  // Values
  const [fuelConsumed, setFuelConsumed] = useState('Auto-calculated');
  const [runningHours, setRunningHours] = useState('Auto-calculated');
  const [currentTotal, setCurrentTotal] = useState('Auto-calculated');

  // Calculations
  useEffect(() => {
    // Current Total Logic
    const found = parseFloat(fuelFound) || 0;
    const added = parseFloat(fuelAdded) || 0;
    const total = found + added;
    setCurrentTotal(total > 0 ? `${total.toLocaleString()} L` : 'Auto-calculated');
    
    // Fuel Consumed Logic (Mock: Previous - Found)
    // In reality this logic might be more complex or depend on last fill
    const prev = parseFloat(prevQty.replace(/,/g, '')) || 0;
    if (found > 0) {
        const consumed = prev - found;
        setFuelConsumed(consumed >= 0 ? `${consumed.toLocaleString()} L` : 'Error: Found > Previous');
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
        setRunningHours(diff >= 0 ? `${diff.toLocaleString()} hrs` : 'Error: Current < Previous');
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
        // Mock API call
        // const payload = { ... }
        // await api.post('/refueling', payload);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        Alert.alert('Success', 'Refueling record saved successfully', [
            { text: 'OK', onPress: () => router.back() }
        ]);
    } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to submit refueling record');
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refueling</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Site Header Card */}
        <Card style={styles.siteCard}>
            <Text style={styles.siteName}>{params.siteName || 'Unknown Site'}</Text>
            <Text style={styles.tankId}>Tank ID: {params.tankId || 'N/A'}</Text>
        </Card>

        {/* Tank Information */}
        <Card style={styles.infoCard}>
            <Text style={styles.sectionTitle2}>Tank Information</Text>
            <View style={styles.infoRow}>
                <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Capacity:</Text>
                    <Text style={styles.infoValue}>{params.capacity || 5000} L</Text>
                </View>
                 <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Type:</Text>
                    <Text style={styles.infoValue}>Underground</Text>
                </View>
            </View>
        </Card>

        {/* Meter Readings */}
        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Meter Readings</Text>
            
            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Previous Meter Reading</Text>
                <View style={styles.readOnlyInput}>
                    <Text style={styles.readOnlyText}>{prevMeter}</Text>
                </View>
            </View>

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Current Meter Reading <Text style={styles.required}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter current reading"
                    value={currMeter}
                    onChangeText={setCurrMeter}
                    keyboardType="numeric"
                />
            </View>

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Running Hours</Text>
                <View style={styles.readOnlyInput}>
                    <Text style={styles.autoText}>{runningHours}</Text>
                </View>
            </View>
        </Card>

        {/* Diesel Information */}
        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Diesel Information</Text>
            
            <View style={styles.row}>
                <View style={[styles.fieldContainer, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Previous QTY (L)</Text>
                    <View style={styles.readOnlyInput}>
                        <Text style={styles.readOnlyText}>{prevQty}</Text>
                    </View>
                </View>
                <View style={[styles.fieldContainer, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>Fuel Found (L) <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter found"
                        value={fuelFound}
                        onChangeText={setFuelFound}
                        keyboardType="numeric"
                    />
                </View>
            </View>
            
            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Fuel Consumed (L)</Text>
                <View style={styles.readOnlyInput}>
                    <Text style={styles.autoText}>{fuelConsumed}</Text>
                </View>
            </View>

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Fuel Added (L) <Text style={styles.required}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter fuel added"
                    value={fuelAdded}
                    onChangeText={setFuelAdded}
                    keyboardType="numeric"
                />
            </View>
            
            <View style={[styles.readOnlyInput, styles.totalBox]}>
                <Text style={styles.totalLabel}>Current Total:</Text>
                <Text style={styles.totalValue}>{currentTotal}</Text>
            </View>
        </Card>

        {/* Photos */}
        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Photos <Text style={styles.required}>*</Text></Text>
            <Text style={styles.helperText}>Required: Meter readings, Tank level, Receipt</Text>
            
            <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoButton}>
                    <FontAwesome5 name="camera" size={16} color={Colors.textSecondary} />
                    <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton}>
                     <FontAwesome5 name="upload" size={16} color={Colors.textSecondary} />
                     <Text style={styles.photoButtonText}>Upload</Text>
                </TouchableOpacity>
            </View>
        </Card>

        {/* Comments */}
        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any observations or issues..."
                value={comments}
                onChangeText={setComments}
                multiline
                numberOfLines={3}
            />
        </Card>

        <Button 
            title={loading ? "Submitting..." : "Submit Report"} 
            onPress={handleSubmit} 
            disabled={loading}
            style={styles.submitButton}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  siteCard: {
    padding: 16,
    marginBottom: 16,
  },
  siteName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  tankId: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  sectionTitle2: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  }, 
  section: {
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: Colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F3F4F6',
  },
  readOnlyText: {
    color: Colors.text,
    fontWeight: '500',
  },
  autoText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  totalBox: {
    backgroundColor: '#ECFDF5', 
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontWeight: '600',
    color: '#065F46',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#065F46',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16, 
    borderStyle: 'dashed',
    backgroundColor: '#fff',
  },
  photoButtonText: {
    marginLeft: 8,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  textArea: {
      height: 80,
      textAlignVertical: 'top',
  },
  submitButton: {
    marginBottom: 20,
  }
});
