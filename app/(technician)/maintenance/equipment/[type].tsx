// app/(technician)/maintenance/equipment/[type].tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../../../constants/Colors';
import { FormSection } from '../../../../components/ui/FormSection';
import { InputField } from '../../../../components/ui/InputField';
import { StatusToggle } from '../../../../components/ui/StatusToggle';
import { PhotoCapture, PhotoAttachment } from '../../../../components/ui/PhotoCapture';
import { ProgressIndicator } from '../../../../components/ui/ProgressIndicator';
import { api, uploadAPI } from '../../../../services/api';

const EQUIPMENT_TITLES: { [key: string]: string } = {
  generator: 'Generator Check',
  power_cabinet: 'Power Cabinet',
  grid: 'Grid Power',
  shelter: 'Shelter Inspection',
  fuel_tank: 'Fuel Tank',
  cleaning: 'Site Cleaning'
};

/* --- Sub-Components for each Form Type --- */

const GeneratorForm = ({
    onUpdate,
    siteId,
    value,
    hydrateKey,
}: {
    onUpdate: (data: any) => void;
    siteId?: string;
    value?: any;
    hydrateKey?: number;
}) => {
    const getDefaultData = () => ({
    batteryStatus: null,
    fanBeltStatus: null,
    radiatorStatus: null,
    coolantStatus: null,
    i1: '', i2: '', i3: '',
    v1: '', v2: '', v3: '',
    comments: '',
    photos: [] as PhotoAttachment[]
    });

    const [data, setData] = useState(getDefaultData());
  
  const [generators, setGenerators] = useState<any[]>([]);
  const [selectedGenerator, setSelectedGenerator] = useState<any>(null);
  const [loadingGenerators, setLoadingGenerators] = useState(false);

  const fetchGenerators = useCallback(async () => {
    if (!siteId) return;
    
    try {
      setLoadingGenerators(true);
      const response = await api.get(`/sites/${siteId}`);
      const siteData = response.data.data;
      
      if (siteData?.Current_Generators && Array.isArray(siteData.Current_Generators)) {
        setGenerators(siteData.Current_Generators);
        // Auto-select first generator if available
        if (siteData.Current_Generators.length > 0) {
          setSelectedGenerator(siteData.Current_Generators[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching generators:', error);
    } finally {
      setLoadingGenerators(false);
    }
  }, [siteId]);

  // Fetch generators for this site
  useEffect(() => {
    fetchGenerators();
  }, [fetchGenerators]);

    // Rehydrate local state when parent loads draft/server data.
    useEffect(() => {
        if (!hydrateKey) return;
        if (!value || typeof value !== 'object') return;

        const v: any = value;
        const incomingPhotos: any[] = Array.isArray(v.photos) ? v.photos : [];
        const photos: PhotoAttachment[] = incomingPhotos
            .map((p: any) => {
                if (!p) return null;
                if (typeof p === 'string') {
                    const uri = p;
                    const name = uri.split('/').pop() || 'photo.jpg';
                    const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                    return { uri, name, type } as PhotoAttachment;
                }
                if (typeof p === 'object' && typeof p.uri === 'string') return p as PhotoAttachment;
                return null;
            })
            .filter(Boolean) as PhotoAttachment[];

        setData({
            ...getDefaultData(),
            ...v,
            photos,
        });
    }, [hydrateKey]);

  const update = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  const getPhotos = (tag: string) => data.photos.filter(p => p.name?.startsWith(tag));
  const addPhoto = (p: PhotoAttachment, tag: string) => update('photos', [...data.photos, { ...p, name: `${tag}_${p.name || 'photo'}` }]);
  const removePhoto = (uri: string) => update('photos', data.photos.filter(p => p.uri !== uri));

  return (
    <>
      <View style={styles.infoCard}>
         <View style={styles.infoHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.iconContainer}>
                    <Ionicons name="information" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.infoTitle}>Equipment Information</Text>
            </View>
         </View>
         
         {loadingGenerators ? (
           <View style={{ alignItems: 'center', paddingVertical: 16 }}>
             <Text style={{ color: Colors.textSecondary }}>Loading generators...</Text>
           </View>
         ) : generators.length === 0 ? (
           <View style={{ paddingVertical: 16, alignItems: 'center', gap: 12 }}>
             <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>
               No generators found for this site
             </Text>
             <TouchableOpacity 
                onPress={fetchGenerators}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8 }}
             >
                <Ionicons name="refresh" size={16} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '500' }}>Retry</Text>
             </TouchableOpacity>
           </View>
         ) : (
           <>
             {generators.length > 1 && (
               <View style={{ marginBottom: 16 }}>
                 <Text style={{ fontSize: 14, color: Colors.textSecondary, marginBottom: 8 }}>
                   Select Generator
                 </Text>
                 <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                   {generators.map((gen, idx) => (
                     <TouchableOpacity
                       key={gen._id || idx}
                       style={{
                         paddingHorizontal: 16,
                         paddingVertical: 8,
                         borderRadius: 8,
                         borderWidth: 1,
                         borderColor: selectedGenerator?._id === gen._id ? Colors.primary : Colors.border,
                         backgroundColor: selectedGenerator?._id === gen._id ? Colors.primary + '20' : Colors.surface,
                       }}
                       onPress={() => setSelectedGenerator(gen)}
                     >
                       <Text style={{
                         color: selectedGenerator?._id === gen._id ? Colors.primary : Colors.text,
                         fontWeight: selectedGenerator?._id === gen._id ? '600' : '400',
                       }}>
                         {gen.model || `Generator ${idx + 1}`}
                       </Text>
                     </TouchableOpacity>
                   ))}
                 </View>
               </View>
             )}
             
             <View style={styles.infoGrid}>
               <View style={styles.infoItem}>
                 <Text style={styles.infoLabel}>Equipment ID</Text>
                 <Text style={styles.infoValue}>{selectedGenerator?._id || 'N/A'}</Text>
               </View>
               <View style={styles.infoItem}>
                 <Text style={styles.infoLabel}>Model</Text>
                 <Text style={styles.infoValue}>{selectedGenerator?.model || 'N/A'}</Text>
               </View>
               <View style={styles.infoItem}>
                 <Text style={styles.infoLabel}>Serial Number</Text>
                 <Text style={styles.infoValue}>{selectedGenerator?.serial_number || 'N/A'}</Text>
               </View>
               <View style={styles.infoItem}>
                 <Text style={styles.infoLabel}>Status</Text>
                 <Text style={styles.infoValue}>{selectedGenerator?.status || 'N/A'}</Text>
               </View>
               {selectedGenerator?.specifications && (
                 <>
                   <View style={styles.infoItem}>
                     <Text style={styles.infoLabel}>Capacity</Text>
                     <Text style={styles.infoValue}>
                       {selectedGenerator.specifications.rated_power_kw || 'N/A'} kW
                     </Text>
                   </View>
                   <View style={styles.infoItem}>
                     <Text style={styles.infoLabel}>Fuel Type</Text>
                     <Text style={styles.infoValue}>
                       {selectedGenerator.specifications.fuel_type || 'N/A'}
                     </Text>
                   </View>
                 </>
               )}
             </View>
           </>
         )}
      </View>

      <FormSection title="Equipment Status" icon="checkmark-circle-outline">
        <StatusToggle 
            label="Battery" 
            value={data.batteryStatus} 
            onChange={(v) => update('batteryStatus', v)} 
            warningLevel="critical" 
            required
        />
        <StatusToggle 
            label="Fan Belt" 
            value={data.fanBeltStatus} 
            onChange={(v) => update('fanBeltStatus', v)} 
            warningLevel="warning"
            required
        />
        <StatusToggle 
            label="Radiator" 
            value={data.radiatorStatus} 
            onChange={(v) => update('radiatorStatus', v)} 
            warningLevel="critical"
            required
        />
        <StatusToggle 
            label="Coolant Fluid" 
            value={data.coolantStatus} 
            onChange={(v) => update('coolantStatus', v)} 
            warningLevel="warning"
            required
        />
      </FormSection>

      <FormSection title="Current Readings" icon="speedometer-outline">
        <View style={styles.readingCard}>
            <InputField label="Current I1" value={data.i1} onChangeText={(v) => update('i1', v)} unit="A" keyboardType="numeric" required />
            <PhotoCapture 
                label="Photo of I1 Reading" 
                photos={getPhotos('I1')} 
                onAddPhoto={(p) => addPhoto(p, 'I1')} 
                onRemovePhoto={removePhoto}
                maxPhotos={1}
                required
            />
        </View>

        <View style={styles.readingCard}>
            <InputField label="Current I2" value={data.i2} onChangeText={(v) => update('i2', v)} unit="A" keyboardType="numeric" required />
            <PhotoCapture 
                label="Photo of I2 Reading" 
                photos={getPhotos('I2')} 
                onAddPhoto={(p) => addPhoto(p, 'I2')} 
                onRemovePhoto={removePhoto}
                maxPhotos={1}
                required
            />
        </View>

        <View style={styles.readingCard}>
            <InputField label="Current I3" value={data.i3} onChangeText={(v) => update('i3', v)} unit="A" keyboardType="numeric" required />
            <PhotoCapture 
                label="Photo of I3 Reading" 
                photos={getPhotos('I3')} 
                onAddPhoto={(p) => addPhoto(p, 'I3')} 
                onRemovePhoto={removePhoto}
                maxPhotos={1}
                required
            />
        </View>
      </FormSection>

      <FormSection title="Voltage Readings" icon="flash-outline">
        <View style={styles.readingCard}>
            <InputField label="Voltage V1" value={data.v1} onChangeText={(v) => update('v1', v)} unit="V" keyboardType="numeric" required />
            <PhotoCapture 
                label="Photo of V1 Reading" 
                photos={getPhotos('V1')} 
                onAddPhoto={(p) => addPhoto(p, 'V1')} 
                onRemovePhoto={removePhoto}
                maxPhotos={1}
                required
            />
        </View>

        <View style={styles.readingCard}>
            <InputField label="Voltage V2" value={data.v2} onChangeText={(v) => update('v2', v)} unit="V" keyboardType="numeric" required />
            <PhotoCapture 
                label="Photo of V2 Reading" 
                photos={getPhotos('V2')} 
                onAddPhoto={(p) => addPhoto(p, 'V2')} 
                onRemovePhoto={removePhoto}
                maxPhotos={1}
                required
            />
        </View>

        <View style={styles.readingCard}>
            <InputField label="Voltage V3" value={data.v3} onChangeText={(v) => update('v3', v)} unit="V" keyboardType="numeric" required />
            <PhotoCapture 
                label="Photo of V3 Reading" 
                photos={getPhotos('V3')} 
                onAddPhoto={(p) => addPhoto(p, 'V3')} 
                onRemovePhoto={removePhoto}
                maxPhotos={1}
                required
            />
        </View>
      </FormSection>
      
      <FormSection title="Additional Notes" icon="create-outline">
        <InputField 
            label="" 
            placeholder="Any additional observations, anomalies, or recommendations..."
            value={data.comments} 
            onChangeText={(v) => update('comments', v)} 
            multiline 
            numberOfLines={4} 
            style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      </FormSection>
    </>
  );
};

