import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { TokenResponse } from '@/types/auth';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const form = new URLSearchParams();
      form.append('username', data.email);
      form.append('password', data.password);
      const res = await api.post<TokenResponse>('/api/v1/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAuth(data.access_token, data.user, data.permissions, data.must_change_password);
      if (data.must_change_password) {
        router.replace('/change-password');
        return;
      }
      router.push('/dashboard');
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();

  return () => {
    clearAuth();
    router.push('/login');
  };
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}
