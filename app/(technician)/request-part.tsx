import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PhotoAttachment, PhotoCapture } from '../../components/ui/PhotoCapture';
import { submitOrQueue } from '../../services/offlineApi';

export default function RequestPartScreen() {
  const params = useLocalSearchParams<{ partId?: string; partName?: string }>();
  const [loading, setLoading] = useState(false);
  
  const [partId, setPartId] = useState(params.partId || '');
  const [partName, setPartName] = useState(params.partName || '');
  
  const [quantity, setQuantity] = useState('1');
  const [requestedTime, setRequestedTime] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

  const handleAddPhoto = (photo: PhotoAttachment) => {
    setPhotos((prev) => [...prev, photo]);
  };

  const handleRemovePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const handleSubmit = async () => {
    if (!partId) {
      Alert.alert('Error', 'Please select a part');
      return;
    }
    if (!quantity || !description) {
      Alert.alert('Error', 'Please provide quantity and reason');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        items: [{
          part: partId,
          part_name: partName,
          quantity: parseInt(quantity, 10)
        }],
        notes: description,
      };

      if (requestedTime) {
        payload.requested_time = requestedTime;
      }

      if (photos.length > 0) {
        // PartRequest.photos is declared as [String] (uploaded URLs), not objects.
        // Pass bare local URIs here — processAndUploadData collapses each
        // `file://`/`content://` string to its uploaded remote URL string in
        // place, matching the schema. (Passing {uri,name,type} objects instead
        // would survive the upload step as objects, not strings, and mismatch
        // the schema.)
        payload.photos = photos.map((p) => p.uri);
      }

      const result = await submitOrQueue('part_request', '/parts/requests', 'POST', payload);

      Alert.alert(
        'Success',
        result.queued
          ? 'No connection — request saved and will sync automatically.'
          : 'Part request submitted successfully',
        [{ text: 'OK', onPress: () => router.back() }],
      );
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
            const nextIndex = (options.indexOf(value) + 1) % options.length;
            onSelect(options[nextIndex] || options[0]);
        }}>
            <Text style={value ? styles.inputText : styles.placeholder}>
                {value || `Select ${label.toLowerCase()}`}
            </Text>
            <FontAwesome5 name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
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
            <Text style={styles.label}>Requested Time (optional)</Text>
            <TextInput
                style={styles.input}
                value={requestedTime}
                onChangeText={setRequestedTime}
                placeholder="YYYY-MM-DD HH:MM"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Reason <Text style={styles.required}>*</Text></Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="Explain why this part is needed..."
            />
          </View>

          <PhotoCapture
            label="Photos (optional)"
            photos={photos}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            maxPhotos={3}
          />
        </Card>

        <Button
            onPress={handleSubmit} 
            disabled={loading}
            loading={loading}
            style={styles.submitButton}
        >
            {loading ? "Submitting..." : "Submit Request"}
        </Button>
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
    backgroundColor: '#EFF6FF',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginBottom: 20,
  }
});









