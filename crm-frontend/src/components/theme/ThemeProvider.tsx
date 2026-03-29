'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { appThemes, defaultThemeId, getThemeById, themeTokenNames, type AppThemeId } from '@/lib/theme/themes';

const THEME_STORAGE_KEY = 'crm-theme';

interface ThemeContextValue {
  themeId: AppThemeId;
  setThemeId: (themeId: AppThemeId) => void;
  themes: typeof appThemes;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(themeId: AppThemeId) {
  const root = document.documentElement;
  const theme = getThemeById(themeId);
  root.dataset.theme = theme.id;

  themeTokenNames.forEach((tokenName) => {
    root.style.setProperty(`--${tokenName}`, theme.tokens[tokenName]);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<AppThemeId>(() => {
    if (typeof window === 'undefined') {
      return defaultThemeId;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return getThemeById(storedTheme ?? defaultThemeId).id;
  });

  useEffect(() => {
    applyTheme(themeId);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      themes: appThemes,
    }),
    [themeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
