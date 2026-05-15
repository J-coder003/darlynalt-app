import React from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';

interface CustomInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function CustomInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  ...rest
}: CustomInputProps) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 8,
    backgroundColor: '#111120',
    color: '#e0e0ff',
    fontSize: 15,
    height: 52,
  },
});
