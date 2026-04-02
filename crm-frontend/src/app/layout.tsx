'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { appThemes, defaultThemeId, themeTokenNames } from '@/lib/theme/themes';
import { queryClient } from '@/lib/queryClient';
import './globals.css';

const themeBootstrapScript = `(() => {
  const themes = ${JSON.stringify(appThemes)};
  const tokenNames = ${JSON.stringify(themeTokenNames)};
  const defaultThemeId = ${JSON.stringify(defaultThemeId)};
  const themeStorageKey = 'crm-theme';
  const appearanceStorageKey = 'crm-theme-appearance';

  const isAppearancePreference = (value) => value === 'light' || value === 'dark' || value === 'system';
  const getThemeById = (themeId) => themes.find((theme) => theme.id === themeId) ?? themes[0];

  let themeId = defaultThemeId;
  let appearancePreference = 'system';

  try {
    const storedThemeId = window.localStorage.getItem(themeStorageKey);
    if (storedThemeId && themes.some((theme) => theme.id === storedThemeId)) {
      themeId = storedThemeId;
    }

    const storedAppearancePreference = window.localStorage.getItem(appearanceStorageKey);
    if (isAppearancePreference(storedAppearancePreference)) {
      appearancePreference = storedAppearancePreference;
    }
  } catch {}

  const supportsMatchMedia = typeof window.matchMedia === 'function';
  const systemAppearance =
    supportsMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const resolvedAppearance = appearancePreference === 'system' ? systemAppearance : appearancePreference;

  const root = document.documentElement;
  const theme = getThemeById(themeId);
  const tokens = theme.modes[resolvedAppearance].tokens;

  root.dataset.theme = theme.id;
  root.dataset.appearance = resolvedAppearance;
  root.dataset.appearancePreference = appearancePreference;

  tokenNames.forEach((tokenName) => {
    root.style.setProperty('--' + tokenName, tokens[tokenName]);
  });
})();`;

const faviconHref =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230d9488'/%3E%3Cpath d='M9 9h14v14H9z' fill='none' stroke='white' stroke-width='2.5'/%3E%3C/svg%3E";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href={faviconHref} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="h-full antialiased">
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster position="top-right" />
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
