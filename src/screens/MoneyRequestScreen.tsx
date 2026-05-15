import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import api from '../utils/api';

type RequestType = 'material' | 'wage';

interface MaterialItem {
  id: string;
  name: string;
  quantity: string;
  price: string;
}

export default function MoneyRequestScreen() {
  const navigation = useNavigation();
  const [requestType, setRequestType] = useState<RequestType>('material');
  const [loading, setLoading] = useState(false);

  // Material request state
  const [materials, setMaterials] = useState<MaterialItem[]>([
    { id: '1', name: '', quantity: '', price: '' },
  ]);
  const [materialDescription, setMaterialDescription] = useState('');

  // Wage request state
  const [wageAmount, setWageAmount] = useState('');
  const [wageDescription, setWageDescription] = useState('');

  const addMaterialItem = () => {
    setMaterials([
      ...materials,
      { id: Date.now().toString(), name: '', quantity: '', price: '' },
    ]);
  };

  const removeMaterialItem = (id: string) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((item) => item.id !== id));
    }
  };

  const updateMaterialItem = (id: string, field: keyof MaterialItem, value: string) => {
    setMaterials(
      materials.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = () => {
    return materials.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return total + quantity * price;
    }, 0);
  };

  const validateMaterialRequest = () => {
    if (materials.some((item) => !item.name.trim())) {
      Alert.alert('Error', 'Please fill in all material names');
      return false;
    }

    if (materials.some((item) => !item.quantity || parseFloat(item.quantity) <= 0)) {
      Alert.alert('Error', 'Please enter valid quantities');
      return false;
    }

    if (materials.some((item) => !item.price || parseFloat(item.price) <= 0)) {
      Alert.alert('Error', 'Please enter valid prices');
      return false;
    }

    return true;
  };

  const validateWageRequest = () => {
    if (!wageAmount || parseFloat(wageAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid wage amount');
      return false;
    }

    if (!wageDescription.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (requestType === 'material') {
      if (!validateMaterialRequest()) return;

      try {
        setLoading(true);
        const items = materials.map((item) => ({
          name: item.name.trim(),
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price),
        }));

        await api.post('/money-requests', {
          type: 'material',
          items,
          description: materialDescription.trim(),
          totalAmount: calculateTotal(),
        });

        if (Platform.OS === 'web') {
          // On web, just show alert and navigate
          alert('Success: Material request submitted successfully. You will be notified when the admin reviews it.');
          navigation.goBack();
        } else {
          // On mobile, use Alert.alert
          Alert.alert(
            'Success', 
            'Material request submitted successfully. You will be notified when the admin reviews it.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to submit request';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setLoading(false);
      }
    } else {
      if (!validateWageRequest()) return;

      try {
        setLoading(true);
        await api.post('/money-requests', {
          type: 'wage',
          requestedAmount: parseFloat(wageAmount),
          description: wageDescription.trim(),
        });

        if (Platform.OS === 'web') {
          // On web, just show alert and navigate
          alert('Success: Wage request submitted successfully. You will be notified when the admin reviews it.');
          navigation.goBack();
        } else {
          // On mobile, use Alert.alert
          Alert.alert(
            'Success', 
            'Wage request submitted successfully. You will be notified when the admin reviews it.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to submit request';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Money</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Request Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, requestType === 'material' && styles.typeButtonActive]}
            onPress={() => setRequestType('material')}
          >
            <Icon
              name="construct-outline"
              size={20}
              color={requestType === 'material' ? '#fff' : '#6b7280'}
            />
            <Text
              style={[
                styles.typeButtonText,
                requestType === 'material' && styles.typeButtonTextActive,
              ]}
            >
              Materials
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, requestType === 'wage' && styles.typeButtonActive]}
            onPress={() => setRequestType('wage')}
          >
            <Icon
              name="cash-outline"
              size={20}
              color={requestType === 'wage' ? '#fff' : '#6b7280'}
            />
            <Text
              style={[styles.typeButtonText, requestType === 'wage' && styles.typeButtonTextActive]}
            >
              Wages/Salary
            </Text>
          </TouchableOpacity>
        </View>

        {/* Material Request Form */}
        {requestType === 'material' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Material Items</Text>

            {materials.map((item, index) => (
              <View key={item.id} style={styles.materialItem}>
                <View style={styles.materialHeader}>
                  <Text style={styles.materialNumber}>Item {index + 1}</Text>
                  {materials.length > 1 && (
                    <TouchableOpacity onPress={() => removeMaterialItem(item.id)}>
                      <Icon name="close-circle" size={24} color="#f87171" />
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Material name"
                  placeholderTextColor="#6b7280"
                  value={item.name}
                  onChangeText={(value) => updateMaterialItem(item.id, 'name', value)}
                />

                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Quantity"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                    value={item.quantity}
                    onChangeText={(value) => updateMaterialItem(item.id, 'quantity', value)}
                  />

                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Price (₦)"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                    value={item.price}
                    onChangeText={(value) => updateMaterialItem(item.id, 'price', value)}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addMaterialItem}>
              <Icon name="add-circle-outline" size={20} color="#7c8bff" />
              <Text style={styles.addButtonText}>Add Another Item</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Additional notes (optional)"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={4}
              value={materialDescription}
              onChangeText={setMaterialDescription}
            />

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                ₦{calculateTotal().toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        {/* Wage Request Form */}
        {requestType === 'wage' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Wage Request</Text>
            <Text style={styles.infoText}>
              You can only request wages once per day. The admin will review and set the final
              amount.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Requested amount (₦)"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={wageAmount}
              onChangeText={setWageAmount}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Reason for wage request"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={4}
              value={wageDescription}
              onChangeText={setWageDescription}
            />
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="send-outline" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a30',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a30',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#7c8bff',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  form: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  materialItem: {
    backgroundColor: '#1a1a30',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  materialNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c8bff',
  },
  input: {
    backgroundColor: '#2a2a40',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7c8bff',
    borderStyle: 'dashed',
    marginBottom: 24,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c8bff',
  },
  totalCard: {
    backgroundColor: '#7c8bff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#e0e0ff',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c8bff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