const PowerCabinetForm = ({ onUpdate }: { onUpdate: (data: any) => void }) => {
  const [activeTab, setActiveTab] = useState('Rectifier');
  const [numRectifiers, setNumRectifiers] = useState('2');
  const [numBatteries, setNumBatteries] = useState('3');
  
  const [rectifiers, setRectifiers] = useState<any[]>(Array(2).fill({ status: null, cleanliness: null, capacitor: '', comments: '', photos: [] }));
  const [batteries, setBatteries] = useState<any[]>(Array(3).fill({ brand: '', autonomy: '', capacity: '' }));
  
  const [cooling, setCooling] = useState({ status: null });
  const [controller, setController] = useState({ status: null });

  // Update logic for dynamic lists
  useEffect(() => {
    const n = parseInt(numRectifiers) || 0;
    if (n !== rectifiers.length) {
        const newArr = [...rectifiers];
        if (n > rectifiers.length) {
            for(let i=rectifiers.length; i<n; i++) newArr.push({ status: null, cleanliness: null, capacitor: '', comments: '', photos: [] });
        } else {
            newArr.splice(n);
        }
        setRectifiers(newArr);
    }
  }, [numRectifiers, rectifiers]);

  useEffect(() => {
    const n = parseInt(numBatteries) || 0;
    if (n !== batteries.length) {
        const newArr = [...batteries];
        if (n > batteries.length) {
             for(let i=batteries.length; i<n; i++) newArr.push({ brand: '', autonomy: '', capacity: '' });
        } else {
            newArr.splice(n);
        }
        setBatteries(newArr);
    }
  }, [numBatteries, batteries]);
  
  // Propagate changes
  useEffect(() => {
    onUpdate({
        rectifiers, 
        batteries, 
        cooling, 
        controller,
        numRectifiers, 
        numBatteries
    });
  }, [rectifiers, batteries, cooling, controller, numRectifiers, numBatteries, onUpdate]);

  const updateRectifier = (index: number, key: string, value: any) => {
    const newArr = [...rectifiers];
    newArr[index] = { ...newArr[index], [key]: value };
    setRectifiers(newArr);
  };
  
  const addRectPhoto = (index: number, p: PhotoAttachment) => {
      const newArr = [...rectifiers];
      newArr[index].photos = [...(newArr[index].photos || []), p];
      setRectifiers(newArr);
  }
  
  const removeRectPhoto = (index: number, uri: string) => {
      const newArr = [...rectifiers];
      newArr[index].photos = newArr[index].photos.filter((p: PhotoAttachment) => p.uri !== uri);
      setRectifiers(newArr);
  }

  const updateBattery = (index: number, key: string, value: any) => {
    const newArr = [...batteries];
    newArr[index] = { ...newArr[index], [key]: value };
    setBatteries(newArr);
  };

  const tabs = [
      { id: 'Rectifier', icon: 'flash' },
      { id: 'Battery', icon: 'battery-full' },
      { id: 'Cooling', icon: 'snow' },
      { id: 'Controller', icon: 'speedometer' }
  ];

  return (
    <>
      <View style={styles.infoCard}>
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.iconContainer, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="battery-charging" size={24} color="#a855f7" />
            </View>
            <View>
                <Text style={styles.infoTitle}>Cabinet Info</Text>
                <Text style={styles.infoValue}>PC-001-A • Alpha Power 48V</Text>
            </View>
         </View>
      </View>

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
            <TouchableOpacity 
                key={tab.id} 
                style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                onPress={() => setActiveTab(tab.id)}
            >
                <Ionicons 
                    name={tab.icon as any} 
                    size={20} 
                    color={activeTab === tab.id ? Colors.primary : Colors.textSecondary} 
                    style={{ marginBottom: 4 }}
                />
                <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.id}</Text>
            </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'Rectifier' && (
            <>
                <FormSection title="Configuration" icon="settings-outline">
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 16, color: Colors.text }}>Number of Rectifiers</Text>
                        <TextInput 
                            value={numRectifiers}
                            onChangeText={setNumRectifiers}
                            keyboardType="numeric"
                            style={{ 
                                borderWidth: 1, 
                                borderColor: Colors.border, 
                                borderRadius: 8, 
                                paddingHorizontal: 16, 
                                paddingVertical: 8,
                                width: 80,
                                textAlign: 'center',
                                backgroundColor: 'white',
                                fontSize: 16,
                                fontWeight: '600'
                            }}
                        />
                        <Text style={{ color: Colors.textSecondary, fontSize: 12 }}> (editable)</Text>
                    </View>
                </FormSection>

                {rectifiers.map((rect, index) => (
                    <FormSection key={index} title={`Rectifier ${index + 1}`}>
                        <StatusToggle 
                            label="Status" 
                            value={rect.status} 
                            onChange={(v) => updateRectifier(index, 'status', v)} 
                            required 
                        />
                        <StatusToggle 
                            label="Cleanliness" 
                            value={rect.cleanliness} 
                            onChange={(v) => updateRectifier(index, 'cleanliness', v)} 
                            required 
                        />
                        <InputField 
                            label="Capacitor" 
                            value={rect.capacitor} 
                            onChangeText={(v) => updateRectifier(index, 'capacitor', v)} 
                            unit="kW" 
                            keyboardType="numeric" 
                            required 
                        />
                        <PhotoCapture 
                            label="Capacitor Photo" 
                            photos={rect.photos || []} 
                            onAddPhoto={(p) => addRectPhoto(index, p)} 
                            onRemovePhoto={(uri) => removeRectPhoto(index, uri)} 
                            required 
                            maxPhotos={1}
                        />
                        <InputField 
                            label="Comments" 
                            placeholder="Observations for this rectifier..."
                            value={rect.comments} 
                            onChangeText={(v) => updateRectifier(index, 'comments', v)} 
                            multiline 
                        />
                    </FormSection>
                ))}
            </>
        )}
        
        {activeTab === 'Battery' && (
            <>
                <FormSection title="Configuration" icon="settings-outline">
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 16, color: Colors.text }}>Number of Batteries</Text>
                        <TextInput 
                            value={numBatteries}
                            onChangeText={setNumBatteries}
                            keyboardType="numeric"
                            style={{ 
                                borderWidth: 1, 
                                borderColor: Colors.border, 
                                borderRadius: 8, 
                                paddingHorizontal: 16, 
                                paddingVertical: 8,
                                width: 80,
                                textAlign: 'center',
                                backgroundColor: 'white',
                                fontSize: 16,
                                fontWeight: '600'
                            }}
                        />
                        <Text style={{ color: Colors.textSecondary, fontSize: 12 }}> (editable)</Text>
                    </View>
                </FormSection>

                {batteries.map((batt, index) => (
                    <FormSection key={index} title={`Battery ${index + 1}`}>
                        <InputField 
                            label="Brand" 
                            placeholder="e.g., Samsung"
                            value={batt.brand} 
                            onChangeText={(v) => updateBattery(index, 'brand', v)} 
                            required 
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <InputField 
                                    label="Autonomy" 
                                    value={batt.autonomy} 
                                    onChangeText={(v) => updateBattery(index, 'autonomy', v)} 
                                    unit="hrs" 
                                    keyboardType="numeric" 
                                    required 
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <InputField 
                                    label="Capacity" 
                                    value={batt.capacity} 
                                    onChangeText={(v) => updateBattery(index, 'capacity', v)} 
                                    unit="Ah" 
                                    keyboardType="numeric" 
                                    required 
                                />
                            </View>
                        </View>
                    </FormSection>
                ))}
            </>
        )}
        
         {activeTab === 'Cooling' && (
            <FormSection title="Cooling System" icon="snow-outline">
                <StatusToggle 
                    label="Cooling System Status" 
                    value={cooling.status} 
                    onChange={(v) => setCooling({...cooling, status: v})} 
                    warningLevel="critical" 
                    required
                />
                 <InputField 
                    label="Comments" 
                    placeholder="Describe cooling system condition, fan operation, temperature..."
                    value={cooling.comments} 
                    onChangeText={(v) => setCooling({...cooling, comments: v})} 
                    multiline 
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
            </FormSection>
        )}
        
        {activeTab === 'Controller' && (
            <FormSection title="Controller Check" icon="speedometer-outline">
                <StatusToggle 
                    label="Controller Status" 
                    value={controller.status} 
                    onChange={(v) => setController({...controller, status: v})} 
                    warningLevel="critical" 
                    required
                />
                 <InputField 
                    label="Comments" 
                    placeholder="Describe controller display clarity, buttons responsiveness..."
                    value={controller.comments} 
                    onChangeText={(v) => setController({...controller, comments: v})} 
                    multiline 
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
            </FormSection>
        )}
      </View>
    </>
  );
};

