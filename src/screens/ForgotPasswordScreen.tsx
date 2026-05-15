import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { AuthStackParamList } from '../navigation/AuthStack';
import api from '../utils/api';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return Alert.alert('Error', 'Please enter your email address');

    try {
      setLoading(true);
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <View style={styles.inner}>
          <View style={styles.successIcon}>
            <Icon name="mail" size={40} color="#7c8bff" />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a password reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <Text style={styles.hint}>
            Open the email and tap "Reset via Web" or copy the token and use it in the app.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('ResetPassword')}
          >
            <Icon name="key" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>I have a reset token</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color="#7a6ff0" />
        </TouchableOpacity>

        <Text style={styles.brand}>DARLYN-ALT</Text>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a reset link.
        </Text>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Icon name="mail" size={16} color="#444488" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#333366"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!email.trim() || loading) && styles.primaryBtnDisabled]}
            onPress={handleSend}
            disabled={loading || !email.trim()}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.primaryBtnText}>Send Reset Link</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkBtnText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(83,64,240,0.10)', top: -60, right: -80 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(37,99,235,0.07)', bottom: 80, left: -50 },
  inner: { width: '88%', maxWidth: 380 },
  backBtn: { marginBottom: 24 },
  brand: { fontSize: 12, fontWeight: '800', color: '#5340f0', letterSpacing: 4, marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555599', lineHeight: 22, marginBottom: 28 },
  emailHighlight: { color: '#7c8bff', fontWeight: '600' },
  hint: { fontSize: 13, color: '#444488', lineHeight: 20, marginBottom: 28, textAlign: 'center' },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a1a30', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  card: { backgroundColor: '#0e0e1c', borderRadius: 20, borderWidth: 0.5, borderColor: '#1e1e38', padding: 24, marginBottom: 20 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#6666aa', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 12, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#e0e0ff', fontSize: 15 },
  primaryBtn: { backgroundColor: '#4f35e8', paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  primaryBtnDisabled: { backgroundColor: '#2a2a50' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkBtnText: { color: '#7a6ff0', fontSize: 14, fontWeight: '600' },
});
