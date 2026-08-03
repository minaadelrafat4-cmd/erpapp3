import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '@store/themeStore';
import type { IconName } from '@apptypes';
import { getIconName } from '@config/icons';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = 'info', title, message, action }: EmptyStateProps) {
  const { colors } = useThemeStore();
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={getIconName(icon)} size={48} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  action: { marginTop: 8 },
});
