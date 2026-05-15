import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

export interface CustomButtonProps {
  title: string;
  onPress: () => void;
  backgroundColor?: string;
  disabled?: boolean; // ✅ Added
  loading?: boolean; // ✅ Optional if you want to show spinner
}

export default function CustomButton({ title, onPress, backgroundColor = '#2563eb', disabled = false, loading = false }: CustomButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: disabled ? '#9ca3af' : backgroundColor }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(83, 64, 240, 0.3)',
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
