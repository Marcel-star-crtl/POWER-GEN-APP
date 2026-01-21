// app/(technician)/maintenance/equipment/[type].tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../constants/Colors';

const EQUIPMENT_TITLES: { [key: string]: string } = {
  generator: 'Generator Check',
  power_cabinet: 'Power Cabinet',
  grid: 'Grid Power',
  shelter: 'Shelter Inspection',
  fuel_tank: 'Fuel Tank',
  cleaning: 'Site Cleaning'
};

export default function EquipmentForm() {
    const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
    const router = useRouter();
    const title = EQUIPMENT_TITLES[type || ''] || 'Equipment Check';

    // Form State
    const [runningHours, setRunningHours] = useState('');
    const [oilLevel, setOilLevel] = useState('High');
    const [batteryVoltage, setBatteryVoltage] = useState('');
    const [temperature, setTemperature] = useState('');
    const [airFilter, setAirFilter] = useState('Clean');
    const [comments, setComments] = useState('');

    const handleSubmit = () => {
        const payload = {
            type,
            maintenanceId: id,
            data: {
                runningHours,
                oilLevel,
                batteryVoltage,
                temperature,
                airFilter,
                comments
            }
        };
        console.log('Submitting Form Payload:', payload);
        
        // Navigate back and pass params if needed, or rely on Context/Store (mocking outcome)
        // In a real app we would PUT to API here.
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Mock Equipment Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Equipment Information</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>ID:</Text>
                        <Text style={styles.infoValue}>EQ-{type?.toUpperCase().substring(0,3)}-001</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Model:</Text>
                        <Text style={styles.infoValue}>CAT-2500X</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Serial:</Text>
                        <Text style={styles.infoValue}>SN-99882211</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Last Maint:</Text>
                        <Text style={styles.infoValue}>15 Dec 2024</Text>
                    </View>
                </View>

                {/* Form Fields - Conditionally render or show all for prototype as requested for Gen/Power Cab */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Checklist Inputs</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Running Hours</Text>
                        <TextInput 
                            style={styles.input} 
                            keyboardType="numeric"
                            placeholder="e.g. 12450"
                            value={runningHours}
                            onChangeText={setRunningHours}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Oil Level</Text>
                        <View style={styles.pillContainer}>
                            {['Low', 'Medium', 'High'].map((level) => (
                                <TouchableOpacity 
                                    key={level}
                                    style={[styles.pill, oilLevel === level && styles.pillActive]}
                                    onPress={() => setOilLevel(level)}
                                >
                                    <Text style={[styles.pillText, oilLevel === level && styles.pillTextActive]}>{level}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Battery Voltage (V)</Text>
                        <TextInput 
                            style={styles.input} 
                            keyboardType="numeric"
                            placeholder="e.g. 12.4"
                            value={batteryVoltage}
                            onChangeText={setBatteryVoltage}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Temperature (°C)</Text>
                        <TextInput 
                            style={styles.input} 
                            keyboardType="numeric"
                            placeholder="e.g. 85"
                            value={temperature}
                            onChangeText={setTemperature}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Air Filter Status</Text>
                        <View style={styles.pillContainer}>
                            {['Clean', 'Dirty', 'Replaced'].map((status) => (
                                <TouchableOpacity 
                                    key={status}
                                    style={[styles.pill, airFilter === status && styles.pillActive]}
                                    onPress={() => setAirFilter(status)}
                                >
                                    <Text style={[styles.pillText, airFilter === status && styles.pillTextActive]}>{status}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Photos</Text>
                        <View style={styles.photoButtons}>
                            <TouchableOpacity style={styles.photoBtn}>
                                <Ionicons name="camera" size={20} color={Colors.primary} />
                                <Text style={styles.photoBtnText}>Take Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.photoBtn}>
                                <Ionicons name="images" size={20} color={Colors.primary} />
                                <Text style={styles.photoBtnText}>Upload</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Additional Comments</Text>
                        <TextInput 
                            style={[styles.input, styles.textArea]} 
                            multiline
                            numberOfLines={4}
                            placeholder="Any observations..."
                            textAlignVertical="top"
                            value={comments}
                            onChangeText={setComments}
                        />
                    </View>
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                    <Text style={styles.submitBtnText}>Submit Entry</Text>
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
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    infoValue: {
        color: Colors.text,
        fontWeight: '500',
        fontSize: 14,
    },
    formSection: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: Colors.lightGray,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        fontSize: 14,
        color: Colors.text,
    },
    textArea: {
        minHeight: 100,
    },
    pillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.lightGray,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pillActive: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primary,
    },
    pillText: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    pillTextActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    photoButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    photoBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.lightGray,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 8,
    },
    photoBtnText: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '500',
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
    },
    submitBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});
