import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { Button } from '@components/Button';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { roleLabel } from '@constants';
import { useResponsive } from '@hooks/useResponsive';

export default function SettingsScreen() {
  const { colors, mode, toggle } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const layout = useResponsive();

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <AppHeader title="Settings" subtitle="App preferences" showBack showMenu />
      <View style={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
          <View style={styles.themeRow}>
            <Text style={[styles.themeLabel, { color: colors.textSecondary }]}>Theme</Text>
            <Button
              title={mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              onPress={toggle}
              variant="outline"
              size="sm"
            />
          </View>
        </Card>

        {profile && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>
            <View style={styles.accountRow}>
              <Text style={[styles.accountLabel, { color: colors.textMuted }]}>Role</Text>
              <Text style={[styles.accountValue, { color: colors.gold }]}>{roleLabel(profile.role)}</Text>
            </View>
            <View style={styles.accountRow}>
              <Text style={[styles.accountLabel, { color: colors.textMuted }]}>Status</Text>
              <Text style={[styles.accountValue, { color: profile.status === 'active' ? colors.success : colors.error }]}>{profile.status}</Text>
            </View>
          </Card>
        )}

        <Button title="Sign Out" onPress={() => signOut()} variant="danger" />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeLabel: { fontSize: 14 },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  accountLabel: { fontSize: 14 },
  accountValue: { fontSize: 14, fontWeight: '500' },
});