const PowerCabinetFormWithHydration = ({
    onUpdate,
    value,
    hydrateKey,
}: {
    onUpdate: (data: any) => void;
    value?: any;
    hydrateKey?: number;
}) => {
    const [activeTab, setActiveTab] = useState('Rectifier');
    const [numRectifiers, setNumRectifiers] = useState('2');
    const [numBatteries, setNumBatteries] = useState('3');

    const [rectifiers, setRectifiers] = useState<any[]>(Array(2).fill({ status: null, cleanliness: null, capacitor: '', comments: '', photos: [] }));
    const [batteries, setBatteries] = useState<any[]>(Array(3).fill({ brand: '', autonomy: '', capacity: '' }));

    const [cooling, setCooling] = useState({ status: null });
    const [controller, setController] = useState({ status: null });

    useEffect(() => {
        if (!hydrateKey) return;
        if (!value || typeof value !== 'object') return;
        const v: any = value;
        setNumRectifiers(v.numRectifiers ? String(v.numRectifiers) : String((v.rectifiers || []).length || 0));
        setNumBatteries(v.numBatteries ? String(v.numBatteries) : String((v.batteries || []).length || 0));

        setRectifiers(Array.isArray(v.rectifiers) ? v.rectifiers.map((r: any) => ({
            status: r.status ?? null,
            cleanliness: r.cleanliness ?? null,
            capacitor: r.capacitor ?? '',
            comments: r.comments ?? '',
            photos: Array.isArray(r.photos) ? r.photos.map((p: any) => (typeof p === 'string' ? { uri: p, name: p.split('/').pop() } : p)) : []
        })) : []);

        setBatteries(Array.isArray(v.batteries) ? v.batteries.map((b: any) => ({
            brand: b.brand ?? '',
            autonomy: b.autonomy ?? '',
            capacity: b.capacity ?? ''
        })) : []);

        setCooling(v.cooling ?? { status: null, comments: '' });
        setController(v.controller ?? { status: null, comments: '' });
    }, [hydrateKey]);

    // keep same update helpers as original component
    useEffect(() => {
        const n = parseInt(numRectifiers) || 0;
        if (n !== rectifiers.length) {
            const newArr = [...rectifiers];
            if (n > rectifiers.length) {
                for(let i=rectifiers.length; i<n; i++) newArr.push({ status: null, cleanliness: null, capacitor: '', comments: '', photos: [] });
            } else {
                newArr.splice(n);
            }
            setRectifiers(newArr);
        }
    }, [numRectifiers]);

    useEffect(() => {
        const n = parseInt(numBatteries) || 0;
        if (n !== batteries.length) {
            const newArr = [...batteries];
            if (n > batteries.length) {
                 for(let i=batteries.length; i<n; i++) newArr.push({ brand: '', autonomy: '', capacity: '' });
            } else {
                newArr.splice(n);
            }
            setBatteries(newArr);
        }
    }, [numBatteries]);

    useEffect(() => {
        onUpdate({ rectifiers, batteries, cooling, controller, numRectifiers, numBatteries });
    }, [rectifiers, batteries, cooling, controller, numRectifiers, numBatteries, onUpdate]);

    const updateRectifier = (index: number, key: string, value: any) => {
        const newArr = [...rectifiers];
        newArr[index] = { ...newArr[index], [key]: value };
        setRectifiers(newArr);
    };

    const addRectPhoto = (index: number, p: PhotoAttachment) => {
        const newArr = [...rectifiers];
        newArr[index].photos = [...(newArr[index].photos || []), p];
        setRectifiers(newArr);
    };

    const removeRectPhoto = (index: number, uri: string) => {
        const newArr = [...rectifiers];
        newArr[index].photos = newArr[index].photos.filter((p: PhotoAttachment) => p.uri !== uri);
        setRectifiers(newArr);
    };

    const updateBattery = (index: number, key: string, value: any) => {
        const newArr = [...batteries];
        newArr[index] = { ...newArr[index], [key]: value };
        setBatteries(newArr);
    };

    const tabs = [
        { id: 'Rectifier', icon: 'flash' },
        { id: 'Battery', icon: 'battery-full' },
        { id: 'Cooling', icon: 'snow' },
        { id: 'Controller', icon: 'speedometer' }
    ];

    return (
        <>
            <View style={styles.infoCard}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.iconContainer, { backgroundColor: '#f3e8ff' }]}>
                      <Ionicons name="battery-charging" size={24} color="#a855f7" />
                  </View>
                  <View>
                      <Text style={styles.infoTitle}>Cabinet Info</Text>
                      <Text style={styles.infoValue}>PC-001-A • Alpha Power 48V</Text>
                  </View>
               </View>
            </View>

            <View style={styles.tabContainer}>
              {tabs.map((tab) => (
                  <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.activeTab]} onPress={() => setActiveTab(tab.id)}>
                      <Ionicons name={tab.icon as any} size={20} color={activeTab === tab.id ? Colors.primary : Colors.textSecondary} style={{ marginBottom: 4 }} />
                      <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.id}</Text>
                  </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tabContent}>
              {activeTab === 'Rectifier' && (
                <>
                  <FormSection title="Configuration" icon="settings-outline">
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 16, color: Colors.text }}>Number of Rectifiers</Text>
                          <TextInput value={numRectifiers} onChangeText={setNumRectifiers} keyboardType="numeric" style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, width: 80, textAlign: 'center', backgroundColor: 'white', fontSize: 16, fontWeight: '600' }} />
                          <Text style={{ color: Colors.textSecondary, fontSize: 12 }}> (editable)</Text>
                      </View>
                  </FormSection>

                  {rectifiers.map((rect, index) => (
                      <FormSection key={index} title={`Rectifier ${index + 1}`}>
                          <StatusToggle label="Status" value={rect.status} onChange={(v) => updateRectifier(index, 'status', v)} required />
                          <StatusToggle label="Cleanliness" value={rect.cleanliness} onChange={(v) => updateRectifier(index, 'cleanliness', v)} required />
                          <InputField label="Capacitor" value={rect.capacitor} onChangeText={(v) => updateRectifier(index, 'capacitor', v)} unit="kW" keyboardType="numeric" required />
                          <PhotoCapture label="Capacitor Photo" photos={rect.photos || []} onAddPhoto={(p) => addRectPhoto(index, p)} onRemovePhoto={(uri) => removeRectPhoto(index, uri)} required maxPhotos={1} />
                          <InputField label="Comments" placeholder="Observations for this rectifier..." value={rect.comments} onChangeText={(v) => updateRectifier(index, 'comments', v)} multiline />
                      </FormSection>
                  ))}
                </>
              )}

              {activeTab === 'Battery' && (
                <>
                  <FormSection title="Configuration" icon="settings-outline">
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 16, color: Colors.text }}>Number of Batteries</Text>
                          <TextInput value={numBatteries} onChangeText={setNumBatteries} keyboardType="numeric" style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, width: 80, textAlign: 'center', backgroundColor: 'white', fontSize: 16, fontWeight: '600' }} />
                          <Text style={{ color: Colors.textSecondary, fontSize: 12 }}> (editable)</Text>
                      </View>
                  </FormSection>

                  {batteries.map((batt, index) => (
                      <FormSection key={index} title={`Battery ${index + 1}`}>
                          <InputField label="Brand" placeholder="e.g., Samsung" value={batt.brand} onChangeText={(v) => updateBattery(index, 'brand', v)} required />
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                              <View style={{ flex: 1 }}>
                                  <InputField label="Autonomy" value={batt.autonomy} onChangeText={(v) => updateBattery(index, 'autonomy', v)} unit="hrs" keyboardType="numeric" required />
                              </View>
                              <View style={{ flex: 1 }}>
                                  <InputField label="Capacity" value={batt.capacity} onChangeText={(v) => updateBattery(index, 'capacity', v)} unit="Ah" keyboardType="numeric" required />
                              </View>
                          </View>
                      </FormSection>
                  ))}
                </>
              )}

              {activeTab === 'Cooling' && (
                <FormSection title="Cooling System" icon="snow-outline">
                    <StatusToggle label="Cooling System Status" value={cooling.status} onChange={(v) => setCooling({...cooling, status: v})} warningLevel="critical" required />
                     <InputField label="Comments" placeholder="Describe cooling system condition, fan operation, temperature..." value={cooling.comments} onChangeText={(v) => setCooling({...cooling, comments: v})} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: 'top' }} />
                </FormSection>
              )}

              {activeTab === 'Controller' && (
                <FormSection title="Controller Check" icon="speedometer-outline">
                    <StatusToggle label="Controller Status" value={controller.status} onChange={(v) => setController({...controller, status: v})} warningLevel="critical" required />
                     <InputField label="Comments" placeholder="Describe controller display clarity, buttons responsiveness..." value={controller.comments} onChangeText={(v) => setController({...controller, comments: v})} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: 'top' }} />
                </FormSection>
              )}
            </View>
        </>
    );
};

