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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';

export default function RequestPartScreen() {
  const params = useLocalSearchParams<{ partId?: string; partName?: string }>();
  const [loading, setLoading] = useState(false);
  
  const [partId, setPartId] = useState(params.partId || '');
  const [partName, setPartName] = useState(params.partName || '');
  
  // New Fields
  const [site, setSite] = useState('');
  const [equipment, setEquipment] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [description, setDescription] = useState('');

  // Mock Data for Dropdowns
  const sites = ['Site A - Lagos', 'Site B - Abuja', 'Site C - Kano']; 
  const equipments = ['Generator #1', 'Generator #2', 'Cooling System', 'Control Panel'];

  const handleSubmit = async () => {
    if (!partId) {
      Alert.alert('Error', 'Please select a part');
      return;
    }
    if (!site || !equipment || !quantity || !description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        items: [{
          part: partId,
          part_name: partName, // helpful for backend if not joining
          quantity: parseInt(quantity)
        }],
        site_name: site,
        urgency,
        notes: `Equipment: ${equipment}\nIssue: ${description}`, // Mapping to existing backend notes field
      };

      await api.post('/parts/requests', payload);

      Alert.alert('Success', 'Part request submitted successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Submit request error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const Dropdown = ({ label, value, options, onSelect }: any) => (
    <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label} <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => {
            // In a real app, open a modal or picker. For now, just cycle or alerts
            // Simple mock implementation:
            const nextIndex = (options.indexOf(value) + 1) % options.length;
            onSelect(options[nextIndex] || options[0]);
        }}>
            <Text style={value ? styles.inputText : styles.placeholder}>
                {value || `Select ${label.toLowerCase()}`}
            </Text>
            <FontAwesome5 name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
        {/* Helper Note for Demo */}
        <Text style={{fontSize: 10, color: Colors.textSecondary, marginTop: 4}}>* Tap to cycle options (Mock)</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Part Request</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
                 <FontAwesome5 name="info-circle" size={16} color={Colors.primary} />
                 <Text style={styles.infoTitle}>Part Information</Text>
            </View>
            <Text style={styles.partNameLg}>{partName || 'Select Part'}</Text>
            <Text style={styles.partId}>Part ID: {partId || 'N/A'}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Request Details</Text>
          
          <Dropdown 
            label="Site" 
            value={site} 
            options={sites} 
            onSelect={setSite} 
          />

          <Dropdown 
            label="Equipment Affected" 
            value={equipment} 
            options={equipments} 
            onSelect={setEquipment} 
          />

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Quantity <Text style={styles.required}>*</Text></Text>
            <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="1"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Urgency Level <Text style={styles.required}>*</Text></Text>
            <View style={styles.urgencyContainer}>
                {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                    <TouchableOpacity
                        key={level}
                        style={[
                            styles.urgencyChip,
                            urgency === level && styles.urgencyChipActive,
                             urgency === level && { borderColor: level === 'critical' ? Colors.danger : Colors.primary }
                        ]}
                        onPress={() => setUrgency(level)}
                    >
                        <Text style={[
                            styles.urgencyText,
                            urgency === level && { color: level === 'critical' ? Colors.danger : Colors.primary }
                        ]}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Issue Description <Text style={styles.required}>*</Text></Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="Describe the issue and why this part is needed..."
            />
          </View>
        </Card>

        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Photos of Issue <Text style={styles.required}>*</Text></Text>
            <Text style={styles.helperText}>Upload photos showing the faulty part/issue</Text>
            
            <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoButton}>
                    <FontAwesome5 name="camera" size={16} color={Colors.textSecondary} />
                    <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton}>
                     <FontAwesome5 name="upload" size={16} color={Colors.textSecondary} />
                     <Text style={styles.photoButtonText}>Upload</Text>
                </TouchableOpacity>
            </View>
        </Card>

        <Button 
            title={loading ? "Submitting..." : "Submit Request"} 
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
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#EFF6FF', // Light blue
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoTitle: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  partNameLg: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  partId: {
    color: Colors.textSecondary,
    fontSize: 13,
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
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  inputText: {
    color: Colors.text,
  },
  placeholder: {
    color: Colors.textSecondary,
  },
  urgencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  urgencyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  urgencyChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  urgencyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
    backgroundColor: '#F9FAFB',
  },
  photoButtonText: {
    marginLeft: 8,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  submitButton: {
    marginBottom: 20,
  }
});
