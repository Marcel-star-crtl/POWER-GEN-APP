import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { api, SERVER_URL } from '../../services/api';
import { VisitFormData } from '../../types/visit.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';

export default function CreateVisit() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ siteId?: string; siteName?: string }>();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    site: true,
  });
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<Array<{ uri: string; category: 'before' | 'during' | 'after' | 'issue' | 'parts' | 'general'; description: string }>>([]); 
  const [sites, setSites] = useState<Array<{ IHS_ID_SITE: string; Site_Name: string }>>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSiteName, setSelectedSiteName] = useState<string | undefined>(undefined);
  
  // Form state
  const [siteId, setSiteId] = useState('');
  const [visitType, setVisitType] = useState<VisitFormData['visit_type']>('PM');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursOnSite, setHoursOnSite] = useState('');
  
  // Generator state
  const [genNumber, setGenNumber] = useState('');
  const [genBrand, setGenBrand] = useState('');
  const [genHourMeter, setGenHourMeter] = useState('');
  const [genComments, setGenComments] = useState('');
  
  // Fuel state
  const [fuelCardNumber, setFuelCardNumber] = useState('');
  const [qtyFound, setQtyFound] = useState('');
  const [qtyAdded, setQtyAdded] = useState('');
  const [qtyLeft, setQtyLeft] = useState('');
  
  // Electrical state
  const [eneoWorking, setEneoWorking] = useState<'Yes' | 'No' | null>(null);
  const [earthing, setEarthing] = useState('');
  const [ph1Voltage, setPh1Voltage] = useState('');
  const [ph2Voltage, setPh2Voltage] = useState('');
  const [ph3Voltage, setPh3Voltage] = useState('');
  
  // Work & Issues state
  const [workPerformed, setWorkPerformed] = useState('');
  const [genIssues, setGenIssues] = useState('');
  const [otherIssues, setOtherIssues] = useState('');

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    console.log('📋 Params received in create-visit:', params);
    if (params?.siteId && typeof params.siteId === 'string') {
      console.log('🔗 Setting siteId from params:', params.siteId);
      setSiteId(params.siteId);
    }
    if (params?.siteName && typeof params.siteName === 'string') {
      console.log('🔗 Setting siteName from params:', params.siteName);
      setSelectedSiteName(params.siteName);
    }
  }, [params]);

  const fetchSites = async () => {
    try {
      setLoadingSites(true);
      const response = await api.get('/technician/sites');
      console.log('✅ Sites loaded:', response.data);
      if (response.data.data) {
        setSites(response.data.data);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch sites:', error);
      console.error('Response:', error.response?.data);
      Alert.alert('Error', 'Failed to load sites list');
    } finally {
      setLoadingSites(false);
    }
  };

  const selectSite = (site: { IHS_ID_SITE: string; Site_Name: string }) => {
    // Deprecated: selection via modal. Kept for reference.
    setSiteId(site.IHS_ID_SITE);
    setSelectedSiteName(site.Site_Name);
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos');
      return false;
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    if (useCamera) {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: 0.7,
        });

    if (!result.canceled) {
      const newPhotos = result.assets.map((asset) => ({
        uri: asset.uri,
        category: 'general' as const,
        description: '',
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const buildFormData = (isDraft: boolean): Partial<VisitFormData> => {
    const formData: Partial<VisitFormData> = {
      site_id: siteId,
      visit_type: visitType,
      visit_date: new Date(visitDate),
    };

    if (hoursOnSite) formData.hours_on_site = parseFloat(hoursOnSite);

    // Add generator data if any field is filled
    if (genNumber || genBrand || genHourMeter || genComments) {
      formData.generators_checked = [{
        generator_number: genNumber ? parseInt(genNumber) : undefined,
        brand: genBrand || undefined,
        ch_actuel: genHourMeter ? parseFloat(genHourMeter) : undefined,
        comments_cph: genComments || undefined,
      }];
    }

    // Add fuel data if any field is filled
    if (fuelCardNumber || qtyFound || qtyAdded || qtyLeft) {
      formData.fuel_data = {
        fuel_card_number: fuelCardNumber || undefined,
        qte_trouvee: qtyFound ? parseFloat(qtyFound) : undefined,
        qte_ajoutee: qtyAdded ? parseFloat(qtyAdded) : undefined,
        qte_laissee: qtyLeft ? parseFloat(qtyLeft) : undefined,
      };
    }

    // Add electrical data if any field is filled
    if (eneoWorking || earthing || ph1Voltage || ph2Voltage || ph3Voltage) {
      formData.electrical_data = {
        eneo_working: eneoWorking || undefined,
        earthing_ohm: earthing ? parseFloat(earthing) : undefined,
        n_ph1_voltage: ph1Voltage ? parseFloat(ph1Voltage) : undefined,
        n_ph2_voltage: ph2Voltage ? parseFloat(ph2Voltage) : undefined,
        n_ph3_voltage: ph3Voltage ? parseFloat(ph3Voltage) : undefined,
      };
    }

    // Add work and issues if filled
    if (workPerformed) formData.work_performed = workPerformed;
    if (genIssues || otherIssues) {
      formData.issues_found = {
        DG_Issues: genIssues || undefined,
        Any_Other_Issue: otherIssues || undefined,
      };
    }

    if (photos.length > 0) {
      formData.photos = photos;
    }

    return formData;
  };

  const handleSaveDraft = async () => {
    if (!siteId || !visitType) {
      Alert.alert('Required Fields', 'Please fill in Site ID and Visit Type');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      
      const formData = new FormData();
      // Backend expects these field names
      formData.append('Actual_Date_Visit', visitDate);
      formData.append('Type_of_Visit', visitType);
      formData.append('technician_id', user.id);
      formData.append('submit_type', 'draft');
      
      // Optional fields
      if (hoursOnSite) {
        formData.append('hours_on_site', hoursOnSite);
      }
      if (workPerformed) {
        formData.append('work_performed', workPerformed);
      }

      // Add generator data if filled
      if (genNumber || genBrand || genHourMeter || genComments) {
        const generators = [{
          generator_number: genNumber ? parseInt(genNumber) : undefined,
          brand: genBrand || undefined,
          ch_actuel: genHourMeter ? parseFloat(genHourMeter) : undefined,
          comments_cph: genComments || undefined,
        }];
        formData.append('generators_checked', JSON.stringify(generators));
      }

      // Add fuel data if filled
      if (fuelCardNumber || qtyFound || qtyAdded || qtyLeft) {
        const fuelData = {
          fuel_card_number: fuelCardNumber || undefined,
          qte_trouvee: qtyFound ? parseFloat(qtyFound) : undefined,
          qte_ajoutee: qtyAdded ? parseFloat(qtyAdded) : undefined,
          qte_laissee: qtyLeft ? parseFloat(qtyLeft) : undefined,
        };
        formData.append('fuel_data', JSON.stringify(fuelData));
      }

      // Add electrical data if filled
      if (eneoWorking || earthing || ph1Voltage || ph2Voltage || ph3Voltage) {
        const electricalData = {
          eneo_working: eneoWorking || undefined,
          earthing_ohm: earthing ? parseFloat(earthing) : undefined,
          n_ph1_voltage: ph1Voltage ? parseFloat(ph1Voltage) : undefined,
          n_ph2_voltage: ph2Voltage ? parseFloat(ph2Voltage) : undefined,
          n_ph3_voltage: ph3Voltage ? parseFloat(ph3Voltage) : undefined,
        };
        formData.append('electrical_data', JSON.stringify(electricalData));
      }

      // Add issues if filled
      if (genIssues || otherIssues) {
        const issues = {
          DG_Issues: genIssues || undefined,
          Any_Other_Issue: otherIssues || undefined,
        };
        formData.append('Issues_Found', JSON.stringify(issues));
      }

      // Add photos
      photos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `photo_${index}.jpg`,
        } as any);
      });

      console.log('💾 Saving draft with correct field names');

      const response = await api.post(`/sites/${siteId}/visit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('✅ Draft saved:', response.data);
      Alert.alert('Success', 'Draft saved successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('❌ Failed to save draft:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log('📝 Submit attempt - Current state:');
    console.log('  siteId:', siteId);
    console.log('  visitType:', visitType);
    console.log('  selectedSiteName:', selectedSiteName);
    console.log('  user:', user);

    if (!siteId || !visitType) {
      console.log('❌ Validation failed:', { siteId: siteId || 'EMPTY', visitType: visitType || 'EMPTY' });
      Alert.alert('Required Fields', 'Please fill in Site ID and Visit Type');
      return;
    }

    if (!user?.id) {
      console.log('❌ User not authenticated');
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      // Backend expects these field names
      formData.append('Actual_Date_Visit', visitDate);
      formData.append('Type_of_Visit', visitType);
      formData.append('technician_id', user.id);
      formData.append('submit_type', 'submit');
      
      // Optional fields
      if (hoursOnSite) {
        formData.append('hours_on_site', hoursOnSite);
      }
      if (workPerformed) {
        formData.append('work_performed', workPerformed);
      }

      // Add generator data if filled
      if (genNumber || genBrand || genHourMeter || genComments) {
        const generators = [{
          generator_number: genNumber ? parseInt(genNumber) : undefined,
          brand: genBrand || undefined,
          ch_actuel: genHourMeter ? parseFloat(genHourMeter) : undefined,
          comments_cph: genComments || undefined,
        }];
        formData.append('generators_checked', JSON.stringify(generators));
      }

      // Add fuel data if filled
      if (fuelCardNumber || qtyFound || qtyAdded || qtyLeft) {
        const fuelData = {
          fuel_card_number: fuelCardNumber || undefined,
          qte_trouvee: qtyFound ? parseFloat(qtyFound) : undefined,
          qte_ajoutee: qtyAdded ? parseFloat(qtyAdded) : undefined,
          qte_laissee: qtyLeft ? parseFloat(qtyLeft) : undefined,
        };
        formData.append('fuel_data', JSON.stringify(fuelData));
      }

      // Add electrical data if filled
      if (eneoWorking || earthing || ph1Voltage || ph2Voltage || ph3Voltage) {
        const electricalData = {
          eneo_working: eneoWorking || undefined,
          earthing_ohm: earthing ? parseFloat(earthing) : undefined,
          n_ph1_voltage: ph1Voltage ? parseFloat(ph1Voltage) : undefined,
          n_ph2_voltage: ph2Voltage ? parseFloat(ph2Voltage) : undefined,
          n_ph3_voltage: ph3Voltage ? parseFloat(ph3Voltage) : undefined,
        };
        formData.append('electrical_data', JSON.stringify(electricalData));
      }

      // Add issues if filled
      if (genIssues || otherIssues) {
        const issues = {
          DG_Issues: genIssues || undefined,
          Any_Other_Issue: otherIssues || undefined,
        };
        formData.append('Issues_Found', JSON.stringify(issues));
      }

      // Add photos
      photos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          name: `photo_${index}.jpg`,
          type: 'image/jpeg',
        } as any);
      });

      console.log('📤 Submitting visit with correct field names');

      const response = await api.post(`/sites/${siteId}/visit`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Visit submitted successfully:', response.data);
      Alert.alert('Success', 'Visit submitted successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('❌ Failed to submit visit:', error);
      Alert.alert('Error', 'Failed to submit visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = (title: string, icon: string, sectionKey: string) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(sectionKey)}
    >
      <View style={styles.sectionHeaderLeft}>
        <FontAwesome5 name={icon} size={18} color={Colors.primary} style={styles.sectionIcon} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FontAwesome5
        name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={Colors.textSecondary}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Visit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Site Information */}
        <Card style={styles.section}>
          {renderSectionHeader('Site Information', 'map-marker-alt', 'site')}
          {expandedSections.site && (
            <View style={styles.sectionContent}>
              <Text style={styles.label}>Site ID / Name *</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerInput]}
                onPress={() => {
                  console.log('📋 Navigating to select-site screen...');
                  router.push('/(technician)/select-site');
                }}
              >
                <Text style={siteId ? styles.pickerText : styles.pickerPlaceholder}>
                  {siteId ? (
                    selectedSiteName || sites.find(s => s.IHS_ID_SITE === siteId)?.Site_Name || siteId
                  ) : (
                    'Select a site'
                  )}
                </Text>
                <FontAwesome5 name="chevron-down" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.label}>Visit Type *</Text>
              <View style={styles.chipContainer}>
                {(['PM', 'END', 'RF', 'PM+END', 'PM+RF', 'RF+END'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, visitType === type && styles.chipSelected]}
                    onPress={() => setVisitType(type)}
                  >
                    <Text style={[styles.chipText, visitType === type && styles.chipTextSelected]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Visit Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textSecondary}
                value={visitDate}
                onChangeText={setVisitDate}
              />

              <Text style={styles.label}>Hours on Site</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 3"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={hoursOnSite}
                onChangeText={setHoursOnSite}
              />
            </View>
          )}
        </Card>

        {/* Generator Check */}
        <Card style={styles.section}>
          {renderSectionHeader('Generator Check', 'cog', 'generator')}
          {expandedSections.generator && (
            <View style={styles.sectionContent}>
              <Text style={styles.helperText}>
                Fill this section if you inspected any generators
              </Text>

              <Text style={styles.label}>Generator Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={genNumber}
                onChangeText={setGenNumber}
              />

              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Caterpillar"
                placeholderTextColor={Colors.textSecondary}
                value={genBrand}
                onChangeText={setGenBrand}
              />

              <Text style={styles.label}>Hour Meter Reading (Current)</Text>
              <TextInput
                style={styles.input}
                placeholder="Current hour meter"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={genHourMeter}
                onChangeText={setGenHourMeter}
              />

              <Text style={styles.label}>Comments</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any observations or issues..."
                multiline
                numberOfLines={4}
                placeholderTextColor={Colors.textSecondary}
                value={genComments}
                onChangeText={setGenComments}
              />

              <TouchableOpacity style={styles.addButton}>
                <FontAwesome5 name="plus" size={16} color={Colors.primary} />
                <Text style={styles.addButtonText}>Add Another Generator</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Fuel Check */}
        <Card style={styles.section}>
          {renderSectionHeader('Fuel Check', 'gas-pump', 'fuel')}
          {expandedSections.fuel && (
            <View style={styles.sectionContent}>
              <Text style={styles.helperText}>
                Fill this section if you checked fuel levels
              </Text>

              <Text style={styles.label}>Fuel Card Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Card number"
                placeholderTextColor={Colors.textSecondary}
                value={fuelCardNumber}
                onChangeText={setFuelCardNumber}
              />

              <Text style={styles.label}>Quantity Found (Liters)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 500"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={qtyFound}
                onChangeText={setQtyFound}
              />

              <Text style={styles.label}>Quantity Added (Liters)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 200"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={qtyAdded}
                onChangeText={setQtyAdded}
              />

              <Text style={styles.label}>Quantity Left (Liters)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 700"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={qtyLeft}
                onChangeText={setQtyLeft}
              />
            </View>
          )}
        </Card>

        {/* Electrical Check */}
        <Card style={styles.section}>
          {renderSectionHeader('Electrical/Grid Check', 'bolt', 'electrical')}
          {expandedSections.electrical && (
            <View style={styles.sectionContent}>
              <Text style={styles.helperText}>
                Fill this section if you inspected electrical systems
              </Text>

              <Text style={styles.label}>ENEO Working?</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setEneoWorking('Yes')}
                >
                  <View style={[styles.radio, eneoWorking === 'Yes' && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setEneoWorking('No')}
                >
                  <View style={[styles.radio, eneoWorking === 'No' && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>No</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Earthing (Ohm)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 5.2"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={earthing}
                onChangeText={setEarthing}
              />

              <Text style={styles.label}>Phase 1 Voltage (V)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 230"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={ph1Voltage}
                onChangeText={setPh1Voltage}
              />

              <Text style={styles.label}>Phase 2 Voltage (V)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 230"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={ph2Voltage}
                onChangeText={setPh2Voltage}
              />

              <Text style={styles.label}>Phase 3 Voltage (V)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 230"
                keyboardType="numeric"
                placeholderTextColor={Colors.textSecondary}
                value={ph3Voltage}
                onChangeText={setPh3Voltage}
              />
            </View>
          )}
        </Card>

        {/* Issues & Work Performed */}
        <Card style={styles.section}>
          {renderSectionHeader('Issues & Work Performed', 'tools', 'work')}
          {expandedSections.work && (
            <View style={styles.sectionContent}>
              <Text style={styles.label}>Work Performed</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what you did during this visit..."
                multiline
                numberOfLines={4}
                placeholderTextColor={Colors.textSecondary}
                value={workPerformed}
                onChangeText={setWorkPerformed}
              />

              <Text style={styles.label}>Generator Issues</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any issues found with generators..."
                multiline
                numberOfLines={3}
                placeholderTextColor={Colors.textSecondary}
                value={genIssues}
                onChangeText={setGenIssues}
              />

              <Text style={styles.label}>Other Issues</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any other issues encountered..."
                multiline
                numberOfLines={3}
                placeholderTextColor={Colors.textSecondary}
                value={otherIssues}
                onChangeText={setOtherIssues}
              />
            </View>
          )}
        </Card>

        {/* Photos */}
        <Card style={styles.section}>
          {renderSectionHeader('Photos', 'camera', 'photos')}
          {expandedSections.photos && (
            <View style={styles.sectionContent}>
              <Text style={styles.helperText}>
                Upload photos of site conditions, issues, or completed work
              </Text>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage(true)}
              >
                <FontAwesome5 name="camera" size={32} color={Colors.primary} />
                <Text style={styles.uploadButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, { marginTop: 12 }]}
                onPress={() => pickImage(false)}
              >
                <FontAwesome5 name="images" size={32} color={Colors.primary} />
                <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>

              {photos.length > 0 && (
                <View style={styles.photoGrid}>
                  {photos.map((photo, index) => (
                    <View key={`photo-${index}-${photo.uri}`} style={styles.photoItem}>
                      <Image
                        source={{
                          uri: photo.uri?.startsWith('/uploads') ? `${SERVER_URL}${photo.uri}` : photo.uri,
                        }}
                        style={styles.photoPreview}
                      />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <FontAwesome5 name="times" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Site selection now handled by separate mini page */}

      <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 24) }]}>
        <Button
          variant="outline"
          onPress={handleSaveDraft}
          style={styles.footerButton}
          disabled={loading}
        >
          Save Draft
        </Button>
        <Button
          onPress={handleSubmit}
          style={styles.footerButton}
          loading={loading}
          disabled={loading}
        >
          Submit Visit
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
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 180,
  },
  section: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
  pickerInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: 8,
  },
  radioSelected: {
    backgroundColor: Colors.primary,
    borderWidth: 6,
  },
  radioLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: Colors.background,
  },
  uploadButtonText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  photoItem: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  siteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  siteItemSelected: {
    backgroundColor: Colors.primary + '15',
  },
  siteItemContent: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  siteNameSelected: {
    color: Colors.primary,
  },
  siteId: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  siteIdSelected: {
    color: Colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  footerButton: {
    flex: 1,
  },
});
