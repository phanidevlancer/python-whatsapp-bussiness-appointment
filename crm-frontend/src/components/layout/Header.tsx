'use client';

import { usePathname } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/appointments': 'Appointments',
  '/calendar': 'Calendar',
  '/customers': 'Customers',
  '/services': 'Services',
  '/providers': 'Providers',
  '/notifications': 'Notifications',
};

export default function Header() {
  const path = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const title = Object.entries(PAGE_TITLES).find(([k]) =>
    k === path || (k !== '/' && path.startsWith(k))
  )?.[1] ?? 'CRM';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={14} />
          <span>{user?.name ?? user?.email}</span>
          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full capitalize">
            {user?.role}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-gray-500 hover:text-red-600 text-sm transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
