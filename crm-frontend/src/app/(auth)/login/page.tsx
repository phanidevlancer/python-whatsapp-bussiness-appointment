'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedCharactersLoginPage from '@/components/ui/animated-characters-login-page';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [hydrated, setHydrated] = useState(() => {
    const persistApi = (useAuthStore as typeof useAuthStore & {
      persist?: {
        hasHydrated?: () => boolean;
      };
    }).persist;
    return persistApi?.hasHydrated?.() ?? true;
  });

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
    if (hydrated && token) {
      router.replace('/dashboard');
    }
  }, [hydrated, token, router]);

  if (!hydrated) return null;
  if (token) return null;

  return <AnimatedCharactersLoginPage />;
}
