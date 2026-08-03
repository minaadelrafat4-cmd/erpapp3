import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@store/themeStore';

interface ScreenWrapperProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  safeArea?: boolean;
}

export function ScreenWrapper({ children, edges = ['top'], style, safeArea = true }: ScreenWrapperProps) {
  const { colors } = useThemeStore();
  const content = (
    <View style={[styles.content, style]}>{children}</View>
  );

  if (!safeArea) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}>{content}</View>;
  }

  return (
    <SafeAreaView edges={edges} style={[styles.container, { backgroundColor: colors.background }]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