const GridForm = ({ onUpdate }: { onUpdate: (data: any) => void }) => {
    const [data, setData] = useState({
        gridStatus: null,
        breakerStatus: null,
        photos: [] as PhotoAttachment[]
    });

    // NOTE: This form can be rehydrated by the parent when revisiting.

    const update = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        setData(newData);
        onUpdate(newData);
    };

    return (
        <>
            <FormSection title="Grid Meter" icon="image">
                <PhotoCapture label="Grid Meter Photos" photos={data.photos} onAddPhoto={(p) => update('photos', [...data.photos, p])} onRemovePhoto={(uri) => update('photos', data.photos.filter(p => p.uri !== uri))} />
            </FormSection>
            <FormSection title="Status" icon="flash">
                <StatusToggle label="Grid Status" value={data.gridStatus} onChange={(v) => update('gridStatus', v)} warningLevel="critical" />
                <StatusToggle label="Grid Breaker" value={data.breakerStatus} onChange={(v) => update('breakerStatus', v)} />
            </FormSection>
        </>
    )
}

const GridFormWithHydration = ({
    onUpdate,
    value,
    hydrateKey,
}: {
    onUpdate: (data: any) => void;
    value?: any;
    hydrateKey?: number;
}) => {
    const [data, setData] = useState({
        gridStatus: null,
        breakerStatus: null,
        photos: [] as PhotoAttachment[],
    });

    useEffect(() => {
        if (!hydrateKey) return;
        if (!value || typeof value !== 'object') return;
        const v: any = value;
        const incomingPhotos: any[] = Array.isArray(v.photos) ? v.photos : [];
        const photos: PhotoAttachment[] = incomingPhotos
            .map((p: any) => {
                if (!p) return null;
                if (typeof p === 'string') {
                    const uri = p;
                    const name = uri.split('/').pop() || 'photo.jpg';
                    const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                    return { uri, name, type } as PhotoAttachment;
                }
                if (typeof p === 'object' && typeof p.uri === 'string') return p as PhotoAttachment;
                return null;
            })
            .filter(Boolean) as PhotoAttachment[];
        setData({
            gridStatus: v.gridStatus ?? null,
            breakerStatus: v.breakerStatus ?? null,
            photos,
        });
    }, [hydrateKey]);

    const update = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        setData(newData);
        onUpdate(newData);
    };

    return (
        <>
            <FormSection title="Grid Meter" icon="image">
                <PhotoCapture
                    label="Grid Meter Photos"
                    photos={data.photos}
                    onAddPhoto={(p) => update('photos', [...data.photos, p])}
                    onRemovePhoto={(uri) => update('photos', data.photos.filter((p) => p.uri !== uri))}
                />
            </FormSection>
            <FormSection title="Status" icon="flash">
                <StatusToggle label="Grid Status" value={data.gridStatus} onChange={(v) => update('gridStatus', v)} warningLevel="critical" />
                <StatusToggle label="Grid Breaker" value={data.breakerStatus} onChange={(v) => update('breakerStatus', v)} />
            </FormSection>
        </>
    );
};

