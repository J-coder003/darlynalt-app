// src/screens/SignupScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { signupUser } from '../store/authSlice';
import { AppDispatch, RootState } from '../store/store';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStack';
import Icon from 'react-native-vector-icons/Feather';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const { width } = Dimensions.get('window');

type FieldName = 'name' | 'email' | 'phone' | 'altPhone' | 'password';

export default function SignupScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((s: RootState) => s.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [additionalPhoneNumber, setAdditionalPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'customer' | 'worker'>('customer');
  const [focused, setFocused] = useState<FieldName | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSignup = () => {
    if (!name || !email || !password || !phoneNumber) {
      Alert.alert('Validation', 'Please enter name, email, password, and phone number');
      return;
    }
    const trimmedAdditional = additionalPhoneNumber.trim();
    if (trimmedAdditional.length > 0 && !/^\+?[0-9]{7,15}$/.test(trimmedAdditional)) {
      Alert.alert('Validation', 'Additional phone number must be valid');
      return;
    }
    dispatch(signupUser({ name, email, password, role, phoneNumber, additionalPhoneNumber: trimmedAdditional }));
  };

  const inputRow = (
    field: FieldName,
    icon: string,
    placeholder: string,
    value: string,
    onChange: (t: string) => void,
    options?: { secure?: boolean; keyboard?: any; toggle?: () => void }
  ) => (
    <View style={[styles.inputRow, focused === field && styles.inputRowFocused]}>
      <Icon name={icon} size={16} color={focused === field ? '#7a6ff0' : '#444488'} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#333366"
        secureTextEntry={options?.secure}
        keyboardType={options?.keyboard ?? 'default'}
        autoCapitalize="none"
        onFocus={() => setFocused(field)}
        onBlur={() => setFocused(null)}
      />
      {options?.toggle && (
        <TouchableOpacity onPress={options.toggle} style={styles.eyeBtn}>
          <Icon name={showPassword ? 'eye' : 'eye-off'} size={16} color="#444488" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.brand}>DARLYN-ALT</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join and book home services with ease</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            {/* Role selector */}
            <View style={styles.roleSection}>
              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'customer' && styles.roleBtnActive]}
                  onPress={() => setRole('customer')}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="user"
                    size={15}
                    color={role === 'customer' ? '#ffffff' : '#555599'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.roleBtnText, role === 'customer' && styles.roleBtnTextActive]}>
                    Customer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'worker' && styles.roleBtnActive]}
                  onPress={() => setRole('worker')}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="briefcase"
                    size={15}
                    color={role === 'worker' ? '#ffffff' : '#555599'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.roleBtnText, role === 'worker' && styles.roleBtnTextActive]}>
                    Staff
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              {inputRow('name', 'user', 'John Doe', name, setName)}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              {inputRow('email', 'mail', 'you@example.com', email, setEmail, { keyboard: 'email-address' })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              {inputRow('phone', 'phone', '+234 800 000 0000', phoneNumber, setPhoneNumber, { keyboard: 'phone-pad' })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Additional Phone{' '}
                <Text style={styles.optional}>(optional)</Text>
              </Text>
              {inputRow('altPhone', 'phone-call', '+234 800 000 0001', additionalPhoneNumber, setAdditionalPhoneNumber, { keyboard: 'phone-pad' })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              {inputRow('password', 'lock', '••••••••', password, setPassword, {
                secure: !showPassword,
                toggle: () => setShowPassword(!showPassword),
              })}
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={14} color="#ff6b6b" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(83, 64, 240, 0.10)',
    top: -60,
    right: -80,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(37, 99, 235, 0.07)',
    bottom: 80,
    left: -50,
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  inner: {
    width: '100%',
  },
  header: {
    marginBottom: 28,
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5340f0',
    letterSpacing: 4,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#555599',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#0e0e1c',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#1e1e38',
    padding: 24,
    marginBottom: 24,
  },
  roleSection: {
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    backgroundColor: '#111120',
  },
  roleBtnActive: {
    backgroundColor: '#4f35e8',
    borderColor: '#5340f0',
    shadowColor: '#5340f0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555599',
  },
  roleBtnTextActive: {
    color: '#ffffff',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#1e1e38',
    marginVertical: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6666aa',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  optional: {
    color: '#333366',
    fontWeight: '400',
    textTransform: 'none',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111120',
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputRowFocused: {
    borderColor: '#5340f0',
    backgroundColor: '#13132a',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#e0e0ff',
    fontSize: 15,
    height: 52,
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#4f35e8',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#5340f0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: '#2a2a50',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#444488',
    fontSize: 13,
  },
  footerLink: {
    color: '#7a6ff0',
    fontSize: 13,
    fontWeight: '600',
  },
});