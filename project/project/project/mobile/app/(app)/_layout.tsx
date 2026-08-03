import React from 'react';
import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/build/layouts/Drawer';
import { useAuthStore } from '@store/authStore';
import { isStaffRole } from '@apptypes';
import { useThemeStore } from '@store/themeStore';
import { DrawerContent } from '@components/DrawerContent';

export default function AppLayout() {
  const profile = useAuthStore((s) => s.profile);
  const { colors } = useThemeStore();

  if (!profile) return <Redirect href="/(auth)/login" />;
  if (!isStaffRole(profile.role)) return <Redirect href="/(auth)/login" />;

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerPosition: 'left',
        drawerStyle: {
          width: 320,
          backgroundColor: colors.surface,
        },
        overlayColor: colors.overlay,
        drawerActiveTintColor: colors.gold,
        drawerInactiveTintColor: colors.textSecondary,
        drawerLabelStyle: { fontWeight: '500' },
      }}
      drawerContent={() => <DrawerContent />}
    >
      <Drawer.Screen name="(tabs)" />
      <Drawer.Screen name="profile" />
      <Drawer.Screen name="products" />
      <Drawer.Screen name="categories" />
      <Drawer.Screen name="warehouses" />
      <Drawer.Screen name="branches" />
      <Drawer.Screen name="suppliers" />
      <Drawer.Screen name="purchase-orders" />
      <Drawer.Screen name="sales-orders" />
      <Drawer.Screen name="customers" />
      <Drawer.Screen name="employees" />
      <Drawer.Screen name="reports" />
      <Drawer.Screen name="analytics" />
      <Drawer.Screen name="notifications" />
      <Drawer.Screen name="tasks" />
      <Drawer.Screen name="settings" />
      <Drawer.Screen name="help" />
    </Drawer>
  );
}
