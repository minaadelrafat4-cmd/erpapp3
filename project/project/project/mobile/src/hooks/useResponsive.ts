import { useState, useEffect } from 'react';
import { Dimensions, type ScaledSize } from 'react-native';

export type DeviceType = 'phone' | 'tablet';

export interface ResponsiveLayout {
  isTablet: boolean;
  isPhone: boolean;
  width: number;
  height: number;
  columns: number;
  padding: number;
  cardGap: number;
  contentMaxWidth: number;
}

function computeLayout(width: number): ResponsiveLayout {
  const isTablet = width >= 768;
  return {
    isTablet,
    isPhone: !isTablet,
    width,
    height: Dimensions.get('window').height,
    columns: isTablet ? 3 : 2,
    padding: isTablet ? 32 : 20,
    cardGap: isTablet ? 20 : 16,
    contentMaxWidth: isTablet ? 800 : width,
  };
}

export function useResponsive(): ResponsiveLayout {
  const [layout, setLayout] = useState<ResponsiveLayout>(() => {
    const { width } = Dimensions.get('window');
    return computeLayout(width);
  });

  useEffect(() => {
    const handler = (dims: { window: ScaledSize }) => {
      setLayout(computeLayout(dims.window.width));
    };
    const sub = Dimensions.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  return layout;
}

export function getCardWidth(layout: ResponsiveLayout, cardCount: number): number {
  const availableWidth = layout.width - layout.padding * 2 - layout.cardGap * (cardCount - 1);
  return Math.floor(availableWidth / cardCount);
}
