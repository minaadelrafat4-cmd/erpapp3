import React from 'react';
import { View, Text, TextInput, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { useThemeStore } from '@store/themeStore';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  hint?: string;
  style?: ViewStyle;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  hint,
  style,
}: InputProps) {
  const { colors } = useThemeStore();
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border, color: colors.textPrimary },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hintText, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 16 } as ViewStyle,
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 } as TextStyle,
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 } as TextStyle,
  errorText: { fontSize: 12, marginTop: 4 } as TextStyle,
  hintText: { fontSize: 12, marginTop: 4 } as TextStyle,
});
