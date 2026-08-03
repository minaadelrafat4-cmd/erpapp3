import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@store/themeStore';
import { Button } from '@components/Button';

export default function ErrorScreen() {
  const { colors } = useThemeStore();
  const router = useRouter();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.code, { color: colors.error }]}>Oops!</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Something Went Wrong</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          An unexpected error occurred. Please try again or restart the app.
        </Text>
        <Button title="Go to Dashboard" onPress={() => router.replace('/(app)/dashboard' as never)} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  code: { fontSize: 48, fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  message: { fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 20 },
  button: { marginTop: 24 },
});
