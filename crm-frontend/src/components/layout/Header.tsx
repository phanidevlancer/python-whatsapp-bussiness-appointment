'use client';

import { Search, Plus, HelpCircle, LogOut } from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';

export default function Header() {
  const logout = useLogout();

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 z-10">
      {/* Left: Title */}
      <h1 className="text-xl font-bold text-slate-900">ORA Clinic</h1>

      {/* Right: Search + Actions */}
      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search"
            className="pl-9 pr-4 py-1.5 text-sm bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 w-64 shadow-sm placeholder-slate-400"
          />
        </div>

        {/* Create */}
        <button className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors shadow-sm">
          <Plus size={14} className="mr-1.5" /> Create
        </button>

        {/* Help */}
        <button className="text-slate-500 hover:text-slate-700 flex items-center text-sm font-medium transition-colors">
          <HelpCircle size={15} className="mr-1.5" /> Help
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="text-slate-500 hover:text-slate-700 flex items-center text-sm font-medium transition-colors border-l border-slate-200 pl-4 ml-2"
        >
          <LogOut size={15} className="mr-1.5" /> Logout
        </button>
      </div>
    </header>
  );
}
