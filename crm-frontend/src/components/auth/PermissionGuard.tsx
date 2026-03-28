'use client';

import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { PermissionCode } from '@/lib/permissions';

interface Props {
  permission: PermissionCode | PermissionCode[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PermissionGuard({ permission, children, fallback = null }: Props) {
  const allowed = usePermission(permission);
  return allowed ? children : fallback;
}
