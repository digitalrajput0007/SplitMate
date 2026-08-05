import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, activeTheme, updateGlobalThemeColors } from '../theme';

export type ThemeMode = 'System' | 'Light' | 'Dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof LightColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'Light',
  setThemeMode: () => {},
  colors: LightColors,
  isDark: false,
});

const THEME_STORAGE_KEY = '@splitmate_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('Light');
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'System' || stored === 'Light' || stored === 'Dark') {
        setThemeModeState(stored as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  };

  const isDark =
    themeMode === 'Dark' || (themeMode === 'System' && systemColorScheme === 'dark');

  const colors = isDark ? DarkColors : LightColors;
  updateGlobalThemeColors(colors);
  activeTheme.isDark = isDark;

  return (
    <ThemeContext.Provider key={isDark ? 'dark-theme' : 'light-theme'} value={{ themeMode, setThemeMode, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
