import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { logout } from '../store/authSlice';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from "react-native";
import html2canvas from "html2canvas";

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = screenWidth * 0.85;
const cardHeight = cardWidth * 0.63; // Standard ID card ratio

// Default MD signature (you can replace this with actual MD signature)
const DEFAULT_MD_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

const API_BASE_URL = "https://darlyn-alt-backend.onrender.com"; 

const userAPI = {
  getProfile: async () => {
    const token = await AsyncStorage.getItem('token');
    return fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.json());
  },
  
  updateProfile: async (updates: any) => {
    const token = await AsyncStorage.getItem('token');
    return fetch(`${API_BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    }).then(res => res.json());
  },
  
  resetPassword: async (currentPassword: string, newPassword: string) => {
    const token = await AsyncStorage.getItem('token');
    return fetch(`${API_BASE_URL}/users/reset-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    }).then(res => res.json());
  }
};

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  const first = parts[0]?.[0] || '';
  const second = parts.length > 1 ? parts[1]?.[0] : '';
  return (first + second).toUpperCase();
};

const generateStaffId = () => {
  const prefix = 'STF';
  const randomNum = Math.floor(Math.random() * 900000) + 100000; // 6 digit number
  return `${prefix}${randomNum}`;
};

const calculateExpiryDate = (joinDate: string) => {
  try {
    const [day, month, year] = joinDate.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    date.setFullYear(date.getFullYear() + 5);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  } catch (error) {
    return 'Invalid Date';
  }
};

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface IDCardData {
  staffId: string;
  department: string;
  position: string;
  dateOfJoining: string;
  expiryDate: string;
  emergencyContact: string;
  bloodGroup: string;
  address: string;
  phoneNumber: string;
  photo: string | null;
  signature: string | null;
  mdSignature: string; // Auto-set MD signature
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showIDCardModal, setShowIDCardModal] = useState(false);
  const [showIDCardForm, setShowIDCardForm] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [hasExistingIDCard, setHasExistingIDCard] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const cardFrontRef = useRef<ViewShot>(null);
  const cardBackRef = useRef<ViewShot>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  // Password form states
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // ID Card form states - MD signature is auto-set
  const [idCardData, setIdCardData] = useState<IDCardData>({
    staffId: generateStaffId(),
    department: '',
    position: '',
    dateOfJoining: '',
    expiryDate: '',
    emergencyContact: '',
    bloodGroup: '',
    address: '',
    phoneNumber: '',
    photo: null,
    signature: null,
    mdSignature: DEFAULT_MD_SIGNATURE, // Auto-set
  });

  useEffect(() => {
    loadProfile();
    loadIDCardData();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await userAPI.getProfile();
      setProfile(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIDCardData = async () => {
    try {
      const savedIDCard = await AsyncStorage.getItem('idCardData');
      if (savedIDCard) {
        const parsedData = JSON.parse(savedIDCard);
        // Ensure MD signature is always set
        parsedData.mdSignature = parsedData.mdSignature || DEFAULT_MD_SIGNATURE;
        setIdCardData(parsedData);
        setHasExistingIDCard(true);
      }
    } catch (error) {
      console.error('Error loading ID card data:', error);
    }
  };

  const saveIDCardData = async (data: IDCardData) => {
    try {
      await AsyncStorage.setItem('idCardData', JSON.stringify(data));
      setHasExistingIDCard(true);
    } catch (error) {
      console.error('Error saving ID card data:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      Alert.alert('Validation Error', 'Name and email are required');
      return;
    }

    try {
      setSaving(true);
      const updatedProfile = await userAPI.updateProfile(formData);
      setProfile(updatedProfile);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: profile?.name || '',
      email: profile?.email || '',
    });
    setIsEditing(false);
  };

  const handleResetPassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      Alert.alert('Validation Error', 'Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters long');
      return;
    }

    try {
      setSaving(true);
      await userAPI.resetPassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordForm(false);
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'Failed to update password. Please check your current password.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (type: 'photo' | 'signature') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'photo' ? [1, 1] : [3, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIdCardData({
        ...idCardData,
        [type]: result.assets[0].uri
      });
    }
  };

  const validateIDCardForm = () => {
    if (!idCardData.department.trim()) return 'Department is required';
    if (!idCardData.position.trim()) return 'Position is required';
    if (!idCardData.dateOfJoining.trim()) return 'Date of joining is required';
    if (!idCardData.phoneNumber.trim()) return 'Phone number is required';
    if (!idCardData.photo) return 'Photo is required';
    if (!idCardData.signature) return 'Employee signature is required';
    return null;
  };

  const handleGenerateIDCard = () => {
    const validationError = validateIDCardForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    // Calculate expiry date (5 years from joining date)
    const expiryDate = calculateExpiryDate(idCardData.dateOfJoining);
    const updatedData = { 
      ...idCardData, 
      expiryDate,
      mdSignature: DEFAULT_MD_SIGNATURE // Ensure MD signature is set
    };
    
    setIdCardData(updatedData);
    saveIDCardData(updatedData);
    setShowIDCardForm(false);
    setShowIDCardModal(true);
  };

  const exportIDCard = async () => {
    try {
      setIsExporting(true);
      
      const captureView = async (ref: React.RefObject<ViewShot | null>): Promise<string | undefined> => {
        if (!ref.current) return;

        if (Platform.OS === "web") {
          // Get the DOM element from the ref
          const element = ref.current as any;
          if (!element || !element.getBoundingClientRect) {
            throw new Error("Invalid element reference");
          }
          
          const canvas = await html2canvas(element);
          return canvas.toDataURL("image/png");
        } else {
          // React Native - use ViewShot
          return ref.current.capture && ref.current.capture();
        }
      };

      // Capture front side
      const frontUri = await captureView(cardFrontRef);
      if (!frontUri) {
        throw new Error("Failed to capture front side");
      }

      // Switch to back side and wait for render
      setCardSide("back");
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait longer for render

      // Capture back side
      const backUri = await captureView(cardBackRef);
      if (!backUri) {
        throw new Error("Failed to capture back side");
      }

      // Handle sharing based on platform
      if (Platform.OS === 'web') {
        // For web, create download links
        const downloadImage = (uri: string, filename: string) => {
          const link = document.createElement('a');
          link.href = uri;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        downloadImage(frontUri, `${idCardData.staffId}_front.png`);
        downloadImage(backUri, `${idCardData.staffId}_back.png`);
        Alert.alert('Success', 'ID cards downloaded successfully!');
      } else {
        // For React Native, use sharing
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(frontUri);
        }
      }

    } catch (error) {
      console.error("Error exporting ID card:", error);
      Alert.alert('Error', 'Failed to export ID card. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Enhanced QR data with more information
  const qrData = JSON.stringify({
    staffId: idCardData.staffId,
    name: profile?.name,
    email: profile?.email,
    department: idCardData.department,
    position: idCardData.position,
    phoneNumber: idCardData.phoneNumber,
    dateOfJoining: idCardData.dateOfJoining,
    expiryDate: idCardData.expiryDate,
    bloodGroup: idCardData.bloodGroup,
    emergencyContact: idCardData.emergencyContact,
    userId: profile?._id,
    address: idCardData.address,
    issuedDate: new Date().toISOString(),
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return styles.adminBadge;
      case 'worker':
        return styles.workerBadge;
      case 'customer':
        return styles.customerBadge;
      default:
        return styles.defaultBadge;
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      dispatch(logout());
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const IDCardFront = () => (
    <ViewShot ref={cardFrontRef} options={{ format: 'png', quality: 1.0 }}>
      <View style={[styles.idCard, styles.idCardFront]}>
        <View style={styles.idCardHeader}>
          <Text style={styles.companyName}>DarlynAlt Global</Text>
          <Text style={styles.idCardTitle}>EMPLOYEE ID CARD</Text>
        </View>
        
        <View style={styles.idCardBody}>
          <View style={styles.leftSection}>
            <View style={styles.photoSection}>
              {idCardData.photo ? (
                <Image source={{ uri: idCardData.photo }} style={styles.employeePhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={40} color="#1E3A8A" />
                </View>
              )}
            </View>
            
            {/* Worker Signature Section - Replaced QR code */}
            <View style={styles.signatureSection}>
              <Text style={styles.frontSignatureLabel}>Employee</Text>
              {idCardData.signature ? (
                <Image source={{ uri: idCardData.signature }} style={styles.frontSignatureImage} />
              ) : (
                <View style={styles.signaturePlaceholder}>
                  <Text style={styles.signaturePlaceholderText}>Signature</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.rightSection}>
            <Text style={styles.employeeName}>{profile?.name}</Text>
            <Text style={styles.staffId}>ID: {idCardData.staffId}</Text>
            <Text style={styles.department}>{idCardData.department}</Text>
            <Text style={styles.position}>{idCardData.position}</Text>
            <Text style={styles.validityText}>
              Valid: {idCardData.dateOfJoining} - {idCardData.expiryDate}
            </Text>
          </View>
        </View>
        
        <View style={styles.idCardFooter}>
          <Text style={styles.footerText}>Valid Employee Identification</Text>
        </View>
      </View>
    </ViewShot>
  );

  const IDCardBack = () => (
    <ViewShot ref={cardBackRef} options={{ format: 'png', quality: 1.0 }}>
      <View style={[styles.idCard, styles.idCardBack]}>
        <View style={styles.backHeader}>
          <Text style={styles.backTitle}>EMPLOYEE INFORMATION</Text>
        </View>
        
        <View style={styles.backBody}>
          <View style={styles.backInfoRow}>
            <Text style={styles.backLabel}>Email:</Text>
            <Text style={styles.backValue}>{profile?.email}</Text>
          </View>
          
          <View style={styles.backInfoRow}>
            <Text style={styles.backLabel}>Phone:</Text>
            <Text style={styles.backValue}>{idCardData.phoneNumber}</Text>
          </View>
          
          <View style={styles.backInfoRow}>
            <Text style={styles.backLabel}>Blood Group:</Text>
            <Text style={styles.backValue}>{idCardData.bloodGroup || 'N/A'}</Text>
          </View>
          
          <View style={styles.backInfoRow}>
            <Text style={styles.backLabel}>Emergency:</Text>
            <Text style={styles.backValue}>{idCardData.emergencyContact || 'N/A'}</Text>
          </View>
          
          <View style={styles.addressSection}>
            <Text style={styles.backLabel}>Address:</Text>
            <Text style={styles.addressText}>{idCardData.address}</Text>
          </View>
          
          {/* MD Signature at the back */}
          <View style={styles.backSignatureSection}>
            <Text style={styles.backSignatureLabel}>Managing Director</Text>
            {idCardData.mdSignature && (
              <Image source={{ uri: idCardData.mdSignature }} style={styles.backSignatureImage} />
            )}
          </View>
        </View>
        
        <View style={styles.backFooter}>
          <View style={styles.returnInfo}>
            <Text style={styles.returnText}>
              If found, please return to:
            </Text>
            <Text style={styles.returnAddress}>
              2 Olofin Close, Off Ajoke Street,
            </Text>
            <Text style={styles.returnAddress}>
              Gbagada, Ifako, Lagos
            </Text>
            <Text style={styles.returnAddress}>
              08068883461
            </Text>
            <Text style={styles.returnAddress}>
              darlynaltglobal@gmail.com
            </Text>
          </View>
          
          <View style={styles.qrFooter}>
            <QRCode
              value={qrData}
              size={40}
              backgroundColor="transparent"
              color="#1E3A8A"
            />
            <Text style={styles.backFooterText}>Scan to verify</Text>
          </View>
        </View>
      </View>
    </ViewShot>
  );

  // Rest of the component remains the same until the form modal...
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile?.name ? (
              <View style={styles.initialsCircle}>
                <Text style={styles.initialsText}>{getInitials(profile.name)}</Text>
              </View>
            ) : (
              <Ionicons name="person-circle" size={80} color="#007AFF" />
            )}
          </View>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={[styles.roleBadge, getRoleBadgeColor(profile.role)]}>
            <Text style={styles.roleText}>{profile.role?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Profile Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          {/* User ID - Non-editable */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>User ID</Text>
            <View style={styles.nonEditableField}>
              <Text style={styles.nonEditableText}>{profile._id}</Text>
              <Ionicons name="lock-closed" size={16} color="#8E8E93" />
            </View>
          </View>

          {/* Role - Non-editable */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.nonEditableField}>
              <Text style={styles.nonEditableText}>{profile.role}</Text>
              <Ionicons name="lock-closed" size={16} color="#8E8E93" />
            </View>
          </View>

          {/* Name - Editable */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
            ) : (
              <View style={styles.editableField}>
                <Text style={styles.fieldValue}>{profile.name}</Text>
              </View>
            )}
          </View>

          {/* Email - Editable */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <View style={styles.editableField}>
                <Text style={styles.fieldValue}>{profile.email}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {isEditing ? (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancelEdit}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="pencil" size={16} color="#FFFFFF" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ID Card Generation Section - Only for workers */}
        {profile.role === 'worker' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employee ID Card</Text>
            <Text style={styles.sectionDescription}>
              {hasExistingIDCard ? 
                'Your ID card is ready. You can view or export it as an image.' :
                'Generate your official employee ID card with QR code verification'
              }
            </Text>
            
            <View style={styles.idCardActions}>
              {hasExistingIDCard ? (
                <>
                  <TouchableOpacity
                    style={[styles.button, styles.viewCardButton]}
                    onPress={() => setShowIDCardModal(true)}
                  >
                    <Ionicons name="eye" size={16} color="#FFFFFF" />
                    <Text style={styles.viewCardButtonText}>View ID Card</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.exportButton]}
                    onPress={exportIDCard}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="download" size={16} color="#FFFFFF" />
                    )}
                    <Text style={styles.exportButtonText}>
                      {isExporting ? 'Exporting...' : 'Export'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.editCardButton]}
                    onPress={() => setShowIDCardForm(true)}
                  >
                    <Ionicons name="pencil" size={16} color="#FFFFFF" />
                    <Text style={styles.editCardButtonText}>Edit</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.idCardButton]}
                  onPress={() => setShowIDCardForm(true)}
                >
                  <Ionicons name="card" size={16} color="#FFFFFF" />
                  <Text style={styles.idCardButtonText}>Generate ID Card</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Password Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          {!showPasswordForm ? (
            <TouchableOpacity
              style={[styles.button, styles.passwordButton]}
              onPress={() => setShowPasswordForm(true)}
            >
              <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
              <Text style={styles.passwordButtonText}>Reset Password</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordForm}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Current Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={passwordData.currentPassword}
                  onChangeText={(text) => setPasswordData({...passwordData, currentPassword: text})}
                  placeholder="Enter current password"
                  secureTextEntry
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={passwordData.newPassword}
                  onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
                  placeholder="Enter new password"
                  secureTextEntry
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={passwordData.confirmPassword}
                  onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
                  placeholder="Confirm new password"
                  secureTextEntry
                />
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowPasswordForm(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                  }}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleResetPassword}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ID Card Form Modal - Removed MD signature field */}
      <Modal
        visible={showIDCardForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIDCardForm(false)}>
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {hasExistingIDCard ? 'Edit ID Card' : 'Generate ID Card'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Staff ID (Auto-generated)</Text>
              <View style={styles.nonEditableField}>
                <Text style={styles.nonEditableText}>{idCardData.staffId}</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Department *</Text>
              <TextInput
                style={styles.textInput}
                value={idCardData.department}
                onChangeText={(text) => setIdCardData({...idCardData, department: text})}
                placeholder="e.g., Engineering, HR, Sales"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Position *</Text>
              <TextInput
                style={styles.textInput}
                value={idCardData.position}
                onChangeText={(text) => setIdCardData({...idCardData, position: text})}
                placeholder="e.g., Software Developer, Manager"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Date of Employment *</Text>
              <TextInput
                style={styles.textInput}
                value={idCardData.dateOfJoining}
                onChangeText={(text) => setIdCardData({...idCardData, dateOfJoining: text})}
                placeholder="DD/MM/YYYY"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                value={idCardData.phoneNumber}
                onChangeText={(text) => setIdCardData({...idCardData, phoneNumber: text})}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Blood Group</Text>
              <TextInput
                style={styles.textInput}
                value={idCardData.bloodGroup}
                onChangeText={(text) => setIdCardData({...idCardData, bloodGroup: text})}
                placeholder="e.g., A+, B-, O+"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Emergency Contact</Text>
              <TextInput
                style={styles.textInput}
                value={idCardData.emergencyContact}
                onChangeText={(text) => setIdCardData({...idCardData, emergencyContact: text})}
                placeholder="Emergency contact number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={[styles.textInput, styles.addressInput]}
                value={idCardData.address}
                onChangeText={(text) => setIdCardData({...idCardData, address: text})}
                placeholder="Enter full address"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Employee Photo *</Text>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={() => pickImage('photo')}
              >
                {idCardData.photo ? (
                  <Image source={{ uri: idCardData.photo }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={32} color="#8E8E93" />
                    <Text style={styles.imagePlaceholderText}>Upload Employee Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Employee Signature *</Text>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={() => pickImage('signature')}
              >
                {idCardData.signature ? (
                  <Image source={{ uri: idCardData.signature }} style={styles.previewSignature} />
                ) : (
                  <View style={styles.signaturePlaceholder}>
                    <Ionicons name="create" size={32} color="#8E8E93" />
                    <Text style={styles.imagePlaceholderText}>Upload Employee Signature</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.generateButton]}
              onPress={handleGenerateIDCard}
            >
              <Ionicons name="card" size={16} color="#FFFFFF" />
              <Text style={styles.generateButtonText}>
                {hasExistingIDCard ? 'Update ID Card' : 'Generate ID Card'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ID Card Display Modal */}
      <Modal
        visible={showIDCardModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.cardModalContainer}>
          <View style={styles.cardModalHeader}>
            <TouchableOpacity onPress={() => setShowIDCardModal(false)}>
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
            <Text style={styles.cardModalTitle}>Employee ID Card</Text>
            <TouchableOpacity onPress={exportIDCard} disabled={isExporting}>
              {isExporting ? (
                <ActivityIndicator size="small" color="#1C1C1E" />
              ) : (
                <Ionicons name="share" size={24} color="#1C1C1E" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardContainer}>
            <View style={styles.cardToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, cardSide === 'front' && styles.activeToggle]}
                onPress={() => setCardSide('front')}
              >
                <Text style={[styles.toggleText, cardSide === 'front' && styles.activeToggleText]}>
                  Front
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, cardSide === 'back' && styles.activeToggle]}
                onPress={() => setCardSide('back')}
              >
                <Text style={[styles.toggleText, cardSide === 'back' && styles.activeToggleText]}>
                  Back
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardWrapper}>
              {cardSide === 'front' ? <IDCardFront /> : <IDCardBack />}
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.cardInstructions}>
                {cardSide === 'front' 
                  ? 'Front side with photo, employee signature, and basic information'
                  : 'Back side with detailed information, QR code verification, and MD signature'
                }
              </Text>
              <Text style={styles.validityInfo}>
                Valid from {idCardData.dateOfJoining} to {idCardData.expiryDate}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadge: {
    backgroundColor: '#FF3B30',
  },
  workerBadge: {
    backgroundColor: '#007AFF',
  },
  customerBadge: {
    backgroundColor: '#34C759',
  },
  defaultBadge: {
    backgroundColor: '#8E8E93',
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
  },
  nonEditableField: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nonEditableText: {
    fontSize: 16,
    color: '#8E8E93',
    flex: 1,
  },
  editableField: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  fieldValue: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    marginTop: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
    flex: 1,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8E8E93',
    flex: 1,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordButton: {
    backgroundColor: '#FF9500',
  },
  passwordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  idCardButton: {
    backgroundColor: '#1E3A8A',
  },
  idCardButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  idCardActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  viewCardButton: {
    backgroundColor: '#1E3A8A',
    flex: 1,
    minWidth: 100,
  },
  viewCardButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: '#34C759',
    flex: 1,
    minWidth: 80,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editCardButton: {
    backgroundColor: '#FF9500',
    flex: 1,
    minWidth: 60,
  },
  editCardButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordForm: {
    gap: 16,
  },
  initialsCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  imagePlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  previewSignature: {
    width: 150,
    height: 50,
    borderRadius: 4,
  },
  generateButton: {
    backgroundColor: '#1E3A8A',
    marginTop: 20,
    marginBottom: 40,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // ID Card Modal Styles
  cardModalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  cardModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cardModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cardContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  cardToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    marginBottom: 30,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#1E3A8A',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  cardWrapper: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  cardInfo: {
    alignItems: 'center',
    gap: 8,
  },
  cardInstructions: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  validityInfo: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // ID Card Styles
  idCard: {
    width: cardWidth,
    height: cardHeight,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  idCardFront: {
    backgroundColor: '#FFFFFF',
  },
  idCardBack: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1E3A8A',
    borderWidth: 2,
  },
  idCardHeader: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  idCardTitle: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 2,
  },
  idCardBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  leftSection: {
    alignItems: 'center',
    marginRight: 16,
    justifyContent: 'space-between',
  },
  photoSection: {
    alignItems: 'center',
  },
  employeePhoto: {
    width: 80,
    height: 90,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1E3A8A',
  },
  photoPlaceholder: {
    width: 80,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E3A8A',
  },
  rightSection: {
    flex: 1,
    justifyContent: 'space-between',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  staffId: {
    fontSize: 13,
    color: '#1C1C1E',
    marginBottom: 6,
  },
  department: {
    fontSize: 12,
    color: '#1C1C1E',
    marginBottom: 4,
  },
  position: {
    fontSize: 11,
    color: '#1C1C1E',
    marginBottom: 8,
  },
  validityText: {
    fontSize: 9,
    color: '#8E8E93',
    fontWeight: '500',
  },
  // Worker signature section on front (replaced QR)
  signatureSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  frontSignatureLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  frontSignatureImage: {
    width: 60,
    height: 20,
    borderRadius: 2,
  },
  signaturePlaceholder: {
    width: 60,
    height: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signaturePlaceholderText: {
    fontSize: 6,
    color: '#8E8E93',
  },
  idCardFooter: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // ID Card Back Styles
  backHeader: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  backTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  backBody: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  backInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  backLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E3A8A',
    width: 70,
    marginRight: 8,
  },
  backValue: {
    fontSize: 10,
    color: '#1C1C1E',
    flex: 1,
    flexWrap: 'wrap',
  },
  addressSection: {
    marginBottom: 12,
  },
  addressText: {
    fontSize: 9,
    color: '#1C1C1E',
    lineHeight: 12,
    marginTop: 4,
  },
  // MD Signature section on back
  backSignatureSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  backSignatureLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  backSignatureImage: {
    width: 80,
    height: 25,
    borderRadius: 2,
  },
  backFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  returnInfo: {
    flex: 1,
  },
  returnText: {
    fontSize: 8,
    color: '#1E3A8A',
    fontWeight: '600',
    marginBottom: 2,
  },
  returnAddress: {
    fontSize: 7,
    color: '#1C1C1E',
    lineHeight: 9,
  },
  qrFooter: {
    alignItems: 'center',
  },
  backFooterText: {
    fontSize: 7,
    color: '#1E3A8A',
    fontWeight: '500',
    marginTop: 2,
  },
});