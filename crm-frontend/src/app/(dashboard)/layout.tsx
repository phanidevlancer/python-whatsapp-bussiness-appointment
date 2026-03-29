'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { CurrentUserResponse } from '@/types/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const permissions = useAuthStore((s) => s.permissions);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(() => {
    const persistApi = (useAuthStore as typeof useAuthStore & {
      persist?: {
        hasHydrated?: () => boolean;
      };
    }).persist;
    return persistApi?.hasHydrated?.() ?? true;
  });
  const [bootstrappingSession, setBootstrappingSession] = useState(false);
  useRealtimeEvents();

  useEffect(() => {
    const persistApi = (useAuthStore as typeof useAuthStore & {
      persist?: {
        onFinishHydration?: (callback: () => void) => () => void;
      };
    }).persist;

    if (!persistApi) {
      return;
    }

    const unsubscribe = persistApi.onFinishHydration?.(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace('/login');
    }
  }, [hydrated, token, router]);

  useEffect(() => {
    if (!hydrated || !token || permissions.length > 0) {
      return;
    }

    let cancelled = false;

    const bootstrapSession = async () => {
      setBootstrappingSession(true);
      try {
        const res = await api.get<CurrentUserResponse>('/api/v1/auth/me');
        if (cancelled) return;
        setAuth(token, res.data.user, res.data.permissions, res.data.must_change_password);
      } catch {
        if (cancelled) return;
        clearAuth();
        router.replace('/login');
      } finally {
        if (!cancelled) {
          setBootstrappingSession(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, permissions.length, setAuth, clearAuth, router]);

  useEffect(() => {
    if (hydrated && token && mustChangePassword) {
      router.replace('/change-password');
    }
  }, [hydrated, token, mustChangePassword, router]);

  if (!hydrated || !token || mustChangePassword || bootstrappingSession) return null;

  return (
    <div className="theme-strong-shell flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <div className="theme-shell-accent pointer-events-none absolute left-0 top-0 -z-10 h-96 w-full rounded-br-[40px]" />
        <Header />
        <main className="relative z-10 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
