import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@store/themeStore';

interface LoadingStateProps {
  message?: string;
  inline?: boolean;
}

export function LoadingState({ message = 'Loading…', inline }: LoadingStateProps) {
  const { colors } = useThemeStore();
  if (inline) {
    return (
      <View style={styles.inline}>
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  inline: { padding: 32, alignItems: 'center' },
  message: { fontSize: 14 },
});
