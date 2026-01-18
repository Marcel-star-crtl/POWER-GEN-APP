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
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';

export default function RequestPartScreen() {
  const params = useLocalSearchParams<{ partId?: string; partName?: string }>();
  const [loading, setLoading] = useState(false);
  
  const [partId, setPartId] = useState(params.partId || '');
  const [partName, setPartName] = useState(params.partName || '');
  const [quantity, setQuantity] = useState('1');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [notes, setNotes] = useState('');
  const [site, setSite] = useState('');

  const handleSubmit = async () => {
    if (!partId) {
      Alert.alert('Error', 'Please select a part');
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        items: [{
          part: partId,
          quantity: parseInt(quantity)
        }],
        urgency,
        notes,
        site
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

  const UrgencyOption = ({ value, label, color }: { value: typeof urgency, label: string, color: string }) => (
    <TouchableOpacity
      style={[
        styles.urgencyOption,
        urgency === value && { backgroundColor: color + '20', borderColor: color }
      ]}
      onPress={() => setUrgency(value)}
    >
      <View style={[styles.radio, urgency === value && { borderColor: color }]}>
        {urgency === value && <View style={[styles.radioDot, { backgroundColor: color }]} />}
      </View>
      <Text style={[styles.urgencyText, urgency === value && { color: color, fontWeight: 'bold' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reqst Part</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.label}>Part *</Text>
          <View style={styles.inputDisabled}>
            <Text style={[styles.inputText, !partName && styles.placeholder]}>
              {partName || 'Select a part from catalog'}
            </Text>
            {/* If not pre-selected, could add a picker here, but for now we enforce catalog selection */}
          </View>
          {!partName && (
             <Text style={styles.helperText}>Go back to Catalog to select a part</Text>
          )}

          <Text style={styles.label}>Quantity *</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity 
              style={styles.qtyButton}
              onPress={() => {
                const val = parseInt(quantity) || 0;
                if (val > 1) setQuantity((val - 1).toString());
              }}
            >
              <FontAwesome5 name="minus" size={16} color={Colors.text} />
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              textAlign="center"
            />
            <TouchableOpacity 
              style={styles.qtyButton}
              onPress={() => {
                const val = parseInt(quantity) || 0;
                setQuantity((val + 1).toString());
              }}
            >
              <FontAwesome5 name="plus" size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.label}>Urgency *</Text>
          <View style={styles.urgencyGroup}>
            <UrgencyOption value="low" label="Low" color={Colors.success} />
            <UrgencyOption value="medium" label="Medium" color={Colors.primary} />
            <UrgencyOption value="high" label="High" color={Colors.warning} />
            <UrgencyOption value="critical" label="Critical" color={Colors.danger} />
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.label}>Site (Optional)</Text>
          <TextInput
            style={styles.input}
            value={site}
            onChangeText={setSite}
            placeholder="e.g. SITE-123"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Reason for request, special instructions..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || !partId}
        >
            Submit Request
        </Button>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputDisabled: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: Colors.background + '80', // Slightly transparent
  },
  inputText: {
    fontSize: 16,
    color: Colors.text,
  },
  placeholder: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  helperText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  qtyInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  urgencyGroup: {
    gap: 12,
  },
  urgencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urgencyText: {
    fontSize: 16,
    color: Colors.text,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
