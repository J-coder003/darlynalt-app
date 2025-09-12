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
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
