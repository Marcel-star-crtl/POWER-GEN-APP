import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { format } from 'date-fns';
import { api, SERVER_URL } from '../../services/api';
import { ApiResponse } from '../../types/common.types';
import { Maintenance } from '../../types/maintenance.types';
import { Colors } from '../../constants/Colors';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const { width } = Dimensions.get('window');
const IMAGE_SIZE = (width - 48) / 2; // 2 images per row with padding

export default function TaskDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Maintenance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchTaskDetail(params.id);
    }
  }, [params.id]);

  const fetchTaskDetail = async (taskId: string) => {
    try {
      const response = await api.get<ApiResponse<Maintenance>>(`/technician/maintenance/${taskId}`);
      if (response.data.data) {
        setTask(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch task detail:', error);
      Alert.alert('Error', 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'completed': return Colors.success;
      case 'rejected': return Colors.danger;
      case 'pending_approval': return Colors.warning;
      case 'in_progress': return Colors.primary;
      case 'scheduled': return '#6366f1';
      default: return Colors.textSecondary;
    }
  };

  const handleStartWork = () => {
    if (task?.site_id) {
      router.push({
        pathname: '/(technician)/create-visit',
        params: {
          siteId: task.site_id,
          siteName: task.site_name || task.site_details?.Site_Name,
        },
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Badge */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(task.status) }]}>
          <Text style={styles.statusBannerText}>
            {task.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Site Information */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Site Information</Text>
          <View style={styles.infoRow}>
            <FontAwesome5 name="map-marker-alt" size={16} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Site Name</Text>
              <Text style={styles.infoValue}>
                {task.site_details?.Site_Name || task.site_name || task.site_id}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome5 name="map" size={16} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Region</Text>
              <Text style={styles.infoValue}>{task.site_details?.Region || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome5 name="building" size={16} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Cluster</Text>
              <Text style={styles.infoValue}>{task.site_metadata?.cluster || 'N/A'}</Text>
            </View>
          </View>
        </Card>

        {/* Visit Information */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Information</Text>
          <View style={styles.infoRow}>
            <FontAwesome5 name="tools" size={16} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Visit Type</Text>
              <Text style={styles.infoValue}>{task.visit_type}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome5 name="calendar-alt" size={16} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Scheduled Date</Text>
              <Text style={styles.infoValue}>
                {task.scheduled_date
                  ? format(new Date(task.scheduled_date), 'MMMM dd, yyyy')
                  : task.visit_date
                  ? format(new Date(task.visit_date), 'MMMM dd, yyyy')
                  : 'Not scheduled'}
              </Text>
            </View>
          </View>
          {task.hours_on_site && (
            <View style={styles.infoRow}>
              <FontAwesome5 name="clock" size={16} color={Colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Hours on Site</Text>
                <Text style={styles.infoValue}>{task.hours_on_site} hours</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Work Details */}
        {task.work_performed && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Work Performed</Text>
            <Text style={styles.workText}>{task.work_performed}</Text>
          </Card>
        )}

        {/* Issues Found */}
        {task.issues_found && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Issues Found</Text>
            {typeof task.issues_found === 'string' ? (
              <Text style={styles.workText}>{task.issues_found}</Text>
            ) : (
              <>
                {task.issues_found.DG_Issues && (
                  <View style={styles.issueItem}>
                    <Text style={styles.issueLabel}>Generator Issues:</Text>
                    <Text style={styles.issueText}>{task.issues_found.DG_Issues}</Text>
                  </View>
                )}
                {task.issues_found.Any_Other_Issue && (
                  <View style={styles.issueItem}>
                    <Text style={styles.issueLabel}>Other Issues:</Text>
                    <Text style={styles.issueText}>{task.issues_found.Any_Other_Issue}</Text>
                  </View>
                )}
              </>
            )}
          </Card>
        )}

        {/* Photos */}
        {task.photos && task.photos.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({task.photos.length})</Text>
            <View style={styles.photoGrid}>
              {task.photos.map((photo, index) => {
                const photoUrl = typeof photo === 'string' ? photo : photo.url;
                // Ensure URL is absolute
                const fullUrl = photoUrl.startsWith('http') 
                  ? photoUrl 
                  : `${SERVER_URL}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
                
                const photoCategory = typeof photo === 'object' ? photo.category : undefined;
                
                return (
                  <View key={`photo-${index}`} style={styles.photoItem}>
                    <Image
                      source={{ uri: fullUrl }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    {photoCategory && (
                      <View style={styles.photoLabel}>
                        <Text style={styles.photoLabelText}>{photoCategory}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Timestamps */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {task.submitted_at && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Submitted:</Text>
              <Text style={styles.timestampValue}>
                {format(new Date(task.submitted_at), 'MMM dd, yyyy HH:mm')}
              </Text>
            </View>
          )}
          {task.reviewed_at && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Reviewed:</Text>
              <Text style={styles.timestampValue}>
                {format(new Date(task.reviewed_at), 'MMM dd, yyyy HH:mm')}
              </Text>
            </View>
          )}
          {task.completed_at && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Completed:</Text>
              <Text style={styles.timestampValue}>
                {format(new Date(task.completed_at), 'MMM dd, yyyy HH:mm')}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Action Button */}
      {(task.status === 'scheduled' || task.status === 'approved' || task.status === 'in_progress') && (
        <View style={styles.footer}>
          <Button onPress={handleStartWork} style={styles.actionButton}>
            {task.status === 'in_progress' ? 'Continue Work' : 'Start Work'}
          </Button>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  statusBanner: {
    padding: 16,
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    margin: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  workText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  issueItem: {
    marginBottom: 12,
  },
  issueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  issueText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  photoItem: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.border,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
  },
  photoLabelText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timestampLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  timestampValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    width: '100%',
  },
});
