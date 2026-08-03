import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { EmptyState } from '@components/EmptyState';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { useResponsive } from '@hooks/useResponsive';
import { roleLabel } from '@constants';
import type { IconName } from '@apptypes';

interface PlaceholderScreenProps {
  moduleName: string;
  moduleDescription: string;
  icon?: IconName;
}

export function PlaceholderScreen({ moduleName, moduleDescription, icon = 'info' }: PlaceholderScreenProps) {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const layout = useResponsive();

  return (
    <ScreenWrapper>
      <AppHeader title={moduleName} subtitle={moduleDescription} showBack showMenu />
      <View style={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
        <Card>
          <View style={styles.comingSoonRow}>
            <Text style={[styles.comingSoon, { color: colors.gold }]}>Coming Soon</Text>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{moduleName} Module</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {moduleDescription}. This module is part of the LUXE ERP mobile companion app and will be implemented in the next development phase.
          </Text>
        </Card>

        <Card elevated style={styles.statusCard}>
          <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Module Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.gold }]} />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>Foundation Ready</Text>
          </View>
          <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
            Navigation, theming, and role-based access control are configured for this module.
          </Text>
        </Card>

        {profile && (
          <Card style={styles.accessCard}>
            <Text style={[styles.accessLabel, { color: colors.textMuted }]}>Your Access</Text>
            <Text style={[styles.accessRole, { color: colors.gold }]}>{roleLabel(profile.role)}</Text>
            <Text style={[styles.accessDesc, { color: colors.textSecondary }]}>
              Your role determines which modules and actions are available.
            </Text>
          </Card>
        )}

        <View style={styles.emptyWrapper}>
          <EmptyState
            icon={icon}
            title="No Data Yet"
            message="Data for this module will appear here once the feature is implemented."
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  comingSoonRow: { marginBottom: 8 },
  comingSoon: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 22 },
  statusCard: { gap: 8 },
  statusLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusDesc: { fontSize: 13, lineHeight: 20 },
  accessCard: { gap: 4 },
  accessLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  accessRole: { fontSize: 16, fontWeight: '600' },
  accessDesc: { fontSize: 13, lineHeight: 20 },
  emptyWrapper: { flex: 1, minHeight: 200 },
});
