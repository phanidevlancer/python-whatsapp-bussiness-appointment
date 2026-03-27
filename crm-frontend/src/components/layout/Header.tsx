'use client';

import { usePathname } from 'next/navigation';
import { LogOut, User, Bell, Search, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/appointments': 'Appointments',
  '/calendar': 'Calendar',
  '/customers': 'Contacts',
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

  const userDisplayName = user?.name ?? user?.email ?? 'User';
  const userRole = user?.role ?? 'user';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Menu Button */}
        <button className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Home</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>

        {/* Search Bar - Zoho Style */}
        <div className="relative ml-8 max-w-md flex-1">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
          />
          <input
            type="text"
            placeholder="Search contacts, appointments..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-100 border border-transparent rounded-md focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Create Button */}
        <Button variant="primary" size="sm" className="hidden sm:flex bg-orange-600 hover:bg-orange-700">
          + Create
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-2 hidden sm:block" />

        {/* Notifications */}
        <IconButton variant="ghost" size="md" className="relative">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </IconButton>

        {/* Help */}
        <IconButton variant="ghost" size="md" className="hidden sm:flex">
          <span className="text-sm font-medium text-gray-600">Help</span>
        </IconButton>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-2 hidden sm:block" />

        {/* User Info */}
        <div className="flex items-center gap-2">
          <Avatar 
            name={userDisplayName} 
            size="sm"
            showStatus
            status="online"
          />
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-gray-900">{userDisplayName}</p>
            <p className="text-xs text-gray-500 capitalize">{userRole}</p>
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogOut size={16} />}
          className="text-gray-600 hover:text-red-600 hover:bg-red-50"
        >
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
