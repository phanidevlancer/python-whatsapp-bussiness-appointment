'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  useRealtimeEvents();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
