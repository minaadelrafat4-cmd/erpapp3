import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScreenWrapper } from '@components/ScreenWrapper';
import { AppHeader } from '@components/AppHeader';
import { Card } from '@components/Card';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { LoadingState } from '@components/LoadingState';
import { ErrorState } from '@components/ErrorState';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { roleLabel } from '@constants';
import { useResponsive } from '@hooks/useResponsive';
import {
  useProfileWithBranch,
  useUpdateProfile,
  useUploadAvatar,
} from '@hooks/useERP';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getIconName } from '@config/icons';
import type { IconName, ThemeColors } from '@apptypes';

export default function ProfileScreen() {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const setProfile = useAuthStore((s) => s.setProfile);
  const layout = useResponsive();

  const profileQuery = useProfileWithBranch(profile?.id ?? null);
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const startEditing = useCallback(() => {
    setFullName(profileQuery.data?.full_name ?? '');
    setPhone(profileQuery.data?.phone ?? '');
    setEditing(true);
  }, [profileQuery.data]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
  }, []);

  const saveProfile = useCallback(async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const updated = await updateProfileMutation(profile.id, {
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setProfile(updated);
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [profile?.id, fullName, phone, updateProfileMutation, setProfile]);

  const pickAvatar = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      try {
        const publicUrl = await uploadAvatarMutation(profile.id, asset.uri, asset.mimeType ?? 'image/jpeg');
        const updated = await updateProfileMutation(profile.id, { avatar_url: publicUrl });
        setProfile(updated);
      } catch {
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
      } finally {
        setUploadingPhoto(false);
      }
    } catch {
      Alert.alert('Error', 'Could not access photo library.');
    }
  }, [profile?.id, uploadAvatarMutation, updateProfileMutation, setProfile]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut]);

  if (profileQuery.isLoading) {
    return (
      <ScreenWrapper edges={['top', 'bottom']}>
        <AppHeader title="Profile" subtitle="Account information" showBack showMenu />
        <LoadingState message="Loading profile…" />
      </ScreenWrapper>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ScreenWrapper edges={['top', 'bottom']}>
        <AppHeader title="Profile" subtitle="Account information" showBack showMenu />
        <ErrorState
          title="Failed to load profile"
          message="We couldn't load your profile information."
          onRetry={() => profileQuery.refetch()}
        />
      </ScreenWrapper>
    );
  }

  const data = profileQuery.data;
  const initials = (data.full_name || data.email || 'U').charAt(0).toUpperCase();

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <AppHeader title="Profile" subtitle="Account information" showBack showMenu />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: layout.padding, gap: layout.cardGap, maxWidth: layout.contentMaxWidth, alignSelf: layout.isTablet ? 'center' : 'stretch' }]}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploadingPhoto} activeOpacity={0.8}>
            {data.avatar_url ? (
              <Image source={{ uri: data.avatar_url }} style={[styles.avatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.gold }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <MaterialCommunityIcons name={getIconName('camera')} size={16} color={colors.gold} />
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.avatarInfo}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>
              {data.full_name || 'Staff Member'}
            </Text>
            <Text style={[styles.email, { color: colors.textSecondary }]}>{data.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.gold + '20' }]}>
              <Text style={[styles.roleText, { color: colors.gold }]}>{roleLabel(data.role)}</Text>
            </View>
          </View>
        </View>

        {/* Profile Information Card */}
        <Card>
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Profile Information</Text>
            {!editing && (
              <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
                <View style={styles.editButton}>
                  <MaterialCommunityIcons name={getIconName('edit')} size={16} color={colors.gold} />
                  <Text style={[styles.editText, { color: colors.gold }]}>Edit</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <View style={styles.editForm}>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
              <Input
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone"
                keyboardType="phone-pad"
              />
              <View style={styles.editActions}>
                <Button title="Cancel" onPress={cancelEditing} variant="outline" size="md" style={styles.editBtn} />
                <Button
                  title={saving ? 'Saving…' : 'Save'}
                  onPress={saveProfile}
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={saving}
                  style={styles.editBtn}
                />
              </View>
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <InfoRow label="Name" value={data.full_name ?? '—'} icon="user" colors={colors} />
              <InfoRow label="Email" value={data.email} icon="mail" colors={colors} />
              <InfoRow label="Role" value={roleLabel(data.role)} icon="shield" colors={colors} />
              <InfoRow label="Branch" value={data.branch_name ?? 'Not assigned'} icon="store" colors={colors} />
              {data.position && <InfoRow label="Position" value={data.position} icon="clipboard" colors={colors} />}
              <InfoRow label="Phone" value={data.phone ?? '—'} icon="phone" colors={colors} />
              <InfoRow
                label="Status"
                value={data.status}
                icon="check"
                colors={colors}
                valueColor={data.status === 'active' ? colors.success : colors.error}
              />
              <InfoRow
                label="Last Login"
                value={data.last_login_at ? new Date(data.last_login_at).toLocaleString() : '—'}
                icon="clock"
                colors={colors}
              />
            </View>
          )}
        </Card>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          size="lg"
          icon={<MaterialCommunityIcons name={getIconName('logout')} size={20} color={colors.error} />}
          style={styles.signOutBtn}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

function InfoRow({
  label,
  value,
  icon,
  colors,
  valueColor,
}: {
  label: string;
  value: string;
  icon: IconName;
  colors: ThemeColors;
  valueColor?: string;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={styles.infoLeft}>
        <MaterialCommunityIcons name={getIconName(icon)} size={18} color={colors.textMuted} />
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  avatarSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#0c0f13' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInfo: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  roleText: { fontSize: 12, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontSize: 14, fontWeight: '600' },
  infoContainer: { gap: 0 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', maxWidth: 180, textAlign: 'right' },
  editForm: { gap: 8 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn: { flex: 1 },
  signOutBtn: { marginTop: 8 },
});
