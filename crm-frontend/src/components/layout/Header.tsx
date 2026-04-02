'use client';

import { useState } from 'react';
import { LogOut, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import type { AppThemeId, ThemeAppearancePreference } from '@/lib/theme/themes';
import { FluidDropdown, type FluidDropdownOption } from '@/components/ui/fluid-dropdown';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

function isThemeId(value: string, themes: Array<{ id: AppThemeId }>): value is AppThemeId {
  return themes.some((theme) => theme.id === value);
}

function isAppearancePreference(value: string): value is ThemeAppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const { themeId, setThemeId, themes, appearancePreference, setAppearancePreference } =
    useTheme();
  const themeOptions: Array<FluidDropdownOption<AppThemeId>> = themes.map((theme: { id: AppThemeId; label: string }) => ({
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
      className="sticky top-0 z-20 flex min-h-20 flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-3 py-3 backdrop-blur-xl sm:px-4 lg:h-20 lg:flex-nowrap lg:px-8 lg:py-0"
      style={{ borderColor: 'var(--topbar-border)', background: 'var(--topbar-background)' }}
    >
      <div className="flex items-center gap-3">
        {onMenuClick ? (
          <button
            type="button"
            aria-label="Open navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border lg:hidden"
            style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-background)' }}
            onClick={onMenuClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        ) : null}
        <h1 className="text-xl font-black tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>
          ORA Clinic
        </h1>
        <p className="hidden text-xs font-medium sm:block" style={{ color: 'var(--text-secondary)' }}>
          Operations and patient workflow
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
        <div className="hidden items-center gap-2 xl:flex">
          <div className="flex min-w-[180px] flex-col gap-1">
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
              className="dashboard-surface-input h-11 w-full rounded-2xl border px-1 text-sm font-medium shadow-none lg:h-12"
            />
          </div>

          <div className="flex min-w-[180px] flex-col gap-1">
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
              className="dashboard-surface-input h-11 w-full rounded-2xl border px-1 text-sm font-medium shadow-none lg:h-12"
            />
          </div>
        </div>

        <button
          type="button"
          aria-label="Open theme settings"
          className="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors hover:[background:color-mix(in_srgb,var(--surface-container-low)_88%,transparent)] xl:hidden"
          style={{ color: 'var(--text-secondary)' }}
          onClick={() => setIsThemeModalOpen(true)}
        >
          <Palette size={17} />
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

      <Modal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} size="md">
        <ModalHeader>
          <ModalTitle>Theme settings</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
              Theme
            </p>
            <FluidDropdown
              value={themeId}
              options={themeOptions}
              onChange={(value) => {
                if (isThemeId(value, themes)) {
                  setThemeId(value);
                }
              }}
              className="dashboard-surface-input h-11 w-full rounded-2xl border px-1 text-sm font-medium shadow-none"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
              Appearance
            </p>
            <FluidDropdown
              value={appearancePreference}
              options={appearanceOptions}
              onChange={(value) => {
                if (isAppearancePreference(value)) {
                  setAppearancePreference(value);
                }
              }}
              className="dashboard-surface-input h-11 w-full rounded-2xl border px-1 text-sm font-medium shadow-none"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={() => setIsThemeModalOpen(false)}>
            Done
          </Button>
        </ModalFooter>
      </Modal>
    </header>
  );
}
