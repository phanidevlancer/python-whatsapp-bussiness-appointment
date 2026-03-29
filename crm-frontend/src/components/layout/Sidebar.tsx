'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  BookUser,
  BriefcaseMedical,
  UserRound,
  Bell,
  Settings,
  ChevronDown,
  UserX,
  Users,
  Shield,
  Megaphone,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { PERMISSIONS, type PermissionCode } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionCode;
}

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.dashboard.view },
  { href: '/appointments', label: 'Appointments', icon: CalendarCheck, permission: PERMISSIONS.appointments.view },
  { href: '/calendar', label: 'Calendar', icon: Calendar, permission: PERMISSIONS.appointments.view },
  { href: '/customers', label: 'Patients', icon: BookUser, permission: PERMISSIONS.customers.view },
  { href: '/leads', label: 'Leads', icon: UserX, permission: PERMISSIONS.leads.view },
  { href: '/services', label: 'Services', icon: BriefcaseMedical, permission: PERMISSIONS.services.view },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, permission: PERMISSIONS.services.manage },
  { href: '/providers', label: 'Providers', icon: UserRound, permission: PERMISSIONS.providers.view },
  { href: '/notifications', label: 'Notifications', icon: Bell, permission: PERMISSIONS.notifications.view },
  { href: '/users', label: 'Users', icon: Users, permission: PERMISSIONS.users.view },
  { href: '/role-templates', label: 'Role Templates', icon: Shield, permission: PERMISSIONS.roles.view },
] satisfies NavItem[];

export default function Sidebar() {
  const path = usePathname();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  const visibleNav = nav.filter((item) => !item.permission || hasPermission(item.permission));
  const initials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-r backdrop-blur-xl"
      style={{ borderColor: 'var(--sidebar-border)', background: 'var(--sidebar-background)' }}
    >
      {/* Logo */}
      <div className="flex h-20 items-center border-b px-6" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-[0_12px_24px_rgba(13,148,136,0.22)]">
            <BriefcaseMedical size={18} />
          </div>
          <div>
            <span className="block text-lg font-black tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>ORA Clinic</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>Clinical Workspace</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="mb-6">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>
            Main Menu
          </p>
          <div className="space-y-1">
            {visibleNav.map(({ href, label, icon: Icon }) => {
              const active = path === href || (href !== '/dashboard' && path.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
                    active ? 'text-[var(--sidebar-item-active-text)]' : 'hover:text-[color:var(--text-primary)]'
                  )}
                  style={
                    active
                      ? { background: 'var(--sidebar-item-active-bg)', boxShadow: 'var(--sidebar-item-active-shadow)' }
                      : { color: 'var(--text-secondary)' }
                  }
                  onMouseEnter={(event) => {
                    if (!active) event.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(event) => {
                    if (!active) event.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon
                    size={18}
                    className={clsx('shrink-0', active ? 'text-primary-600' : 'group-hover:text-primary-600')}
                    style={active ? undefined : { color: 'var(--text-tertiary)' }}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Settings Section */}
        <div className="border-t pt-3" style={{ borderColor: 'var(--sidebar-border)' }}>
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>
            Settings
          </p>
          {hasPermission(PERMISSIONS.settings.view) ? (
            <Link
              href="/settings"
              className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 hover:text-[color:var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--sidebar-item-hover)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <Settings size={18} className="group-hover:text-primary-600" style={{ color: 'var(--text-tertiary)' }} />
              <span>Preferences</span>
            </Link>
          ) : null}
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t p-4" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div
          className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors"
          style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-background)', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name ?? 'Admin'}</p>
            <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.email ?? 'admin@clinic.com'}</p>
          </div>
          <ChevronDown size={14} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>
    </aside>
  );
}
