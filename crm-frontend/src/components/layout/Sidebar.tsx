'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  BookUser,
  BriefcaseMedical,
  UserRound,
  Bell,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

const nav = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/appointments',   label: 'Appointments',  icon: CalendarCheck },
  { href: '/calendar',       label: 'Calendar',      icon: Calendar },
  { href: '/customers',      label: 'Contacts',      icon: BookUser },
  { href: '/services',       label: 'Services',      icon: BriefcaseMedical },
  { href: '/providers',      label: 'Providers',     icon: UserRound },
  { href: '/notifications',  label: 'Notifications', icon: Bell },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-64 bg-slate-800 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold text-xl">
            C
          </div>
          <span className="font-bold text-xl text-white tracking-wide">ORA Clinic</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="mb-6">
          <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Main Menu
          </p>
          <div className="space-y-0.5">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = path === href || (href !== '/dashboard' && path.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-slate-700/50 text-white'
                      : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
                  )}
                >
                  <Icon
                    size={18}
                    className={clsx('shrink-0', active ? 'text-blue-400' : 'text-slate-500 group-hover:text-white')}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Settings Section */}
        <div className="border-t border-slate-700 pt-2">
          <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Settings
          </p>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700/30 hover:text-white transition-all duration-200"
          >
            <Settings size={18} className="text-slate-500" />
            <span>Preferences</span>
          </Link>
        </div>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-600/50">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin</p>
            <p className="text-xs text-slate-400 truncate">admin@clinic.com</p>
          </div>
          <ChevronDown size={14} className="text-slate-500 shrink-0" />
        </div>
      </div>
    </aside>
  );
}
