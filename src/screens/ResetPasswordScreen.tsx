import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { AuthStackParamList } from '../navigation/AuthStack';
import api from '../utils/api';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  // Token can come from deep link params or be typed manually
  const initialToken = (route.params as any)?.token || '';

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!token.trim()) return Alert.alert('Error', 'Please enter your reset token');
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters');
    if (password !== confirm) return Alert.alert('Error', 'Passwords do not match');

    try {
      setLoading(true);
      await api.post('/auth/reset-password', { token: token.trim(), password });
      setDone(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Invalid or expired token');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.orb1} />
        <View style={styles.inner}>
          <View style={styles.successIcon}>
            <Icon name="check-circle" size={40} color="#4ade80" />
          </View>
          <Text style={styles.title}>Password updated!</Text>
          <Text style={styles.subtitle}>
            Your password has been reset successfully. You can now sign in with your new password.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
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

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color="#7a6ff0" />
          </TouchableOpacity>

          <Text style={styles.brand}>DARLYN-ALT</Text>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Paste the token from your email and choose a new password.
          </Text>

          <View style={styles.card}>
            {/* Token */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Reset Token</Text>
              <View style={styles.inputRow}>
                <Icon name="key" size={16} color="#444488" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={token}
                  onChangeText={setToken}
                  placeholder="Paste token from email"
                  placeholderTextColor="#333366"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* New password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputRow}>
                <Icon name="lock" size={16} color="#444488" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#333366"
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                  <Icon name={showPwd ? 'eye' : 'eye-off'} size={16} color="#444488" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <Icon name="lock" size={16} color="#444488" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repeat new password"
                  placeholderTextColor="#333366"
                  secureTextEntry={!showPwd}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Reset Password</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(83,64,240,0.10)', top: -60, right: -80 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(37,99,235,0.07)', bottom: 80, left: -50 },
  inner: { width: '88%', maxWidth: 380 },
  backBtn: { marginBottom: 24 },
  brand: { fontSize: 12, fontWeight: '800', color: '#5340f0', letterSpacing: 4, marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555599', lineHeight: 22, marginBottom: 28 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a1a30', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  card: { backgroundColor: '#0e0e1c', borderRadius: 20, borderWidth: 0.5, borderColor: '#1e1e38', padding: 24, marginBottom: 20 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6666aa', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 12, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#e0e0ff', fontSize: 15 },
  eyeBtn: { padding: 4 },
  primaryBtn: { backgroundColor: '#4f35e8', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnDisabled: { backgroundColor: '#2a2a50' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkBtnText: { color: '#7a6ff0', fontSize: 14, fontWeight: '600' },
});
