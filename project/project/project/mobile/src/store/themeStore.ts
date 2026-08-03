import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode, ThemeColors } from '@apptypes';

const darkColors: ThemeColors = {
  background: '#0c0f13',
  surface: '#161b20',
  surfaceElevated: '#222830',
  border: '#ffffff1a',
  textPrimary: '#f6f7f9',
  textSecondary: '#aab2c0',
  textMuted: '#7c8696',
  gold: '#d4a649',
  goldLight: '#ddbd6b',
  goldDark: '#c08f2e',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  errorLight: '#ef444426',
  accent: '#1cae6f',
  accentDark: '#108a56',
  ink: '#0c0f13',
  overlay: '#00000099',
  tabInactive: '#7c8696',
};

const lightColors: ThemeColors = {
  background: '#f6f7f9',
  surface: '#ffffff',
  surfaceElevated: '#eceef2',
  border: '#0000001a',
  textPrimary: '#161b20',
  textSecondary: '#444c58',
  textMuted: '#7c8696',
  gold: '#c08f2e',
  goldLight: '#d4a649',
  goldDark: '#a3721f',
  success: '#10b981',
  warning: '#d97706',
  error: '#dc2626',
  errorLight: '#dc262620',
  accent: '#108a56',
  accentDark: '#0d6b42',
  ink: '#0c0f13',
  overlay: '#0000004d',
  tabInactive: '#aab2c0',
};

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

const THEME_KEY = '@luxe_erp_theme';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  loadMode: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  colors: darkColors,

  setMode: (mode) => {
    set({ mode, colors: getThemeColors(mode) });
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
  },

  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(next);
  },

  loadMode: () => {
    AsyncStorage.getItem(THEME_KEY).then((stored: string | null) => {
      if (stored === 'light' || stored === 'dark') {
        set({ mode: stored, colors: getThemeColors(stored) });
      }
    }).catch(() => {});
  },
}));
