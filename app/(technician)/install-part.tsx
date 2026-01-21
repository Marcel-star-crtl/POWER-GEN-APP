import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function PartInstallationScreen() {
  const params = useLocalSearchParams<{ 
    requestId: string; 
    partName: string;
    siteName: string;
    approvalDate: string;
    approvedBy: string;
    isReplacement?: string; // "true" or "false"
  }>();

  // Old Part Removal State
  const [removalDate, setRemovalDate] = useState('');
  const [oldSerial, setOldSerial] = useState('');
  const [oldCondition, setOldCondition] = useState('');
  
  // New Part installation State
  const [installDate, setInstallDate] = useState('');
  const [newSerial, setNewSerial] = useState('');
  
  // Testing & Verification State
  const [testPerformed, setTestPerformed] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [notes, setNotes] = useState('');

  const isReplacement = params.isReplacement === 'true';

  const handleSubmit = () => {
    // Validate
    if (!installDate || !newSerial || !testPerformed || !testResult) {
       Alert.alert('Missing Fields', 'Please fill in all required fields.');
       return;
    }
    if (isReplacement && (!removalDate || !oldSerial || !oldCondition)) {
        Alert.alert('Missing Fields', 'Please fill in removal details.');
        return;
    }

    // Submit logic (mock)
    Alert.alert('Success', 'Part installation recorded successfully', [
        { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const DatePickerField = ({ label, value, onChange }: any) => (
    <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label} <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.dateInput}>
            <Text style={value ? styles.inputText : styles.placeholder}>
                {value || 'mm/dd/yyyy --:-- --'}
            </Text>
            <FontAwesome5 name="calendar-alt" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Part Installation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Approved Request Banner */}
        <Card style={styles.approvedCard}>
            <View style={styles.approvedHeader}>
                <FontAwesome5 name="check-circle" size={20} color={Colors.success} />
                <Text style={styles.approvedTitle}>Approved Request</Text>
            </View>
            <View style={styles.approvedDetails}>
                <Text style={styles.approvedText}><Text style={styles.bold}>Part:</Text> {params.partName || 'Unknown Part'}</Text>
                <Text style={styles.approvedText}><Text style={styles.bold}>Site:</Text> {params.siteName || 'Unknown Site'}</Text>
                <Text style={styles.approvedText}>
                    Approved by: {params.approvedBy || 'Admin'} on {params.approvalDate || 'Unknown Date'}
                </Text>
            </View>
        </Card>

        {isReplacement && (
            <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Old Part Removal</Text>
                
                <DatePickerField 
                    label="Removal Date & Time" 
                    value={removalDate} 
                    onChange={setRemovalDate} 
                />

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Old Part Serial Number</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter serial number"
                        value={oldSerial}
                        onChangeText={setOldSerial}
                    />
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Condition of Removed Part <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pickerPlaceholder}>
                        <Text style={styles.placeholder}>{oldCondition || 'Select condition'}</Text>
                        <FontAwesome5 name="chevron-down" size={14} color={Colors.textSecondary} />
                    </View>
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Photos of Old Part <Text style={styles.required}>*</Text></Text>
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
                </View>
            </Card>
        )}

        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>New Part Installation</Text>
            
            <DatePickerField 
                label="Installation Date & Time" 
                value={installDate} 
                onChange={setInstallDate} 
            />

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>New Part Serial Number <Text style={styles.required}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter serial number"
                    value={newSerial}
                    onChangeText={setNewSerial}
                />
            </View>

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Photos of Installed Part <Text style={styles.required}>*</Text></Text>
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
            </View>
        </Card>

        <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Testing & Verification</Text>
            
            <TouchableOpacity 
                style={styles.checkboxContainer} 
                onPress={() => setTestPerformed(!testPerformed)}
            >
                <View style={[styles.checkbox, testPerformed && styles.checkboxChecked]}>
                    {testPerformed && <FontAwesome5 name="check" size={12} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>Functionality test performed <Text style={styles.required}>*</Text></Text>
            </TouchableOpacity>

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Test Results <Text style={styles.required}>*</Text></Text>
                <View style={styles.pickerPlaceholder}>
                    <Text style={styles.placeholder}>{testResult || 'Select result'}</Text>
                    <FontAwesome5 name="chevron-down" size={14} color={Colors.textSecondary} />
                </View>
            </View>

            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Installation Notes</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Any issues encountered or special notes..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                />
            </View>
        </Card>

        <Button title="Complete Installation" onPress={handleSubmit} style={styles.submitButton} />
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
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  approvedCard: {
    marginBottom: 16,
    backgroundColor: '#F0FDF4', // Light green
    borderColor: Colors.success,
    borderWidth: 1,
  },
  approvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  approvedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
    marginLeft: 8,
  },
  approvedDetails: {
    marginLeft: 28,
  },
  approvedText: {
    color: Colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '600',
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
  dateInput: {
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
  pickerPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
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
    padding: 12,
    borderStyle: 'dashed',
  },
  photoButtonText: {
    marginLeft: 8,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.success,
  }
});
