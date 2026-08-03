import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { roleRank } from '@apptypes';
import type { UserRole } from '@apptypes';

interface RoleGateProps {
  children: React.ReactNode;
  minRank?: number;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
}

export function RoleGate({ children, minRank, allowedRoles, fallback }: RoleGateProps) {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const role = profile?.role;

  const hasAccess = (() => {
    if (!role) return false;
    if (allowedRoles && allowedRoles.length > 0) return allowedRoles.includes(role);
    if (minRank !== undefined) return roleRank(role) >= minRank;
    return true;
  })();

  if (!hasAccess) {
    return (
      fallback ?? (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Access Restricted</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              You don't have permission to view this content. Contact your administrator if you believe this is an error.
            </Text>
          </View>
        </SafeAreaView>
      )
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
