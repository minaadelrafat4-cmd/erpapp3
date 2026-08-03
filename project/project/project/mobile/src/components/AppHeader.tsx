import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '@store/themeStore';
import type { IconName } from '@apptypes';
import { getIconName } from '@config/icons';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showMenu?: boolean;
  rightIcon?: IconName;
  onRightPress?: () => void;
  onMenuPress?: () => void;
}

export function AppHeader({ title, subtitle, showBack, showMenu, rightIcon, onRightPress, onMenuPress }: AppHeaderProps) {
  const { colors } = useThemeStore();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, object | undefined>>>();

  const handleMenu = () => {
    if (onMenuPress) {
      onMenuPress();
    } else {
      navigation.openDrawer();
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
      <View style={[styles.container, { borderBottomColor: colors.border }]}>
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          {showMenu && (
            <TouchableOpacity onPress={handleMenu} style={styles.iconButton}>
              <MaterialCommunityIcons name="menu" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>}
          </View>
        </View>
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
            <MaterialCommunityIcons name={getIconName(rightIcon)} size={22} color={colors.gold} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconButton: { padding: 8 },
  titleContainer: { marginLeft: 8, flex: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
