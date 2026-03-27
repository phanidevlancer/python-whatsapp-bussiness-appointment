'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Stethoscope,
  UserCog,
  Bell,
  Settings,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

const nav = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/appointments',   label: 'Appointments',  icon: ClipboardList },
  { href: '/calendar',       label: 'Calendar',      icon: Calendar },
  { href: '/customers',      label: 'Contacts',      icon: Users },
  { href: '/services',       label: 'Services',      icon: Stethoscope },
  { href: '/providers',      label: 'Providers',     icon: UserCog },
  { href: '/notifications',  label: 'Notifications', icon: Bell },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-64 bg-gray-900 flex flex-col shrink-0 h-full">
      {/* Logo Section - Zoho Style */}
      <div className="h-14 flex items-center px-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
            <MessageSquare size={16} className="text-white" />
          </div>
          <div>
            <span className="font-semibold text-base text-white leading-tight">Clinic CRM</span>
          </div>
        </div>
      </div>

      {/* Navigation - Zoho Style */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <div className="mb-4">
          <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Main Menu
          </p>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== '/dashboard' && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon size={18} className={clsx('shrink-0', active ? 'text-white' : 'text-gray-500')} />
                <span>{label}</span>
                {active && (
                  <div className="ml-auto w-1 h-4 bg-white rounded-full" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Settings Section */}
        <div className="border-t border-gray-700 pt-2">
          <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Settings
          </p>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-200"
          >
            <Settings size={18} className="text-gray-500" />
            <span>Preferences</span>
          </Link>
        </div>
      </nav>

      {/* User Section - Zoho Style */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-gray-800">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin</p>
            <p className="text-xs text-gray-400 truncate">admin@clinic.com</p>
          </div>
          <ChevronDown size={16} className="text-gray-500" />
        </div>
      </div>
    </aside>
  );
}
