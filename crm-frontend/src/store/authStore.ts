import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminUser } from '@/types/auth';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  permissions: string[];
  mustChangePassword: boolean;
  setAuth: (token: string, user: AdminUser, permissions?: string[], mustChangePassword?: boolean) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      permissions: [],
      mustChangePassword: false,
      setAuth: (token, user, permissions = [], mustChangePassword = false) =>
        set({ token, user, permissions, mustChangePassword }),
      clearAuth: () => set({ token: null, user: null, permissions: [], mustChangePassword: false }),
      hasPermission: (permission) => get().permissions.includes(permission),
    }),
    { name: 'crm-auth' }
  )
);
