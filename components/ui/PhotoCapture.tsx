import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { SERVER_URL } from '../../services/api';

const inferImageMimeType = (nameOrUri?: string, fallback: string = 'image/jpeg') => {
  const s = (nameOrUri || '').toLowerCase();
  if (s.endsWith('.png')) return 'image/png';
  if (s.endsWith('.webp')) return 'image/webp';
  if (s.endsWith('.gif')) return 'image/gif';
  if (s.endsWith('.bmp')) return 'image/bmp';
  if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
};

export interface PhotoAttachment {
  uri: string;
  name?: string;
  type?: string;
}

interface PhotoCaptureProps {
  label: string;
  photos: PhotoAttachment[];
  onAddPhoto: (photo: PhotoAttachment) => void;
  onRemovePhoto: (uri: string) => void;
  maxPhotos?: number;
  required?: boolean;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  label,
  photos,
  onAddPhoto,
  onRemovePhoto,
  maxPhotos = 10,
  required = false
}) => {
  const pickImage = async (useCamera: boolean) => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Limit Reached', `You can only upload up to ${maxPhotos} photos.`);
      return;
    }

    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: 0.7,
        });
      }

      if (!result.canceled) {
        result.assets.forEach((asset) => {
          const inferredName = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
            onAddPhoto({
                uri: asset.uri,
            name: inferredName,
            // expo-image-picker's `asset.type` is usually "image" not a mime type.
            // Prefer `asset.mimeType` when available, otherwise infer from filename.
            type: (asset as any).mimeType || inferImageMimeType(inferredName, 'image/jpeg')
            });
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={() => pickImage(true)}>
          <View style={[styles.iconCircle, { backgroundColor: '#e0f2fe' }]}>
            <Ionicons name="camera" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.actionText}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => pickImage(false)}>
          <View style={[styles.iconCircle, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="images" size={24} color={Colors.secondary} />
          </View>
          <Text style={[styles.actionText, { color: Colors.secondary }]}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image
                source={{
                  uri: photo.uri?.startsWith('/uploads') ? `${SERVER_URL}${photo.uri}` : photo.uri,
                }}
                style={styles.photo}
              />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => onRemovePhoto(photo.uri)}
              >
                <Ionicons name="close" size={12} color="white" />
              </TouchableOpacity>
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      
      {photos.length >= maxPhotos && (
        <Text style={styles.limitText}>Max photos reached ({maxPhotos})</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 12,
  },
  required: {
    color: Colors.danger,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    height: 100,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // red-500
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  indexBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  indexText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  limitText: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 8,
    textAlign: 'center',
  },
});
