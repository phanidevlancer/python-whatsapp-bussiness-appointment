'use client';

import { HelpCircle, LogOut, Plus, Search, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import type { AppThemeId, ThemeAppearancePreference } from '@/lib/theme/themes';
import { FluidDropdown, type FluidDropdownOption } from '@/components/ui/fluid-dropdown';

function isThemeId(value: string, themes: Array<{ id: AppThemeId }>): value is AppThemeId {
  return themes.some((theme) => theme.id === value);
}

function isAppearancePreference(value: string): value is ThemeAppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export default function Header() {
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const { themeId, setThemeId, themes, appearancePreference, setAppearancePreference } =
    useTheme();
  const themeOptions: Array<FluidDropdownOption<AppThemeId>> = themes.map((theme) => ({
    id: theme.id,
    label: theme.label,
    icon: Palette,
    color: 'var(--primary-600)',
  }));
  const appearanceOptions: Array<FluidDropdownOption<ThemeAppearancePreference>> = [
    { id: 'light', label: 'Light', icon: Sun, color: '#f59e0b' },
    { id: 'dark', label: 'Dark', icon: Moon, color: '#6366f1' },
    { id: 'system', label: 'System', icon: Monitor, color: '#14b8a6' },
  ];
  const initials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <header
      className="sticky top-0 z-20 flex h-20 flex-shrink-0 items-center justify-between border-b px-8 backdrop-blur-xl"
      style={{ borderColor: 'var(--topbar-border)', background: 'var(--topbar-background)' }}
    >
      <div>
        <h1 className="text-xl font-black tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>
          ORA Clinic
        </h1>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Operations and patient workflow
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden lg:block">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search people, appointments, services..."
            className="dashboard-surface-input h-12 w-80 rounded-full border pl-11 pr-4 text-sm shadow-none ring-1 ring-transparent placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary-200"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        <div className="hidden items-center gap-3 xl:flex">
          <div className="flex min-w-[210px] flex-col gap-1">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
              Theme
            </span>
            <FluidDropdown
              value={themeId}
              options={themeOptions}
              onChange={(value) => {
                if (isThemeId(value, themes)) {
                  setThemeId(value);
                }
              }}
              className="dashboard-surface-input h-12 w-full rounded-2xl border px-1 text-sm font-medium shadow-none"
            />
          </div>

          <div className="flex min-w-[210px] flex-col gap-1">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
              Appearance
            </div>
            <FluidDropdown
              value={appearancePreference}
              options={appearanceOptions}
              onChange={(value) => {
                if (isAppearancePreference(value)) {
                  setAppearancePreference(value);
                }
              }}
              className="dashboard-surface-input h-12 w-full rounded-2xl border px-1 text-sm font-medium shadow-none"
            />
          </div>
        </div>

        <button
          className="flex h-11 items-center rounded-2xl border border-primary-500/20 bg-primary-600 px-5 text-sm font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)] transition-colors hover:bg-primary-700"
          style={{ color: 'var(--text-inverse)' }}
        >
          <Plus size={15} className="mr-2" style={{ color: 'var(--text-inverse)' }} />
          <span style={{ color: 'var(--text-inverse)' }}>Create</span>
        </button>

        <button
          type="button"
          aria-label="Open help"
          title="Open help"
          className="flex h-11 w-11 items-center justify-center rounded-2xl transition-colors hover:[background:color-mix(in_srgb,var(--surface-container-low)_88%,transparent)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <HelpCircle size={17} />
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-2xl border px-3 py-2 transition-colors"
          style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-background)', boxShadow: 'var(--shadow-md)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold"
            style={{ color: 'var(--text-inverse)' }}
          >
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {user?.name ?? 'Admin'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Logout
            </p>
          </div>
          <LogOut size={15} style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>
    </header>
  );
}
