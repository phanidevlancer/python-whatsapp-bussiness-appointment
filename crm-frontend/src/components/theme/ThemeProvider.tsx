'use client';

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  appThemes,
  defaultThemeId,
  getThemeById,
  getThemeTokens,
  themeTokenNames,
  type AppThemeId,
  type ThemeAppearance,
  type ThemeAppearancePreference,
} from '@/lib/theme/themes';

const THEME_STORAGE_KEY = 'crm-theme';
const APPEARANCE_PREFERENCE_STORAGE_KEY = 'crm-theme-appearance';
const PREFERS_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function isThemeAppearancePreference(value: string | null): value is ThemeAppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getSafeLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSafeLocalStorageItem(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so theme initialization and updates keep working.
  }
}

function getSystemAppearance(): ThemeAppearance {
  if (typeof window === 'undefined') {
    return 'light';
  }

  if (typeof window.matchMedia !== 'function') {
    return 'light';
  }

  try {
    return window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function getStoredAppearancePreference(): ThemeAppearancePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const storedAppearancePreference = getSafeLocalStorageItem(APPEARANCE_PREFERENCE_STORAGE_KEY);
  return isThemeAppearancePreference(storedAppearancePreference) ? storedAppearancePreference : 'system';
}

function subscribeToSystemAppearance(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if (typeof window.matchMedia !== 'function') {
    return () => {};
  }

  let mediaQuery: MediaQueryList;

  try {
    mediaQuery = window.matchMedia(PREFERS_DARK_MEDIA_QUERY);
  } catch {
    return () => {};
  }

  const handleChange = () => {
    onStoreChange();
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }

  mediaQuery.addListener(handleChange);
  return () => {
    mediaQuery.removeListener(handleChange);
  };
}

interface ThemeContextValue {
  themeId: AppThemeId;
  setThemeId: (themeId: AppThemeId) => void;
  appearancePreference: ThemeAppearancePreference;
  setAppearancePreference: (appearancePreference: ThemeAppearancePreference) => void;
  resolvedAppearance: ThemeAppearance;
  themes: typeof appThemes;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(
  themeId: AppThemeId,
  resolvedAppearance: ThemeAppearance,
  appearancePreference: ThemeAppearancePreference,
) {
  const root = document.documentElement;
  const tokens = getThemeTokens(themeId, resolvedAppearance);

  root.dataset.theme = themeId;
  root.dataset.appearance = resolvedAppearance;
  root.dataset.appearancePreference = appearancePreference;

  themeTokenNames.forEach((tokenName) => {
    root.style.setProperty(`--${tokenName}`, tokens[tokenName]);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<AppThemeId>(() => {
    if (typeof window === 'undefined') {
      return defaultThemeId;
    }

    const storedTheme = getSafeLocalStorageItem(THEME_STORAGE_KEY);
    return getThemeById(storedTheme ?? defaultThemeId).id;
  });
  const [appearancePreference, setAppearancePreference] = useState<ThemeAppearancePreference>(() =>
    getStoredAppearancePreference(),
  );
  const systemAppearance = useSyncExternalStore(
    appearancePreference === 'system' ? subscribeToSystemAppearance : () => () => {},
    getSystemAppearance,
    () => 'light',
  );
  const resolvedAppearance = appearancePreference === 'system' ? systemAppearance : appearancePreference;

  useEffect(() => {
    applyTheme(themeId, resolvedAppearance, appearancePreference);
  }, [appearancePreference, resolvedAppearance, themeId]);

  useEffect(() => {
    setSafeLocalStorageItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  useEffect(() => {
    setSafeLocalStorageItem(APPEARANCE_PREFERENCE_STORAGE_KEY, appearancePreference);
  }, [appearancePreference]);

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      appearancePreference,
      setAppearancePreference,
      resolvedAppearance,
      themes: appThemes,
    }),
    [appearancePreference, resolvedAppearance, themeId]
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
