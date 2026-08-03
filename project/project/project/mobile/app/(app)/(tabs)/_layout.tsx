import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { roleRank } from '@apptypes';
import { TAB_ITEMS } from '@constants';
import { getIconName } from '@config/icons';

export default function TabsLayout() {
  const { colors } = useThemeStore();
  const profile = useAuthStore((s) => s.profile);
  const rank = roleRank(profile?.role);

  const visibleTabs = TAB_ITEMS.filter((tab) => rank >= tab.minRank);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      {visibleTabs.map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.key}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={getIconName(tab.icon)} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
