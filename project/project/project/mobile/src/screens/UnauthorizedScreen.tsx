import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@store/themeStore';
import { Button } from '@components/Button';

export default function UnauthorizedScreen() {
  const { colors } = useThemeStore();
  const router = useRouter();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.code, { color: colors.error }]}>403</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Access Denied</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          You don't have permission to access this screen. Contact your administrator if you believe this is an error.
        </Text>
        <Button title="Go to Dashboard" onPress={() => router.replace('/(app)/(tabs)/dashboard' as never)} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  code: { fontSize: 64, fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  message: { fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 20 },
  button: { marginTop: 24 },
});
