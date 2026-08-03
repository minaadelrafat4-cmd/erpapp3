import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useThemeStore } from '@store/themeStore';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  const { colors } = useThemeStore();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.gold} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  message: { fontSize: 14 },
});
