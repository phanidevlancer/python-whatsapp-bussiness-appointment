'use client';

import { HelpCircle, LogOut, Plus, Search } from 'lucide-react';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

export default function Header() {
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const initials = user?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <header className="sticky top-0 z-20 flex h-20 flex-shrink-0 items-center justify-between border-b border-white/60 bg-white/70 px-8 backdrop-blur-xl">
      <div>
        <h1 className="text-xl font-black tracking-[-0.03em] text-slate-900">ORA Clinic</h1>
        <p className="text-xs font-medium text-slate-500">Operations and patient workflow</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden lg:block">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search people, appointments, services..."
            className="h-12 w-80 rounded-full border-0 bg-slate-100/85 pl-11 pr-4 text-sm text-slate-700 shadow-none ring-1 ring-transparent placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <button className="flex h-11 items-center rounded-2xl border border-primary-500/20 bg-primary-600 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(13,148,136,0.18)] transition-colors hover:bg-primary-700">
          <Plus size={15} className="mr-2" /> Create
        </button>

        <button className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
          <HelpCircle size={17} />
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition-colors hover:bg-white"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-slate-900">{user?.name ?? 'Admin'}</p>
            <p className="text-xs text-slate-500">Logout</p>
          </div>
          <LogOut size={15} className="text-slate-400" />
        </button>
      </div>
    </header>
  );
}