const FuelTankForm = ({
    onUpdate,
    value,
    hydrateKey,
}: {
    onUpdate: (data: any) => void;
    value?: any;
    hydrateKey?: number;
}) => {
    const [data, setData] = useState({
        tankStatus: null,
        separatingFilter: null,
        waterInTank: null,
        fuelLine: null,
        isWaterproof: null,
        comments: ''
    });

        useEffect(() => {
            if (!hydrateKey) return;
            if (!value || typeof value !== 'object') return;
            const v: any = value;
            setData({
                tankStatus: v.tankStatus ?? null,
                separatingFilter: v.separatingFilter ?? null,
                waterInTank: v.waterInTank ?? null,
                fuelLine: v.fuelLine ?? null,
                isWaterproof: v.isWaterproof ?? null,
                comments: v.comments ?? '',
            });
        }, [hydrateKey]);

    const update = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        setData(newData);
        onUpdate(newData);
    };

    return (
        <FormSection title="Tank Inspection" icon="water">
             <StatusToggle label="Tank Status" value={data.tankStatus} onChange={(v) => update('tankStatus', v)} />
             <StatusToggle label="Separating Filter" value={data.separatingFilter} onChange={(v) => update('separatingFilter', v)} />
             <StatusToggle 
                label="Water in Tank?" 
                value={data.waterInTank} 
                onChange={(v) => update('waterInTank', v)} 
                warningLevel="critical" 
                okLabel="No" 
                nokLabel="Yes" 
            />
             <StatusToggle label="Fuel Line Status" value={data.fuelLine} onChange={(v) => update('fuelLine', v)} />
             <StatusToggle label="Tank Waterproof?" value={data.isWaterproof} onChange={(v) => update('isWaterproof', v)} okLabel="Yes" nokLabel="No"/>
             <InputField label="Comments" value={data.comments} onChangeText={(v) => update('comments', v)} multiline />
        </FormSection>
    )
}

const ShelterForm = ({
    onUpdate,
    value,
    hydrateKey,
}: {
    onUpdate: (data: any) => void;
    value?: any;
    hydrateKey?: number;
}) => {
    const [data, setData] = useState({
        shelterStatus: null,
        doorStatus: null,
        temperature: '',
        controllerStatus: null,
        ac1Status: null,
        ac2Status: null
    });

        useEffect(() => {
            if (!hydrateKey) return;
            if (!value || typeof value !== 'object') return;
            const v: any = value;
            setData({
                shelterStatus: v.shelterStatus ?? null,
                doorStatus: v.doorStatus ?? null,
                temperature: v.temperature ?? '',
                controllerStatus: v.controllerStatus ?? null,
                ac1Status: v.ac1Status ?? null,
                ac2Status: v.ac2Status ?? null,
            });
        }, [hydrateKey]);
    const update = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        setData(newData);
        onUpdate(newData);
    };

    return (
        <>
            <FormSection title="Shelter Condition" icon="home">
                 <StatusToggle label="Shelter Status" value={data.shelterStatus} onChange={(v) => update('shelterStatus', v)} />
                 <StatusToggle label="Shelter Door" value={data.doorStatus} onChange={(v) => update('doorStatus', v)} />
            </FormSection>
            <FormSection title="Air Conditioners" icon="snow">
                 <StatusToggle label="AC 1 Status" value={data.ac1Status} onChange={(v) => update('ac1Status', v)} />
                 <StatusToggle label="AC 2 Status" value={data.ac2Status} onChange={(v) => update('ac2Status', v)} />
            </FormSection>
            <FormSection title="Environment" icon="thermometer">
                 <InputField label="Temperature" value={data.temperature} onChangeText={(v) => update('temperature', v)} unit="°C" keyboardType="numeric" />
                 <StatusToggle label="Controller Status" value={data.controllerStatus} onChange={(v) => update('controllerStatus', v)} />
            </FormSection>
        </>
    )
}

