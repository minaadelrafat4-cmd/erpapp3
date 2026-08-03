import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@store/themeStore';

export default function SplashScreen() {
  const { colors } = useThemeStore();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.gold }]}>LUXE</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>ERP Enterprise Suite</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 48, fontWeight: '900', letterSpacing: 4 },
  tagline: { fontSize: 14, marginTop: 8, letterSpacing: 1 },
});
