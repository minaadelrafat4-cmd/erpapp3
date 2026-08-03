import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@store/themeStore';
import type { NavItemConfig } from '@apptypes';
import { getIconName } from '@config/icons';

interface NavMenuProps {
  items: NavItemConfig[];
}

export function NavMenu({ items }: NavMenuProps) {
  const { colors } = useThemeStore();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/(app)/${item.key}` as never)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name={getIconName(item.icon)} size={22} color={colors.gold} />
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
            {item.description && (
              <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={1}>{item.description}</Text>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, padding: 16, borderWidth: 1 },
  labelContainer: { flex: 1 },
  label: { fontSize: 15, fontWeight: '500' },
  description: { fontSize: 12, marginTop: 2 },
});
