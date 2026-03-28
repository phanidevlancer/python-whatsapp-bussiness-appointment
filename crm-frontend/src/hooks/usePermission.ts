'use client';

import { useAuthStore } from '@/store/authStore';
import type { PermissionCode } from '@/lib/permissions';

export function usePermission(permission: PermissionCode | PermissionCode[]) {
  return useAuthStore((state) => {
    const permissions = state.permissions;
    const required = Array.isArray(permission) ? permission : [permission];
    return required.every((code) => permissions.includes(code));
  });
}

export function useHasPermission() {
  return useAuthStore((state) => state.hasPermission);
}
