import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { roleLabel } from '@constants';
import { getAccessibleNavGroups } from '@config/navigation';
import { getIconName } from '@config/icons';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 320);

export function DrawerContent() {
  const { colors } = useThemeStore();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, object | undefined>>>();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  if (!profile) return null;

  const groups = getAccessibleNavGroups(profile.role);
  const initials = (profile.full_name || profile.email || 'U').charAt(0).toUpperCase();

  const navigate = (key: string) => {
    router.push(`/(app)/${key}` as never);
    navigation.closeDrawer();
  };

  const handleSignOut = () => {
    navigation.closeDrawer();
    signOut();
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.gold }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {profile.full_name || 'Staff Member'}
          </Text>
          <Text style={[styles.email, { color: colors.textMuted }]} numberOfLines={1}>{profile.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.gold + '20' }]}>
            <Text style={[styles.roleText, { color: colors.gold }]}>{roleLabel(profile.role)}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.navSection} contentContainerStyle={styles.navContent}>
        {groups.map((group) => (
          <View key={group.config.key} style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.config.label}</Text>
            {group.items.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                onPress={() => navigate(item.key)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={getIconName(item.icon)} size={22} color={colors.textSecondary} />
                <Text style={[styles.navLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={[styles.signOut, { borderTopColor: colors.border }]} onPress={handleSignOut}>
        <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
        <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: DRAWER_WIDTH },
  header: { padding: 20, borderBottomWidth: 1, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0c0f13' },
  headerInfo: { gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 12 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  roleText: { fontSize: 11, fontWeight: '600' },
  navSection: { flex: 1, padding: 12 },
  navContent: { gap: 4 },
  group: { marginBottom: 8 },
  groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, letterSpacing: 0.5 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  navLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1 },
  signOutText: { fontSize: 15, fontWeight: '600' },
});
