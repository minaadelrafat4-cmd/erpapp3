import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '@store/themeStore';
import type { IconName } from '@apptypes';
import { getIconName } from '@config/icons';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useThemeStore();
  return <MaterialCommunityIcons name={getIconName(name)} size={size} color={color ?? colors.textPrimary} />;
}
