import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useThemeStore } from '@store/themeStore';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: number;
}

export function Card({ children, style, elevated, padding = 20 }: CardProps) {
  const { colors } = useThemeStore();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
  } as ViewStyle,
});
