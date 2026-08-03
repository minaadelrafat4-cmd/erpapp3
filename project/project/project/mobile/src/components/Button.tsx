import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useThemeStore } from '@store/themeStore';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useThemeStore();
  const variantStyle = variantStyles(variant, colors);
  const sizeStyle = sizes[size];
  const textStyle = textStyles(variant, colors);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.base, variantStyle, sizeStyle, disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.ink : colors.gold} />
      ) : (
        <>
          {icon}
          <Text style={[textStyle, sizeStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const sizes = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  md: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  lg: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: 14 },
} as const;

function variantStyles(variant: string, c: ReturnType<typeof useThemeStore.getState>['colors']): ViewStyle {
  switch (variant) {
    case 'primary': return { backgroundColor: c.gold };
    case 'secondary': return { backgroundColor: c.surfaceElevated };
    case 'ghost': return {};
    case 'outline': return { borderWidth: 1, borderColor: c.gold };
    case 'danger': return { backgroundColor: c.errorLight };
    default: return {};
  }
}

function textStyles(variant: string, c: ReturnType<typeof useThemeStore.getState>['colors']): TextStyle {
  switch (variant) {
    case 'primary': return { color: c.ink, fontWeight: '600' };
    case 'secondary': return { color: c.textPrimary, fontWeight: '600' };
    case 'ghost': return { color: c.gold, fontWeight: '600' };
    case 'outline': return { color: c.gold, fontWeight: '600' };
    case 'danger': return { color: c.error, fontWeight: '600' };
    default: return { color: c.textPrimary, fontWeight: '600' };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as ViewStyle,
  disabled: {
    opacity: 0.4,
  } as ViewStyle,
});
