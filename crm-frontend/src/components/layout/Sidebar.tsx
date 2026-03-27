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
} from 'lucide-react';
import { clsx } from 'clsx';

const nav = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/appointments',   label: 'Appointments',  icon: ClipboardList },
  { href: '/calendar',       label: 'Calendar',      icon: Calendar },
  { href: '/customers',      label: 'Customers',     icon: Users },
  { href: '/services',       label: 'Services',      icon: Stethoscope },
  { href: '/providers',      label: 'Providers',     icon: UserCog },
  { href: '/notifications',  label: 'Notifications', icon: Bell },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <span className="font-bold text-lg text-blue-600">Clinic CRM</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