const CleaningForm = ({
    onUpdate,
    value,
    hydrateKey,
}: {
    onUpdate: (data: any) => void;
    value?: any;
    hydrateKey?: number;
}) => {
    const [data, setData] = useState({
        isClean: null,
        spillage: null,
        securityLight: null,
        guardPresent: null,
        securityBox: null,
        comments: '', 
        photos: [] as PhotoAttachment[]
    });

        useEffect(() => {
            if (!hydrateKey) return;
            if (!value || typeof value !== 'object') return;
            const v: any = value;
            const incomingPhotos: any[] = Array.isArray(v.photos) ? v.photos : [];
            const photos: PhotoAttachment[] = incomingPhotos
                .map((p: any) => {
                    if (!p) return null;
                    if (typeof p === 'string') {
                        const uri = p;
                        const name = uri.split('/').pop() || 'photo.jpg';
                        const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                        return { uri, name, type } as PhotoAttachment;
                    }
                    if (typeof p === 'object' && typeof p.uri === 'string') return p as PhotoAttachment;
                    return null;
                })
                .filter(Boolean) as PhotoAttachment[];

            setData({
                isClean: v.isClean ?? null,
                spillage: v.spillage ?? null,
                securityLight: v.securityLight ?? null,
                guardPresent: v.guardPresent ?? null,
                securityBox: v.securityBox ?? null,
                comments: v.comments ?? '',
                photos,
            });
        }, [hydrateKey]);
    const update = (key: string, value: any) => {
        const newData = { ...data, [key]: value };
        setData(newData);
        onUpdate(newData);
    };

    const addPhoto = (p: PhotoAttachment) => {
        const newData = { ...data, photos: [...(data.photos || []), p] };
        setData(newData);
        onUpdate(newData);
    }
    
    const removePhoto = (uri: string) => {
        const newData = { ...data, photos: data.photos.filter((p: PhotoAttachment) => p.uri !== uri) };
        setData(newData);
        onUpdate(newData);
    }

    return (
        <>
            <FormSection title="Site Cleanliness" icon="brush">
                <StatusToggle label="Is Site Clean?" value={data.isClean} onChange={(v) => update('isClean', v)} okLabel="Yes" nokLabel="No" warningLevel="info" />
                <StatusToggle label="Spillage on Site?" value={data.spillage} onChange={(v) => update('spillage', v)} okLabel="No" nokLabel="Yes" warningLevel="warning" />
            </FormSection>
            <FormSection title="Security Status" icon="shield">
                <StatusToggle label="Security Light Working" value={data.securityLight} onChange={(v) => update('securityLight', v)} />
                <StatusToggle label="Security Guard Present" value={data.guardPresent} onChange={(v) => update('guardPresent', v)} okLabel="Yes" nokLabel="No" />
                <StatusToggle label="Security Box Present" value={data.securityBox} onChange={(v) => update('securityBox', v)} okLabel="Yes" nokLabel="No" />
            </FormSection>
            <FormSection title="Evidence & Notes" icon="document-text">
                 <PhotoCapture 
                    label="Site Photos" 
                    photos={data.photos} 
                    onAddPhoto={addPhoto} 
                    onRemovePhoto={removePhoto} 
                    required={false}
                />
                <InputField 
                    label="Additional Notes" 
                    value={data.comments} 
                    onChangeText={(v) => update('comments', v)} 
                    placeholder="General observations about site condition..."
                    multiline 
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
            </FormSection>
        </>
    )
}

/* --- Main Component --- */

