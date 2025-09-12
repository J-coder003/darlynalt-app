// src/screens/SignupScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import { useDispatch, useSelector } from 'react-redux';
import { signupUser } from '../store/authSlice';
import { AppDispatch, RootState } from '../store/store';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((s: RootState) => s.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'worker'>('customer');

  const handleSignup = () => {
    if (!email || !password || !name) {
      Alert.alert('Validation', 'Please enter name, email and password');
      return;
    }
    dispatch(signupUser({ name, email, password, role }));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <CustomInput value={name} onChangeText={setName} placeholder="Full name" />
      <CustomInput value={email} onChangeText={setEmail} placeholder="Email" />
      <CustomInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 }}>
        <CustomButton title="Customer" onPress={() => setRole('customer')} backgroundColor={role === 'customer' ? '#2563eb' : '#9ca3af'} />
        <CustomButton title="Worker" onPress={() => setRole('worker')} backgroundColor={role === 'worker' ? '#2563eb' : '#9ca3af'} />
      </View>

      {error ? <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text> : null}

      <CustomButton title={loading ? 'Signing up...' : 'Signup'} onPress={handleSignup} />
      <CustomButton title="Back to Login" onPress={() => navigation.navigate('Login')} backgroundColor="#6b7280" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
});
