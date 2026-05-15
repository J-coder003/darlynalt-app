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
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
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

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = Math.min(screenWidth * 0.85, 340);
const cardHeight = cardWidth * 0.63;

const DEFAULT_MD_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

const API_BASE_URL = "https://darlyn-alt-backend-znbx.onrender.com";

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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates)
    }).then(res => res.json());
  },
  resetPassword: async (currentPassword: string, newPassword: string) => {
    const token = await AsyncStorage.getItem('token');
    return fetch(`${API_BASE_URL}/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword })
    }).then(res => res.json());
  }
};

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[1]?.[0] : '')).toUpperCase();
};

const generateStaffId = () => `STF${Math.floor(Math.random() * 900000) + 100000}`;

const calculateExpiryDate = (joinDate: string) => {
  try {
    const [day, month, year] = joinDate.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    date.setFullYear(date.getFullYear() + 5);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  } catch { return 'Invalid Date'; }
};

interface UserProfile { _id: string; name: string; email: string; role: string; }
interface IDCardData {
  staffId: string; department: string; position: string; dateOfJoining: string;
  expiryDate: string; emergencyContact: string; bloodGroup: string; address: string;
  phoneNumber: string; photo: string | null; signature: string | null; mdSignature: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:    { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24' },
  worker:   { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  customer: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
};
const getRoleStyle = (role: string) => ROLE_COLORS[role?.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.08)', text: '#aaaacc' };

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

  const [formData, setFormData] = useState({ name: '', email: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [idCardData, setIdCardData] = useState<IDCardData>({
    staffId: generateStaffId(), department: '', position: '', dateOfJoining: '',
    expiryDate: '', emergencyContact: '', bloodGroup: '', address: '',
    phoneNumber: '', photo: null, signature: null, mdSignature: DEFAULT_MD_SIGNATURE,
  });

  useEffect(() => { loadProfile(); loadIDCardData(); }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await userAPI.getProfile();
      setProfile(data);
      setFormData({ name: data.name || '', email: data.email || '' });
    } catch { Alert.alert('Error', 'Failed to load profile information'); }
    finally { setIsLoading(false); }
  };

  const loadIDCardData = async () => {
    try {
      // First try to load from backend (source of truth)
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const res = await fetch(`${API_BASE_URL}/users/id-card`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const serverData = await res.json();
          if (serverData) {
            serverData.mdSignature = serverData.mdSignature || DEFAULT_MD_SIGNATURE;
            setIdCardData(serverData);
            setHasExistingIDCard(true);
            // Keep local cache in sync
            await AsyncStorage.setItem('idCardData', JSON.stringify(serverData));
            return;
          }
        }
      }
      // Fallback to local cache
      const saved = await AsyncStorage.getItem('idCardData');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.mdSignature = parsed.mdSignature || DEFAULT_MD_SIGNATURE;
        setIdCardData(parsed);
        setHasExistingIDCard(true);
      }
    } catch { /* silent */ }
  };

  const saveIDCardData = async (data: IDCardData) => {
    try {
      // Save to backend
      const token = await AsyncStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE_URL}/users/id-card`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        });
      }
      // Also cache locally
      await AsyncStorage.setItem('idCardData', JSON.stringify(data));
      setHasExistingIDCard(true);
    } catch { /* silent */ }
  };

  const handleSaveProfile = async () => {
    if (!formData.name.trim() || !formData.email.trim()) { Alert.alert('Validation Error', 'Name and email are required'); return; }
    try {
      setSaving(true);
      const updated = await userAPI.updateProfile(formData);
      setProfile(updated); setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch { Alert.alert('Error', 'Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) { Alert.alert('Validation Error', 'Please fill in all password fields'); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { Alert.alert('Validation Error', 'New passwords do not match'); return; }
    if (passwordData.newPassword.length < 6) { Alert.alert('Validation Error', 'New password must be at least 6 characters'); return; }
    try {
      setSaving(true);
      await userAPI.resetPassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      Alert.alert('Success', 'Password updated successfully');
    } catch { Alert.alert('Error', 'Failed to update password. Please check your current password.'); }
    finally { setSaving(false); }
  };

  const pickImage = async (type: 'photo' | 'signature') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) { Alert.alert('Permission Required', 'Permission to access camera roll is required!'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: type === 'photo' ? [1, 1] : [3, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setIdCardData({ ...idCardData, [type]: result.assets[0].uri });
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
    const err = validateIDCardForm();
    if (err) { Alert.alert('Validation Error', err); return; }
    const expiryDate = calculateExpiryDate(idCardData.dateOfJoining);
    const updated = { ...idCardData, expiryDate, mdSignature: DEFAULT_MD_SIGNATURE };
    setIdCardData(updated); saveIDCardData(updated);
    setShowIDCardForm(false); setShowIDCardModal(true);
  };

  const exportIDCard = async () => {
    try {
      setIsExporting(true);
      const currentRef = cardSide === 'front' ? cardFrontRef : cardBackRef;
      if (!currentRef.current || !currentRef.current.capture) throw new Error('Card not ready');
      const capturePromise = (currentRef.current.capture as () => Promise<string>)();
      const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Capture timeout')), 5000));
      const uri = await Promise.race([capturePromise, timeoutPromise]);
      if (Platform.OS !== 'web') {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) { await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `ID Card - ${cardSide}` }); Alert.alert('Success', 'ID card exported!'); }
        else throw new Error('Sharing not available');
      } else {
        const link = document.createElement('a');
        link.href = uri; link.download = `${idCardData.staffId}_${cardSide}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        Alert.alert('Success', 'ID card downloaded!');
      }
      setIsExporting(false);
    } catch {
      setIsExporting(false);
      const instructions = Platform.OS !== 'web'
        ? 'Take a screenshot:\n• iPhone: Side Button + Volume Up\n• Android: Power + Volume Down'
        : 'Right-click the card → "Save image as..."';
      Alert.alert('Export Failed', `Unable to export automatically.\n\n${instructions}`, [{ text: 'OK' }]);
    }
  };

  const qrData = JSON.stringify({
    staffId: idCardData.staffId, name: profile?.name, email: profile?.email,
    department: idCardData.department, position: idCardData.position,
    phoneNumber: idCardData.phoneNumber, dateOfJoining: idCardData.dateOfJoining,
    expiryDate: idCardData.expiryDate, bloodGroup: idCardData.bloodGroup,
    emergencyContact: idCardData.emergencyContact, userId: profile?._id,
    address: idCardData.address, issuedDate: new Date().toISOString(),
  });

  const handleLogout = async () => {
    try { await AsyncStorage.removeItem('token'); dispatch(logout()); }
    catch { Alert.alert('Error', 'Failed to log out'); }
  };

  // ── ID Card components (visual unchanged, these render into ViewShot for export) ──
  const IDCardFront = () => (
    <ViewShot ref={cardFrontRef} options={{ format: 'png', quality: 1.0 }}>
      <View style={[cardStyles.idCard, cardStyles.idCardFront]}>
        <View style={cardStyles.idCardHeader}>
          <Text style={cardStyles.companyName}>Darlyn-Alt LTD</Text>
          <Text style={cardStyles.idCardTitle}>EMPLOYEE ID CARD</Text>
        </View>
        <View style={cardStyles.idCardBody}>
          <View style={cardStyles.leftSection}>
            <View style={cardStyles.photoSection}>
              {idCardData.photo ? (
                <Image source={{ uri: idCardData.photo }} style={cardStyles.employeePhoto} />
              ) : (
                <View style={cardStyles.photoPlaceholder}>
                  <Ionicons name="person" size={30} color="#1E3A8A" />
                </View>
              )}
            </View>
            <View style={cardStyles.signatureSection}>
              <Text style={cardStyles.frontSignatureLabel}>Employee</Text>
              {idCardData.signature ? (
                <Image source={{ uri: idCardData.signature }} style={cardStyles.frontSignatureImage} />
              ) : (
                <View style={cardStyles.signaturePlaceholder}>
                  <Text style={cardStyles.signaturePlaceholderText}>Signature</Text>
                </View>
              )}
            </View>
          </View>
          <View style={cardStyles.rightSection}>
            <Text style={cardStyles.employeeName} numberOfLines={2}>{profile?.name}</Text>
            <Text style={cardStyles.staffId}>ID: {idCardData.staffId}</Text>
            <Text style={cardStyles.department} numberOfLines={1}>{idCardData.department}</Text>
            <Text style={cardStyles.position} numberOfLines={1}>{idCardData.position}</Text>
            <Text style={cardStyles.validityText}>Valid: {idCardData.dateOfJoining} - {idCardData.expiryDate}</Text>
          </View>
        </View>
        <View style={cardStyles.idCardFooter}>
          <Text style={cardStyles.footerText}>Valid Employee Identification</Text>
        </View>
      </View>
    </ViewShot>
  );

  const IDCardBack = () => (
    <ViewShot ref={cardBackRef} options={{ format: 'png', quality: 1.0 }}>
      <View style={[cardStyles.idCard, cardStyles.idCardBack]}>
        <View style={cardStyles.backHeader}>
          <Text style={cardStyles.backTitle}>DARLYN-ALT LTD</Text>
        </View>
        <View style={cardStyles.backBody}>
          {[
            { label: 'Email:', value: profile?.email },
            { label: 'Phone:', value: idCardData.phoneNumber },
            { label: 'Blood:', value: idCardData.bloodGroup || 'N/A' },
            { label: 'Emergency:', value: idCardData.emergencyContact || 'N/A' },
          ].map(({ label, value }) => (
            <View key={label} style={cardStyles.backInfoRow}>
              <Text style={cardStyles.backLabel}>{label}</Text>
              <Text style={cardStyles.backValue} numberOfLines={1}>{value}</Text>
            </View>
          ))}
          <View style={cardStyles.addressSection}>
            <Text style={cardStyles.backLabel}>Address:</Text>
            <Text style={cardStyles.addressText} numberOfLines={2}>{idCardData.address}</Text>
          </View>
          <View style={cardStyles.backSignatureSection}>
            <Text style={cardStyles.backSignatureLabel}>Managing Director</Text>
            {idCardData.mdSignature && (
              <Image source={{ uri: idCardData.mdSignature }} style={cardStyles.backSignatureImage} />
            )}
          </View>
        </View>
        <View style={cardStyles.backFooter}>
          <View style={cardStyles.returnInfo}>
            <Text style={cardStyles.returnText}>If found, please return to:</Text>
            <Text style={cardStyles.returnAddress}>3 Olofin Close, Off Ajoke salako Street,</Text>
            <Text style={cardStyles.returnAddress}>Gbagada, Ifako, Lagos</Text>
            <Text style={cardStyles.returnAddress}>08072768813, 08068883461</Text>
            <Text style={cardStyles.returnAddress}>info@darlyn-altglobal.com</Text>
            <Text style={cardStyles.returnAddress}>www.darlyn-altglobal.com</Text>
          </View>
          <View style={cardStyles.qrFooter}>
            <QRCode value={qrData} size={35} backgroundColor="transparent" color="#1E3A8A" />
            <Text style={cardStyles.backFooterText}>Scan</Text>
          </View>
        </View>
      </View>
    </ViewShot>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5340f0" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Icon name="alert-circle" size={48} color="#ff6b6b" />
          <Text style={styles.errorTitle}>Failed to load profile</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roleStyle = getRoleStyle(profile.role);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Header ── */}
        <View style={styles.topHeader}>
          <Text style={styles.headerBrand}>DARLYN-ALT</Text>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* ── Avatar Card ── */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.avatarName}>{profile.name}</Text>
            <Text style={styles.avatarEmail}>{profile.email}</Text>
            <View style={[styles.rolePill, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.rolePillText, { color: roleStyle.text }]}>{profile.role?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Profile Info Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          <View style={styles.infoRow}>
            <Icon name="hash" size={14} color="#444466" />
            <View style={styles.infoRowContent}>
              <Text style={styles.infoRowLabel}>USER ID</Text>
              <Text style={styles.infoRowValueMuted} numberOfLines={1}>{profile._id}</Text>
            </View>
            <Icon name="lock" size={13} color="#2a2a50" />
          </View>

          <View style={styles.infoRow}>
            <Icon name="shield" size={14} color="#444466" />
            <View style={styles.infoRowContent}>
              <Text style={styles.infoRowLabel}>ROLE</Text>
              <Text style={styles.infoRowValue}>{profile.role}</Text>
            </View>
            <Icon name="lock" size={13} color="#2a2a50" />
          </View>

          {/* Editable Fields */}
          <View style={styles.editableBlock}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              {isEditing ? (
                <View style={styles.inputRow}>
                  <Icon name="user" size={15} color="#444488" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.name}
                    onChangeText={(t) => setFormData({ ...formData, name: t })}
                    placeholder="Your full name"
                    placeholderTextColor="#333366"
                    autoCapitalize="words"
                  />
                </View>
              ) : (
                <Text style={styles.fieldValue}>{profile.name}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              {isEditing ? (
                <View style={styles.inputRow}>
                  <Icon name="mail" size={15} color="#444488" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(t) => setFormData({ ...formData, email: t })}
                    placeholder="you@example.com"
                    placeholderTextColor="#333366"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <Text style={styles.fieldValue}>{profile.email}</Text>
              )}
            </View>

            {isEditing ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setFormData({ name: profile.name, email: profile.email }); setIsEditing(false); }} disabled={isSaving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)} activeOpacity={0.8}>
                <Icon name="edit-2" size={14} color="#ffffff" />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── ID Card Section (workers only) ── */}
        {profile.role === 'worker' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employee ID Card</Text>
            <Text style={styles.sectionSubtitle}>
              {hasExistingIDCard ? 'Your ID card is ready to view or export.' : 'Generate your official ID card with QR verification.'}
            </Text>
            <View style={styles.buttonRow}>
              {hasExistingIDCard ? (
                <>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowIDCardModal(true)} activeOpacity={0.8}>
                    <Icon name="eye" size={14} color="#7a6ff0" />
                    <Text style={styles.outlineBtnText}>View Card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineBtnGreen} onPress={exportIDCard} disabled={isExporting} activeOpacity={0.8}>
                    {isExporting ? <ActivityIndicator size="small" color="#4ade80" /> : <Icon name="download" size={14} color="#4ade80" />}
                    <Text style={styles.outlineBtnTextGreen}>{isExporting ? 'Exporting...' : 'Export'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineBtnPurple} onPress={() => setShowIDCardForm(true)} activeOpacity={0.8}>
                    <Icon name="edit-2" size={14} color="#cc66ff" />
                    <Text style={styles.outlineBtnTextPurple}>Edit</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.editBtn} onPress={() => setShowIDCardForm(true)} activeOpacity={0.8}>
                  <Icon name="credit-card" size={14} color="#ffffff" />
                  <Text style={styles.editBtnText}>Generate ID Card</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Security Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          {!showPasswordForm ? (
            <TouchableOpacity style={styles.outlineBtnFull} onPress={() => setShowPasswordForm(true)} activeOpacity={0.8}>
              <Icon name="lock" size={14} color="#7a6ff0" />
              <Text style={styles.outlineBtnFullText}>Reset Password</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordBlock}>
              {[
                { key: 'currentPassword', label: 'CURRENT PASSWORD', placeholder: 'Enter current password' },
                { key: 'newPassword', label: 'NEW PASSWORD', placeholder: 'Enter new password' },
                { key: 'confirmPassword', label: 'CONFIRM NEW PASSWORD', placeholder: 'Confirm new password' },
              ].map(({ key, label, placeholder }) => (
                <View key={key} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <View style={styles.inputRow}>
                    <Icon name="lock" size={15} color="#444488" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={passwordData[key as keyof typeof passwordData]}
                      onChangeText={(t) => setPasswordData({ ...passwordData, [key]: t })}
                      placeholder={placeholder}
                      placeholderTextColor="#333366"
                      secureTextEntry
                    />
                  </View>
                </View>
              ))}
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPasswordForm(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} disabled={isSaving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleResetPassword} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Account / Logout ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Icon name="log-out" size={14} color="#ff6b6b" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── ID Card Form Modal ── */}
      <Modal visible={showIDCardForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <SafeAreaView style={{ backgroundColor: '#0a0a0f' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIDCardForm(false)}>
                <Icon name="x" size={22} color="#5340f0" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{hasExistingIDCard ? 'Edit ID Card' : 'Generate ID Card'}</Text>
              <View style={{ width: 22 }} />
            </View>
          </SafeAreaView>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Staff ID (read-only) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>STAFF ID (AUTO-GENERATED)</Text>
              <View style={[styles.inputRow, { opacity: 0.5 }]}>
                <Icon name="hash" size={15} color="#444488" style={styles.inputIcon} />
                <Text style={[styles.input, { paddingVertical: 14 }]}>{idCardData.staffId}</Text>
              </View>
            </View>

            {[
              { key: 'department', label: 'DEPARTMENT *', placeholder: 'e.g., Engineering, HR, Sales' },
              { key: 'position', label: 'POSITION *', placeholder: 'e.g., Software Developer, Manager' },
              { key: 'dateOfJoining', label: 'DATE OF EMPLOYMENT *', placeholder: 'DD/MM/YYYY' },
              { key: 'phoneNumber', label: 'PHONE NUMBER *', placeholder: 'Enter phone number', keyboard: 'phone-pad' },
              { key: 'bloodGroup', label: 'BLOOD GROUP', placeholder: 'e.g., A+, B-, O+' },
              { key: 'emergencyContact', label: 'EMERGENCY CONTACT', placeholder: 'Emergency contact number', keyboard: 'phone-pad' },
            ].map(({ key, label, placeholder, keyboard }) => (
              <View key={key} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { paddingLeft: 0 }]}
                    value={idCardData[key as keyof IDCardData] as string}
                    onChangeText={(t) => setIdCardData({ ...idCardData, [key]: t })}
                    placeholder={placeholder}
                    placeholderTextColor="#333366"
                    keyboardType={(keyboard as any) ?? 'default'}
                    autoCapitalize="sentences"
                  />
                </View>
              </View>
            ))}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ADDRESS</Text>
              <TextInput
                style={[styles.inputRowText, { height: 90 }]}
                value={idCardData.address}
                onChangeText={(t) => setIdCardData({ ...idCardData, address: t })}
                placeholder="Enter full address"
                placeholderTextColor="#333366"
                multiline numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Photo Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMPLOYEE PHOTO *</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('photo')} activeOpacity={0.8}>
                {idCardData.photo ? (
                  <Image source={{ uri: idCardData.photo }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon name="camera" size={28} color="#444466" />
                    <Text style={styles.imagePlaceholderText}>Upload Employee Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Signature Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMPLOYEE SIGNATURE *</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('signature')} activeOpacity={0.8}>
                {idCardData.signature ? (
                  <Image source={{ uri: idCardData.signature }} style={styles.signaturePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon name="edit-3" size={28} color="#444466" />
                    <Text style={styles.imagePlaceholderText}>Upload Employee Signature</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerateIDCard} activeOpacity={0.85}>
              <Icon name="credit-card" size={15} color="#fff" />
              <Text style={styles.primaryBtnText}>{hasExistingIDCard ? 'Update ID Card' : 'Generate ID Card'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── ID Card View Modal ── */}
      <Modal visible={showIDCardModal} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          <SafeAreaView style={{ backgroundColor: '#0a0a0f' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowIDCardModal(false)}>
                <Icon name="x" size={22} color="#5340f0" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Employee ID Card</Text>
              <TouchableOpacity onPress={exportIDCard} disabled={isExporting}>
                {isExporting ? <ActivityIndicator size="small" color="#5340f0" /> : <Icon name="share-2" size={20} color="#5340f0" />}
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <ScrollView contentContainerStyle={styles.cardViewContent}>
            {/* Toggle */}
            <View style={styles.cardToggle}>
              {(['front', 'back'] as const).map((side) => (
                <TouchableOpacity
                  key={side}
                  style={[styles.toggleBtn, cardSide === side && styles.toggleBtnActive]}
                  onPress={() => setCardSide(side)}
                >
                  <Text style={[styles.toggleBtnText, cardSide === side && styles.toggleBtnTextActive]}>
                    {side.charAt(0).toUpperCase() + side.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.cardWrapper}>
              {cardSide === 'front' ? <IDCardFront /> : <IDCardBack />}
            </View>

            <Text style={styles.cardHint}>
              {cardSide === 'front'
                ? 'Front side — photo, signature & details'
                : 'Back side — QR verification & emergency info'}
            </Text>
            <Text style={styles.cardValidity}>
              Valid {idCardData.dateOfJoining} → {idCardData.expiryDate}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// ID Card visual styles — unchanged so card renders correctly
// ─────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  idCard: { width: cardWidth, height: cardHeight, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5EA' },
  idCardFront: { backgroundColor: '#FFFFFF' },
  idCardBack: { backgroundColor: '#FFFFFF', borderColor: '#1E3A8A', borderWidth: 2 },
  idCardHeader: { backgroundColor: '#1E3A8A', paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  companyName: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 1 },
  idCardTitle: { fontSize: 10, color: '#FFFFFF', marginTop: 2 },
  idCardBody: { flex: 1, flexDirection: 'row', padding: 12, backgroundColor: '#FFFFFF' },
  leftSection: { alignItems: 'center', marginRight: 12, justifyContent: 'space-between' },
  photoSection: { alignItems: 'center' },
  employeePhoto: { width: 70, height: 80, borderRadius: 8, borderWidth: 2, borderColor: '#1E3A8A' },
  photoPlaceholder: { width: 70, height: 80, borderRadius: 8, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1E3A8A' },
  rightSection: { flex: 1, justifyContent: 'space-between' },
  employeeName: { fontSize: 14, fontWeight: 'bold', color: '#1E3A8A', marginBottom: 3 },
  staffId: { fontSize: 11, color: '#1C1C1E', marginBottom: 5 },
  department: { fontSize: 10, color: '#1C1C1E', marginBottom: 3 },
  position: { fontSize: 9, color: '#1C1C1E', marginBottom: 6 },
  validityText: { fontSize: 8, color: '#8E8E93', fontWeight: '500' },
  signatureSection: { alignItems: 'center', marginTop: 6 },
  frontSignatureLabel: { fontSize: 7, fontWeight: '600', color: '#1E3A8A', marginBottom: 3 },
  frontSignatureImage: { width: 45, height: 18, borderRadius: 2 },
  signaturePlaceholder: { width: 45, height: 18, backgroundColor: '#F2F2F7', borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  signaturePlaceholderText: { fontSize: 6, color: '#8E8E93' },
  idCardFooter: { backgroundColor: '#1E3A8A', paddingVertical: 5, paddingHorizontal: 12, alignItems: 'center' },
  footerText: { fontSize: 9, color: '#FFFFFF', fontWeight: '500' },
  backHeader: { backgroundColor: '#1E3A8A', paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  backTitle: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 1 },
  backBody: { flex: 1, padding: 12, backgroundColor: '#FFFFFF' },
  backInfoRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-start' },
  backLabel: { fontSize: 9, fontWeight: '600', color: '#1E3A8A', width: 65, marginRight: 6 },
  backValue: { fontSize: 9, color: '#1C1C1E', flex: 1, flexWrap: 'wrap' },
  addressSection: { marginBottom: 8 },
  addressText: { fontSize: 8, color: '#1C1C1E', lineHeight: 11, marginTop: 3 },
  backSignatureSection: { alignItems: 'center', marginBottom: 8 },
  backSignatureLabel: { fontSize: 8, fontWeight: '600', color: '#1E3A8A', marginBottom: 3 },
  backSignatureImage: { width: 70, height: 22, borderRadius: 2 },
  backFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F8F9FF', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  returnInfo: { flex: 1 },
  returnText: { fontSize: 7, color: '#1E3A8A', fontWeight: '600', marginBottom: 2 },
  returnAddress: { fontSize: 6.5, color: '#1C1C1E', lineHeight: 8 },
  qrFooter: { alignItems: 'center' },
  backFooterText: { fontSize: 6, color: '#1E3A8A', fontWeight: '500', marginTop: 2 },
});

// ─────────────────────────────────────────────────────────
// App UI styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6666aa' },
  errorTitle: { fontSize: 16, color: '#ff6b6b', fontWeight: '600' },
  retryBtn: { backgroundColor: '#5340f0', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a30',
  },
  headerBrand: { fontSize: 11, fontWeight: '800', color: '#5340f0', letterSpacing: 4, marginBottom: 6 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: 0.2 },

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 18,
    backgroundColor: '#0e0e1c',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#1e1e38',
    gap: 16,
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#5340f0',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#7a6aff',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  avatarInfo: { flex: 1, gap: 3 },
  avatarName: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  avatarEmail: { fontSize: 13, color: '#555577' },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, marginTop: 4,
  },
  rolePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  section: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#0e0e1c',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#1e1e38',
    padding: 18,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6666aa', letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' },
  sectionSubtitle: { fontSize: 13, color: '#444466', marginTop: -8, marginBottom: 14, lineHeight: 18 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1a1a30',
  },
  infoRowContent: { flex: 1 },
  infoRowLabel: { fontSize: 10, fontWeight: '600', color: '#444466', letterSpacing: 1, marginBottom: 3 },
  infoRowValue: { fontSize: 14, color: '#ccccee' },
  infoRowValueMuted: { fontSize: 12, color: '#444466', fontFamily: 'monospace' },

  editableBlock: { marginTop: 12, gap: 14 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#555577', letterSpacing: 1.2 },
  fieldValue: { fontSize: 15, color: '#ddddff', paddingVertical: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40',
    borderRadius: 12, paddingHorizontal: 14, height: 52,
  },
  inputRowText: {
    backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40',
    borderRadius: 12, paddingHorizontal: 14, paddingTop: 14,
    color: '#e0e0ff', fontSize: 15,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#e0e0ff', fontSize: 15 },

  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4f35e8', paddingVertical: 14, borderRadius: 12,
    shadowColor: '#5340f0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40',
  },
  cancelBtnText: { color: '#8888bb', fontSize: 14, fontWeight: '500' },
  saveBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#4f35e8',
    shadowColor: '#5340f0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  outlineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, borderWidth: 0.5,
    borderColor: '#2a2a60', backgroundColor: 'rgba(99,102,241,0.08)',
  },
  outlineBtnText: { color: '#7a6ff0', fontSize: 13, fontWeight: '600' },
  outlineBtnGreen: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, borderWidth: 0.5,
    borderColor: '#1a4a2a', backgroundColor: 'rgba(34,197,94,0.06)',
  },
  outlineBtnTextGreen: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  outlineBtnPurple: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, borderWidth: 0.5,
    borderColor: '#3a1a5a', backgroundColor: 'rgba(204,102,255,0.06)',
  },
  outlineBtnTextPurple: { color: '#cc66ff', fontSize: 13, fontWeight: '600' },
  outlineBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 0.5,
    borderColor: '#2a2a60', backgroundColor: 'rgba(99,102,241,0.08)',
  },
  outlineBtnFullText: { color: '#7a6ff0', fontSize: 14, fontWeight: '600' },

  passwordBlock: { gap: 14 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 0.5,
    borderColor: '#3a1a1a', backgroundColor: 'rgba(255,107,107,0.06)',
  },
  logoutBtnText: { color: '#ff6b6b', fontSize: 14, fontWeight: '600' },

  // Modals
  modalContainer: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#1a1a30',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  modalContent: { padding: 24, paddingBottom: 50 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4f35e8', paddingVertical: 16, borderRadius: 14, marginTop: 8,
    shadowColor: '#5340f0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 7,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  imagePicker: {
    borderWidth: 0.5, borderColor: '#2a2a40', borderStyle: 'dashed',
    borderRadius: 14, padding: 20, alignItems: 'center', backgroundColor: '#0d0d18',
  },
  imagePreview: { width: 100, height: 100, borderRadius: 10 },
  signaturePreview: { width: 150, height: 50, borderRadius: 6 },
  imagePlaceholder: { alignItems: 'center', gap: 8, padding: 16 },
  imagePlaceholderText: { fontSize: 13, color: '#444466' },

  // ID Card View
  cardViewContent: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  cardToggle: {
    flexDirection: 'row', backgroundColor: '#111120', borderRadius: 10,
    marginBottom: 24, borderWidth: 0.5, borderColor: '#2a2a40',
  },
  toggleBtn: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#5340f0' },
  toggleBtnText: { fontSize: 14, fontWeight: '500', color: '#444466' },
  toggleBtnTextActive: { color: '#fff' },
  cardWrapper: { marginBottom: 20 },
  cardHint: { fontSize: 13, color: '#555577', textAlign: 'center', lineHeight: 18, marginBottom: 4 },
  cardValidity: { fontSize: 12, color: '#5340f0', fontWeight: '500' },
});