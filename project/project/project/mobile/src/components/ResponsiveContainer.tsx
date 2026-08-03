import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useResponsive } from '@hooks/useResponsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  centerOnTablet?: boolean;
}

export function ResponsiveContainer({ children, style, centerOnTablet }: ResponsiveContainerProps) {
  const layout = useResponsive();
  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: layout.padding, gap: layout.cardGap },
        centerOnTablet && layout.isTablet && { maxWidth: layout.contentMaxWidth, alignSelf: 'center' as const },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 } as ViewStyle,
});
