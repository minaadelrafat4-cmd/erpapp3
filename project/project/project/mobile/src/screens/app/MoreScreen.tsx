import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { NavMenu } from '@components/NavMenu';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { roleLabel } from '@constants';
import { getAccessibleNavGroups } from '@config/navigation';
import { useResponsive } from '@hooks/useResponsive';

export default function MoreScreen() {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const layout = useResponsive();

  if (!profile) return null;

  const groups = getAccessibleNavGroups(profile.role);

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <AppHeader title="More" subtitle="All modules" showMenu />
      <View style={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}>
        <Card>
          <View style={styles.accountRow}>
            <View style={[styles.avatar, { backgroundColor: colors.gold }]}>
              <Text style={styles.avatarText}>
                {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, { color: colors.textPrimary }]}>{profile.full_name || 'Staff Member'}</Text>
              <Text style={[styles.accountEmail, { color: colors.textMuted }]}>{profile.email}</Text>
              <View style={[styles.roleBadge, { backgroundColor: colors.gold + '20' }]}>
                <Text style={[styles.roleText, { color: colors.gold }]}>{roleLabel(profile.role)}</Text>
              </View>
            </View>
          </View>
        </Card>

        {groups.map((group) => (
          <View key={group.config.key} style={styles.groupSection}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.config.label}</Text>
            <NavMenu items={group.items} />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => signOut()}
        >
          <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 16 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0c0f13' },
  accountInfo: { flex: 1, gap: 2 },
  accountName: { fontSize: 16, fontWeight: '600' },
  accountEmail: { fontSize: 13 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  roleText: { fontSize: 11, fontWeight: '600' },
  groupSection: { gap: 8 },
  groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  signOutButton: { borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  signOutText: { fontSize: 16, fontWeight: '600' },
});