export default function EquipmentForm() {
    const params = useLocalSearchParams<{ type: string; id: string; siteId: string; siteName: string; maintenanceId: string }>();
    const type = params.type;
    // maintenanceId is the actual maintenance record ID
    const maintenanceId = params.id || params.maintenanceId;
    const siteId = params.siteId; 
    
    const router = useRouter();
    const title = EQUIPMENT_TITLES[type || ''] || 'Equipment Check';
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hydrateKey, setHydrateKey] = useState(0);

    const loadEquipmentData = useCallback(async () => {
        try {
            setLoading(true);
            
            // Generate a unique key for this form draft
            const draftKey = `draft_${type}_${siteId}_${maintenanceId || 'adhoc'}`;
            
            // First, try to load from AsyncStorage (local draft)
            const localDraft = await AsyncStorage.getItem(draftKey);
            if (localDraft) {
                const parsedDraft = JSON.parse(localDraft);
                console.log('📋 Loaded local draft:', draftKey);
                setFormData(parsedDraft);
                setHydrateKey((k) => k + 1);
            }
            
            // If we have a maintenanceId, also try to load from server (will override local draft if exists)
            if (maintenanceId) {
                try {
                    const response = await api.get(`/technician/maintenance/${maintenanceId}`);
                    const maintenance = response.data.data;

                    if (maintenance?.equipment_checks) {
                        let serverData = null;
                        const checkKey = type + '_checks';
                        switch (type) {
                            case 'generator':
                                if (maintenance.equipment_checks.generator_checks?.length > 0) {
                                    serverData = maintenance.equipment_checks.generator_checks[0];
                                }
                                break;
                            case 'power_cabinet':
                                serverData = maintenance.equipment_checks.power_cabinet_checks;
                                break;
                            case 'grid':
                                serverData = maintenance.equipment_checks.grid_checks;
                                break;
                            case 'shelter':
                                serverData = maintenance.equipment_checks.shelter_checks;
                                break;
                            case 'fuel_tank':
                                serverData = maintenance.equipment_checks.fuel_tank_checks;
                                break;
                            case 'cleaning':
                                serverData = maintenance.equipment_checks.cleaning_checks;
                                break;
                        }
                        
                        if (serverData) {
                            console.log('💾 Loaded server data for maintenance:', maintenanceId, 'Type:', type);
                            console.log('📦 Server data:', JSON.stringify(serverData, null, 2));

                            let mappedData = { ...serverData };
                            // Map Backend snake_case to Frontend camelCase
                            if (type === 'generator') {
                                // serverData has { electrical_readings: { ... }, battery_status: ... }
                                // Frontend wants { batteryStatus: ..., i1: ... }
                                const electrical = serverData.electrical_readings || {};
                                mappedData = {
                                    ...serverData,
                                    batteryStatus: serverData.battery_status,
                                    fanBeltStatus: serverData.fan_belt_status,
                                    radiatorStatus: serverData.radiator_status,
                                    coolantStatus: serverData.coolant_status,
                                    i1: electrical.i1 ? String(electrical.i1) : '',
                                    i2: electrical.i2 ? String(electrical.i2) : '',
                                    i3: electrical.i3 ? String(electrical.i3) : '',
                                    v1: electrical.v1 ? String(electrical.v1) : '',
                                    v2: electrical.v2 ? String(electrical.v2) : '',
                                    v3: electrical.v3 ? String(electrical.v3) : '',
                                    // Normalize server photo URLs into PhotoAttachment[]
                                    photos: (() => {
                                        const raw = (electrical.photos || []).map((p: any) => (typeof p === 'string' ? p : p.uri || ''));
                                        let photos = raw.filter(Boolean).map((uri: string) => ({
                                            uri,
                                            name: uri.split('/').pop() || 'photo.jpg',
                                            type: 'image/jpeg'
                                        }));

                                        // If photos exist but none are tagged with reading names (I1_,V1_, etc),
                                        // attempt a best-effort assignment for generator readings: first 3 -> I1..I3, next 3 -> V1..V3
                                        const hasTagged = photos.some(p => /^(I[123]|V[123])_/.test(p.name));
                                        if (!hasTagged && photos.length > 0 && photos.length <= 6) {
                                            photos = photos.map((p, idx) => {
                                                const tag = idx < 3 ? `I${idx + 1}` : `V${idx - 2}`;
                                                return { ...p, name: `${tag}_${p.name}` };
                                            });
                                        }

                                        return photos;
                                    })(),
                                    comments: serverData.comments || ''
                                };
                            } else if (type === 'fuel_tank') {
                                mappedData = {
                                    ...serverData,
                                    separatingFilter: serverData.separating_filter,
                                    waterInTank: serverData.water_in_tank,
                                    fuelLine: serverData.fuel_line,
                                    isWaterproof: serverData.is_waterproof,
                                    tankStatus: serverData.status // if status is mapped to tankStatus
                                };
                            } else if (type === 'shelter') {
                                // Map server shelter fields into frontend shape
                                const acUnits: any[] = Array.isArray(serverData.ac_units) ? serverData.ac_units : [];
                                mappedData = {
                                    ...serverData,
                                    doorStatus: serverData.door_status,
                                    shelterStatus: serverData.status,
                                    temperature: serverData.temperature ?? '',
                                    ac1Status: acUnits[0] ? (acUnits[0].status ?? null) : null,
                                    ac2Status: acUnits[1] ? (acUnits[1].status ?? null) : null,
                                };
                            } else if (type === 'grid') {
                                mappedData = {
                                    ...serverData,
                                    breakerStatus: serverData.breaker_status,
                                    gridStatus: serverData.status,
                                    photos: (serverData.meter_photos || []).map((p: string) => ({ 
                                        uri: p, name: p.split('/').pop() || 'photo.jpg', type: 'image/jpeg' 
                                    }))
                                };
                            } else if (type === 'cleaning') {
                                mappedData = {
                                   ...serverData,
                                   isClean: serverData.is_clean,
                                   securityLight: serverData.security_light,
                                   guardPresent: serverData.guard_present,
                                                                     securityBox: serverData.security_box,
                                                                     photos: ((serverData.photos || []) as string[]).map((p: string) => ({
                                                                         uri: p,
                                                                         name: p.split('/').pop() || 'photo.jpg',
                                                                         type: 'image/jpeg'
                                                                     }))
                                };
                            } else if (type === 'power_cabinet') {
                                // server stores power_cabinet_checks as an array; prefer first item
                                const pc = Array.isArray(serverData) ? (serverData[0] || {}) : (serverData || {});
                                mappedData = {
                                    ...pc,
                                    // Keep frontend-friendly keys
                                    rectifiers: pc.rectifiers || [],
                                    batteries: pc.batteries || [],
                                    cooling: pc.cooling || { status: null, comments: '' },
                                    controller: pc.controller || { status: null, comments: '' },
                                    numRectifiers: pc.numRectifiers ? String(pc.numRectifiers) : String((pc.rectifiers || []).length || 0),
                                    numBatteries: pc.numBatteries ? String(pc.numBatteries) : String((pc.batteries || []).length || 0),
                                };
                            }

                            setFormData(mappedData);
                            setHydrateKey((k) => k + 1);
                            // Clear local draft since we have server data
                            await AsyncStorage.removeItem(draftKey);
                        } else {
                            console.log('⚠️ No server data found for type:', type);
                        }
                    }
                } catch (error) {
                    console.error('Error loading from server, using local draft:', error);
                }
            }
        } catch (error) {
            console.error('Error loading equipment data:', error);
        } finally {
            setLoading(false);
        }
    }, [maintenanceId, type, siteId]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadEquipmentData();
    }, [maintenanceId, type, siteId]);

    const computeProgress = (dataObj: any, equipmentType?: string) => {
        const isFilled = (val: any) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'string') return val.trim() !== '';
            if (typeof val === 'number') return !isNaN(val);
            if (typeof val === 'boolean') return true; // presence of boolean counts
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'object') return Object.keys(val).length > 0;
            return false;
        };

        try {
            const data = dataObj || {};

            // Helper to normalize photo entries into objects with `name` and `uri`
            const normalizePhotos = (photos: any) => {
                if (!Array.isArray(photos)) return [];
                return photos.map((p: any) => {
                    if (typeof p === 'string') return { uri: p, name: p.split('/').pop() || '' };
                    return { uri: p.uri || '', name: p.name || (p.uri ? p.uri.split('/').pop() : '') };
                }).filter((p: any) => p.uri || p.name);
            };

            if (equipmentType === 'generator') {
                const keys = [
                    'batteryStatus','fanBeltStatus','radiatorStatus','coolantStatus',
                    'i1','i2','i3','v1','v2','v3','comments'
                ];

                const photos = normalizePhotos(data.photos || []);

                // Count reading-tagged photos (names like I1_..., V2_...)
                const readingTagged = photos.filter((p: any) => /^(I[123]|V[123])_/.test(p.name)).length;

                // If there are no explicit tags but up to 6 photos exist, assume they map to readings
                const inferredReadingCount = readingTagged === 0 && photos.length > 0 && photos.length <= 6 ? Math.min(photos.length, 6) : readingTagged;

                const total = keys.length + 6; // 6 expected reading photos
                const filledFields = keys.reduce((acc, k) => acc + (isFilled(data[k]) ? 1 : 0), 0);
                const current = Math.min(total, filledFields + inferredReadingCount);
                return { current, total };
            }

            if (equipmentType === 'grid') {
                const keys = ['gridStatus','breakerStatus','comments'];
                const photos = normalizePhotos(data.photos || []);
                const total = keys.length + 1;
                const filledFields = keys.reduce((acc, k) => acc + (isFilled(data[k]) ? 1 : 0), 0);
                const photoScore = photos.length > 0 ? 1 : 0;
                return { current: Math.min(total, filledFields + photoScore), total };
            }

            if (equipmentType === 'cleaning') {
                const keys = ['isClean','spillage','securityLight','guardPresent','securityBox','comments'];
                const photos = normalizePhotos(data.photos || []);
                const total = keys.length + 1;
                const filledFields = keys.reduce((acc, k) => acc + (isFilled(data[k]) ? 1 : 0), 0);
                const photoScore = photos.length > 0 ? 1 : 0;
                return { current: Math.min(total, filledFields + photoScore), total };
            }

            // Generic fallback: treat each top-level (non-photo) key as one item, plus one for photos
            const simpleKeys = Object.keys(data).filter(k => k !== 'photos');
            const photos = normalizePhotos(data.photos || []);
            const total = Math.max(1, simpleKeys.length) + 1;
            const filled = simpleKeys.reduce((acc, k) => acc + (isFilled(data[k]) ? 1 : 0), 0);
            const current = Math.min(total, filled + (photos.length > 0 ? 1 : 0));
            return { current, total };
        } catch (err) {
            return { current: 0, total: 1 };
        }
    };

    const handleUpdate = (data: any) => {
        setFormData(prev => ({...prev, ...data}));
    };

    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            
            // Generate a unique key for this form draft
            const draftKey = `draft_${type}_${siteId}_${maintenanceId || 'adhoc'}`;
            
            // 1. Process images (Upload if needed)
            console.log('🔄 Processing images for draft...');
            let processedData;
            try {
                processedData = await uploadAPI.processAndUploadData(formData);
            } catch (uploadError: any) {
                console.error('Upload error during draft save:', uploadError);
                Alert.alert(
                    "Upload Failed", 
                    "Some images could not be uploaded. Please check your connection and try again.",
                    [{ text: "OK" }]
                );
                setSaving(false);
                return;
            }
            
            // 2. Update local state with uploaded URLs so we don't re-upload later
            setFormData(processedData);
            
            // 3. Save to AsyncStorage (now contains server URLs for images)
            await AsyncStorage.setItem(draftKey, JSON.stringify(processedData));
            console.log('💾 Draft saved locally:', draftKey);
            
            // 4. Sync to server if possible
            if (maintenanceId) {
                try {
                    let payloadForServer: any = processedData;
                    if (type === 'shelter') {
                        // transform shelter-shaped formData into server shape
                        const ac_units: any[] = [];
                        if (processedData.ac1Status !== undefined) ac_units.push({ status: processedData.ac1Status, comments: processedData.ac1Comments || '' });
                        if (processedData.ac2Status !== undefined) ac_units.push({ status: processedData.ac2Status, comments: processedData.ac2Comments || '' });
                        payloadForServer = {
                            ...processedData,
                            status: processedData.shelterStatus,
                            door_status: processedData.doorStatus,
                            temperature: processedData.temperature !== undefined && processedData.temperature !== '' ? Number(processedData.temperature) : undefined,
                            ac_units,
                        };
                    }

                    console.log('🔁 Sync payload to server for', type, payloadForServer);
                    await api.patch(`/technician/maintenance/${maintenanceId}/equipment/${type}`, payloadForServer);
                    console.log('☁️ Draft synced to server');
                    Alert.alert("Success", "Draft saved and synced to server!");
                } catch (error: any) {
                    console.error('Error syncing to server:', error);
                    Alert.alert("Saved Locally", "Draft saved on device. Will sync when online.");
                }
            } else {
                Alert.alert("Saved", "Draft saved locally on your device.");
            }
        } catch (error: any) {
            console.error('Error saving draft:', error);
            Alert.alert("Error", "Failed to save draft");
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async () => {
        if (!maintenanceId) {
            Alert.alert(
                "Ad-hoc Inspection", 
                "This is an ad-hoc inspection. Data will be saved locally. To create a formal maintenance record, please schedule through your supervisor.",
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "Save Locally", 
                        onPress: async () => {
                            // Save to local storage
                            const draftKey = `draft_${type}_${siteId}_adhoc`;
                            await AsyncStorage.setItem(draftKey, JSON.stringify(formData));
                            router.back();
                        }
                    }
                ]
            );
            return;
        }

        // Validate required fields based on equipment type
        const isValid = validateForm();
        if (!isValid) {
            Alert.alert("Validation Error", "Please fill in all required fields");
            return;
        }

        try {
            setSaving(true);

            console.log('Processing uploads...');
            // Deep copy and process using shared utility
            let dataToSubmit;
            try {
                dataToSubmit = await uploadAPI.processAndUploadData(JSON.parse(JSON.stringify(formData)));
            } catch (uploadError: any) {
                console.error('Upload error during submission:', uploadError);
                Alert.alert(
                    "Upload Failed", 
                    "Failed to upload images. Please check your internet connection and try again.",
                    [{ text: "OK" }]
                );
                setSaving(false);
                return;
            }

            // Submit equipment check - transform payload for server where needed then PATCH
            let payloadForServer: any = dataToSubmit;
            if (type === 'shelter') {
                const ac_units: any[] = [];
                if (dataToSubmit.ac1Status !== undefined) ac_units.push({ status: dataToSubmit.ac1Status, comments: dataToSubmit.ac1Comments || '' });
                if (dataToSubmit.ac2Status !== undefined) ac_units.push({ status: dataToSubmit.ac2Status, comments: dataToSubmit.ac2Comments || '' });
                payloadForServer = {
                    ...dataToSubmit,
                    status: dataToSubmit.shelterStatus,
                    door_status: dataToSubmit.doorStatus,
                    temperature: dataToSubmit.temperature !== undefined && dataToSubmit.temperature !== '' ? Number(dataToSubmit.temperature) : undefined,
                    ac_units,
                };
            }

            console.log('🔁 Submit payload to server for', type, payloadForServer);
            await api.patch(`/technician/maintenance/${maintenanceId}/equipment/${type}`, payloadForServer);
            
            // Clear the local draft after successful submission
            const draftKey = `draft_${type}_${siteId}_${maintenanceId}`;
            await AsyncStorage.removeItem(draftKey);
            console.log('🗑️ Cleared local draft after submission');
            
            Alert.alert("Success", "Equipment check submitted for approval!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Error submitting form:', error);
            Alert.alert("Error", error.response?.data?.error || "Failed to submit form");
        } finally {
            setSaving(false);
        }
    };

    const validateForm = (): boolean => {
        // Basic validation - can be enhanced based on equipment type
        if (type === 'generator') {
            const data = formData as any;
            if (!data.batteryStatus || !data.fanBeltStatus || !data.radiatorStatus || !data.coolantStatus) {
                return false;
            }
            if (!data.i1 || !data.i2 || !data.i3 || !data.v1 || !data.v2 || !data.v3) {
                return false;
            }
        }
        return true;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text>Loading equipment data...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const id = params.id || ''; // Ensure id is defined

    const renderFormInfo = () => {
        // Generator form handles its own info card layout
        if (type === 'generator') return null;
        
        return (
            <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Equipment Information</Text>
                <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>Type</Text>
                    <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '500' }}>{title}</Text>
                </View>
                {id && (
                <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>Equipment ID</Text>
                    <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '500' }}>{id}</Text>
                </View>
                )}
                {siteId && (
                <View>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>Site ID</Text>
                    <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '500' }}>{siteId}</Text>
                </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View>
                     <Text style={styles.headerTitle}>{type === 'generator' ? (params.siteName ? `Generator - ${params.siteName}` : 'Generator 1') : title}</Text>
                     {type === 'generator' && <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{siteId || 'Site A - Lagos'} • Enhanced Form</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Ionicons name="wifi" size={20} color={Colors.text} />
                    <Ionicons name="notifications-outline" size={20} color={Colors.text} />
                    <Ionicons name="person-outline" size={20} color={Colors.text} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <ProgressIndicator current={computeProgress(formData, type).current} total={computeProgress(formData, type).total} label="Form Completion" />
                {renderFormInfo()}

                <View style={{ gap: 16 }}>
                                        {type === 'generator' && (
                                            <GeneratorForm onUpdate={handleUpdate} siteId={siteId} value={formData} hydrateKey={hydrateKey} />
                                        )}
                    {type === 'power_cabinet' && <PowerCabinetFormWithHydration onUpdate={handleUpdate} value={formData} hydrateKey={hydrateKey} />}
                                        {type === 'grid' && (
                                            <GridFormWithHydration onUpdate={handleUpdate} value={formData} hydrateKey={hydrateKey} />
                                        )}
                                        {type === 'fuel_tank' && (
                                            <FuelTankForm onUpdate={handleUpdate} value={formData} hydrateKey={hydrateKey} />
                                        )}
                                        {type === 'shelter' && (
                                            <ShelterForm onUpdate={handleUpdate} value={formData} hydrateKey={hydrateKey} />
                                        )}
                                        {type === 'cleaning' && (
                                            <CleaningForm onUpdate={handleUpdate} value={formData} hydrateKey={hydrateKey} />
                                        )}
                </View>

            </ScrollView>
            
            <View style={styles.footer}>
                 <TouchableOpacity style={styles.saveDraftBtn} onPress={handleSaveDraft} disabled={saving}>
                    <Ionicons name="save-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <Text style={styles.saveDraftText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving}>
                    <Ionicons name="checkmark" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>{saving ? 'Submitting...' : 'Submit'}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.lightGray,
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
    backButton: {
        padding: 4,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    infoCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    infoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    iconContainer: {
        padding: 6,
        backgroundColor: Colors.primaryLight, // Ensure Colors.primaryLight exists or use rgba
        borderRadius: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    infoItem: {
        width: '48%',
        backgroundColor: '#F8FAFC', // Light gray/blue bg
        padding: 12,
        borderRadius: 8,
    },
    infoLabel: {
        color: Colors.primary,
        fontSize: 12,
        marginBottom: 4,
        fontWeight: '500',
    },
    infoValue: {
        color: Colors.text,
        fontWeight: '700',
        fontSize: 14,
    },
    readingCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 12,
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
    submitBtn: {
        flex: 1,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    saveDraftBtn: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    saveDraftText: {
        color: Colors.textSecondary,
        fontWeight: '600',
        fontSize: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        padding: 4,
        borderRadius: 12,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: Colors.primaryLight,
    },
    tabText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: Colors.primary,
        fontWeight: '600',
    },
    tabContent: {
        gap: 16,
    },
});

