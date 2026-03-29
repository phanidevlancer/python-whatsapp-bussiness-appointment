'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Lock, SquareCheckBig } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PERMISSION_GROUPS, type PermissionCode } from '@/lib/permissions';
import type { PermissionCatalogGroup } from '@/hooks/useRoleTemplates';

interface PermissionMatrixProps {
  groups?: PermissionCatalogGroup[] | null;
  selectedPermissions: PermissionCode[];
  onChange?: (permissions: PermissionCode[]) => void;
  readOnly?: boolean;
  className?: string;
}

function titleCase(value: string) {
  return value
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function PermissionCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={clsx(
        'h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    />
  );
}

export default function PermissionMatrix({
  groups,
  selectedPermissions,
  onChange,
  readOnly = false,
  className,
}: PermissionMatrixProps) {
  const catalog = groups?.length
    ? groups
    : PERMISSION_GROUPS.map((group) => ({
        module: group.module,
        permissions: group.permissions.map((code) => ({
          code,
          module: group.module,
          action: code.split('.').at(-1) ?? code,
          description: null,
        })),
      }));

  const actions = useMemo(() => {
    const seen = new Set<string>();
    return catalog.flatMap((group) =>
      group.permissions
        .map((permission) => permission.action ?? permission.code.split('.').at(-1) ?? permission.code)
        .filter((action) => {
          if (seen.has(action)) return false;
          seen.add(action);
          return true;
        })
    );
  }, [catalog]);

  const selectedSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);

  const allPermissions = catalog.flatMap((group) => group.permissions.map((permission) => permission.code));

  const togglePermission = (code: PermissionCode) => {
    if (readOnly || !onChange) return;
    const next = new Set(selectedSet);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    onChange(Array.from(next));
  };

  const toggleGroup = (module: string, checked: boolean) => {
    if (readOnly || !onChange) return;
    const next = new Set(selectedSet);
    const targetGroup = catalog.find((group) => group.module === module);
    if (!targetGroup) return;
    targetGroup.permissions.forEach((permission) => {
      if (checked) next.add(permission.code);
      else next.delete(permission.code);
    });
    onChange(Array.from(next));
  };

  const toggleAction = (action: string, checked: boolean) => {
    if (readOnly || !onChange) return;
    const next = new Set(selectedSet);
    catalog.forEach((group) => {
      group.permissions.forEach((permission) => {
        const permissionAction = permission.action ?? permission.code.split('.').at(-1) ?? permission.code;
        if (permissionAction === action) {
          if (checked) next.add(permission.code);
          else next.delete(permission.code);
        }
      });
    });
    onChange(Array.from(next));
  };

  const toggleAll = (checked: boolean) => {
    if (readOnly || !onChange) return;
    onChange(checked ? allPermissions : []);
  };

  const allChecked = allPermissions.length > 0 && allPermissions.every((code) => selectedSet.has(code));
  const anyChecked = allPermissions.some((code) => selectedSet.has(code));

  return (
    <Card className={clsx('overflow-hidden', className)} variant="elevated" padding="none">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border-light)' }}>
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Permission matrix</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Grouped by module and action. {readOnly ? 'Read-only for system templates.' : 'Toggle permissions to update the template.'}
          </p>
        </div>
        <Badge variant={readOnly ? 'warning' : 'primary'} size="lg">
          {readOnly ? <Lock size={14} /> : <SquareCheckBig size={14} />}
          {readOnly ? 'System template' : `${selectedPermissions.length} selected`}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead style={{ background: 'color-mix(in srgb, var(--surface-container-low) 92%, transparent)' }}>
            <tr>
              <th className="sticky left-0 z-10 border-b px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ background: 'color-mix(in srgb, var(--surface-container-low) 92%, transparent)', borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}>
                Module
              </th>
              {actions.map((action) => {
                const columnPermissions = catalog.flatMap((group) =>
                  group.permissions.filter(
                    (permission) => (permission.action ?? permission.code.split('.').at(-1) ?? permission.code) === action
                  )
                );
                const checkedCount = columnPermissions.filter((permission) => selectedSet.has(permission.code)).length;
                const checked = columnPermissions.length > 0 && checkedCount === columnPermissions.length;
                const indeterminate = checkedCount > 0 && checkedCount < columnPermissions.length;

                return (
                  <th
                    key={action}
                    className="border-b px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                    style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <PermissionCheckbox
                        checked={checked}
                        indeterminate={indeterminate}
                        disabled={readOnly}
                        onChange={() => toggleAction(action, !checked)}
                      />
                      <span>{titleCase(action)}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: 'var(--surface-container-lowest)' }}>
              <td className="sticky left-0 z-10 border-b px-4 py-3" style={{ background: 'var(--surface-container-lowest)', borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-3">
                  <PermissionCheckbox
                    checked={allChecked}
                    indeterminate={!allChecked && anyChecked}
                    disabled={readOnly}
                    onChange={() => toggleAll(!allChecked)}
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All modules</span>
                </div>
              </td>
              {actions.map((action) => {
                const columnPermissions = catalog.flatMap((group) =>
                  group.permissions.filter(
                    (permission) => (permission.action ?? permission.code.split('.').at(-1) ?? permission.code) === action
                  )
                );
                const checkedCount = columnPermissions.filter((permission) => selectedSet.has(permission.code)).length;
                return (
                  <td key={action} className="border-b px-4 py-3 text-center text-xs" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}>
                    {checkedCount} / {columnPermissions.length}
                  </td>
                );
              })}
            </tr>

            {catalog.map((group) => {
              const groupCodes = group.permissions.map((permission) => permission.code);
              const groupCheckedCount = groupCodes.filter((code) => selectedSet.has(code)).length;
              const groupChecked = groupCodes.length > 0 && groupCheckedCount === groupCodes.length;
              const groupIndeterminate = groupCheckedCount > 0 && groupCheckedCount < groupCodes.length;

              return (
                <tr key={group.module} className="transition-colors hover:[background:color-mix(in_srgb,var(--surface-container-low)_72%,transparent)]" style={{ background: 'var(--surface-container-lowest)' }}>
                  <td className="sticky left-0 z-10 border-b bg-inherit px-4 py-3" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center gap-3">
                      <PermissionCheckbox
                        checked={groupChecked}
                        indeterminate={groupIndeterminate}
                        disabled={readOnly}
                        onChange={() => toggleGroup(group.module, !groupChecked)}
                      />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{titleCase(group.module)}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{group.permissions.length} permissions</p>
                      </div>
                    </div>
                  </td>

                  {actions.map((action) => {
                    const permission = group.permissions.find(
                      (item) => (item.action ?? item.code.split('.').at(-1) ?? item.code) === action
                    );
                    if (!permission) {
                      return (
                        <td key={action} className="border-b border-slate-100 px-4 py-3 text-center text-slate-300">
                          -
                        </td>
                      );
                    }

                    const checked = selectedSet.has(permission.code);

                    return (
                      <td key={action} className="border-b px-4 py-3 text-center" style={{ borderColor: 'var(--border-light)' }}>
                        <PermissionCheckbox
                          checked={checked}
                          disabled={readOnly}
                          onChange={() => togglePermission(permission.code)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
