import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Card } from '../../../components/ui/Card';
import { api } from '../../../services/api';

// Mock data generator for non-generator equipment
const getMockEquipment = (siteId: string, type: string) => {
    if (type === 'power_cabinet') {
        return [
            { id: 'PWR-001', name: 'Power Cabinet Main', model: 'Huawei PowerCube', location: 'Shelter' },
        ];
    } else if (type === 'fuel_tank') {
        return [
            { id: 'TANK-001', name: 'Main Fuel Tank', capacity: '5000L', location: 'External' },
            { id: 'TANK-002', name: 'Aux Tank', capacity: '1000L', location: 'Generator Room' },
        ];
    }
    return [];
};

export default function SelectEquipment() {
    const { siteId, type, siteName, mode, maintenanceId } = useLocalSearchParams<{ siteId: string; type: string; siteName: string; mode?: string; maintenanceId?: string }>();
    const router = useRouter();
    const [equipment, setEquipment] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const titleMap: {[key:string]: string} = {
        'generator': 'Select Generator',
        'power_cabinet': 'Select Cabinet',
        'fuel_tank': 'Select Tank',
        'grid': 'Select Grid Meter',
        'shelter': 'Select Shelter',
        'cleaning': 'Select Area'
    };

    useEffect(() => {
        const fetchEquipment = async () => {
            setLoading(true);
            
            try {
                if (type === 'generator' && siteId) {
                    // Fetch real generators from the API
                    const response = await api.get(`/sites/${siteId}`);
                    const siteData = response.data.data;
                    
                    if (siteData?.Current_Generators && Array.isArray(siteData.Current_Generators)) {
                        setEquipment(siteData.Current_Generators);
                    } else {
                        setEquipment([]);
                    }
                } else {
                    // Use mock data for other equipment types
                    const data = getMockEquipment(siteId || '', type || '');
                    setEquipment(data);
                }
            } catch (error) {
                console.error('Error fetching equipment:', error);
                Alert.alert('Error', 'Failed to load equipment. Using mock data.');
                const data = getMockEquipment(siteId || '', type || '');
                setEquipment(data);
            } finally {
                setLoading(false);
            }
        };
        
        fetchEquipment();
    }, [siteId, type, router, siteName]);

    const handleSelect = (item: any) => {
        if (mode === 'refueling') {
             router.push({
                pathname: '/(technician)/refueling/form',
                params: { 
                    siteId: siteId, 
                    siteName: siteName, 
                    tankId: item.id,
                    capacity: item.capacity || '5000L',
                    ...(maintenanceId && { maintenanceId })
                }
            });
        } else if (type === 'generator') {
            // For generators, navigate directly to the form with siteId
            // The form will fetch and allow selection of generators
            router.push({
                pathname: '/(technician)/maintenance/equipment/[type]',
                params: { 
                    type: type, 
                    siteId: siteId, 
                    siteName: siteName,
                    ...(maintenanceId && { maintenanceId })
                }
            });
        } else {
            // For other equipment, navigate with the equipment ID
            router.push({
                pathname: '/(technician)/maintenance/equipment/[type]',
                params: { 
                    type: type, 
                    id: item.id, 
                    siteId: siteId, 
                    siteName: siteName,
                    ...(maintenanceId && { maintenanceId })
                }
            });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>{titleMap[type || ''] || 'Select Equipment'}</Text>
                    {siteName && <Text style={styles.subTitle}>{siteName}</Text>}
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={equipment}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                         <View style={styles.center}>
                            <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>
                                {type === 'generator' 
                                    ? 'No generators found for this site.' 
                                    : `No ${type} found for this site.`}
                            </Text>
                            <TouchableOpacity 
                                style={styles.addButton} 
                                onPress={() => {
                                    router.push({
                                        pathname: '/(technician)/maintenance/equipment/[type]',
                                        params: { 
                                            type: type, 
                                            siteId: siteId, 
                                            siteName: siteName,
                                            ...(maintenanceId && { maintenanceId })
                                        }
                                    });
                                }}
                            >
                                <Text style={styles.addButtonText}>
                                    {type === 'generator' ? 'Proceed with Inspection' : `Add New ${type}`}
                                </Text>
                            </TouchableOpacity>
                         </View>
                    }
                    renderItem={({ item }) => {
                        // Display appropriate information based on equipment type
                        const displayName = type === 'generator' 
                            ? (item.model || `Generator ${item._id}`)
                            : (item.name || item.model || `${type} ${item._id}`);
                        const displayDetail = type === 'generator'
                            ? (item.serial_number || item.status || 'N/A')
                            : (item.model || item.capacity || item.id);
                        
                        return (
                            <TouchableOpacity onPress={() => handleSelect(item)}>
                                <Card style={styles.card}>
                                    <View style={styles.iconContainer}>
                                        <Ionicons name={type === 'fuel_tank' ? 'water' : 'flash'} size={24} color={Colors.primary} />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={styles.equipName}>{displayName}</Text>
                                        <Text style={styles.equipDetail}>{displayDetail}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                                </Card>
                            </TouchableOpacity>
                        );
                    }}
                />
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
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    subTitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        textAlign: 'center'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    list: {
        padding: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    equipName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    equipDetail: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    emptyText: {
        color: Colors.textSecondary,
        marginBottom: 16,
    },
    addButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    addButtonText: {
        color: 'white',
        fontWeight: '600',
    }
});
