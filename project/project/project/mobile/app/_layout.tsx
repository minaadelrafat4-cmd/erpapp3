import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@lib/queryClient';
import { useAuthStore } from '@store/authStore';
import { useThemeStore } from '@store/themeStore';
import { LoadingScreen } from '@components/LoadingScreen';

export default function RootLayout() {
  const { initialized, initialize } = useAuthStore();
  const { mode, loadMode } = useThemeStore();

  React.useEffect(() => {
    loadMode();
    if (!initialized) initialize();
  }, [initialized, initialize, loadMode]);

  if (!initialized) return <LoadingScreen message="Starting LUXE ERP…" />;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="unauthorized" />
        <Stack.Screen name="not-found" />
      </Stack>
    </QueryClientProvider>
  );
}
