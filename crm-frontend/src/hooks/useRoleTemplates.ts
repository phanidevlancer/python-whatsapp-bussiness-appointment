'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PERMISSION_GROUPS, type PermissionCode } from '@/lib/permissions';

export interface PermissionCatalogItem {
  id?: string;
  code: PermissionCode;
  module: string;
  action: string;
  description: string | null;
  label?: string | null;
}

export interface PermissionCatalogGroup {
  module: string;
  label?: string | null;
  permissions: PermissionCatalogItem[];
}

export interface RoleTemplatePermission {
  id?: string;
  code: PermissionCode;
  module?: string;
  action?: string;
  description?: string | null;
}

export interface RoleTemplateRead {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  copied_from_template_id: string | null;
  assigned_user_count: number;
  permission_count?: number;
  created_at?: string;
  updated_at?: string;
  permissions?: RoleTemplatePermission[];
  permission_ids?: string[];
  permission_codes?: PermissionCode[];
}

export interface RoleTemplateUsage {
  template_id: string;
  user_count: number;
  users: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

export interface RoleTemplateCreateRequest {
  name: string;
  description?: string | null;
  permission_ids?: string[];
}

export interface RoleTemplateUpdateRequest {
  name?: string;
  description?: string | null;
}

export interface RoleTemplatePermissionsUpdateRequest {
  permission_ids: string[];
}

export interface RoleTemplateCopyRequest {
  name: string;
  description?: string | null;
}

function filterParams<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function invalidateRoleTemplateQueries(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['role-templates'] });
  qc.invalidateQueries({ queryKey: ['permissions'] });
  if (id) {
    qc.invalidateQueries({ queryKey: ['role-template', id] });
    qc.invalidateQueries({ queryKey: ['role-template', id, 'usage'] });
  }
}

function mapCatalogGroups(groups: PermissionCatalogGroup[]) {
  return groups.map((group) => ({
    ...group,
    permissions: group.permissions.map((permission) => ({
      ...permission,
      action: permission.action ?? permission.code.split('.').at(-1) ?? permission.code,
      module: permission.module ?? group.module,
    })),
  }));
}

export function getRoleTemplatePermissionCodes(template?: RoleTemplateRead | null) {
  if (!template) return [];
  if (template.permission_codes?.length) return template.permission_codes;
  if (template.permissions?.length) return template.permissions.map((permission) => permission.code);
  return [];
}

export function buildPermissionIdMap(
  catalog?: PermissionCatalogGroup[] | null,
  templatePermissions?: RoleTemplatePermission[] | null
) {
  const codeToId = new Map<PermissionCode, string>();
  const idToCode = new Map<string, PermissionCode>();

  catalog?.forEach((group) => {
    group.permissions.forEach((permission) => {
      if (permission.id) {
        codeToId.set(permission.code, permission.id);
        idToCode.set(permission.id, permission.code);
      }
    });
  });

  templatePermissions?.forEach((permission) => {
    if (permission.id) {
      codeToId.set(permission.code, permission.id);
      idToCode.set(permission.id, permission.code);
    }
  });

  return { codeToId, idToCode };
}

export function resolvePermissionIdsFromCodes(
  codes: PermissionCode[],
  catalog?: PermissionCatalogGroup[] | null,
  templatePermissions?: RoleTemplatePermission[] | null
) {
  const { codeToId } = buildPermissionIdMap(catalog, templatePermissions);
  return codes.map((code) => codeToId.get(code)).filter((id): id is string => Boolean(id));
}

export function resolvePermissionCodesFromIds(
  ids: string[],
  catalog?: PermissionCatalogGroup[] | null,
  templatePermissions?: RoleTemplatePermission[] | null
) {
  const { idToCode } = buildPermissionIdMap(catalog, templatePermissions);
  return ids.map((id) => idToCode.get(id)).filter((code): code is PermissionCode => Boolean(code));
}

export function usePermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await api.get<PermissionCatalogGroup[]>('/api/v1/permissions');
      return mapCatalogGroups(res.data);
    },
    enabled,
    staleTime: 1000 * 60 * 15,
    initialData: mapCatalogGroups(
      PERMISSION_GROUPS.map((group) => ({
        module: group.module,
        label: group.module,
        permissions: group.permissions.map((code) => ({
          code,
          module: group.module,
          action: code.split('.').at(-1) ?? code,
          description: null,
        })),
      }))
    ),
  });
}

export function useRoleTemplates(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const res = await api.get<RoleTemplateRead[]>('/api/v1/role-templates');
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}

export function useRoleTemplate(id: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['role-template', id],
    queryFn: async () => {
      const res = await api.get<RoleTemplateRead>(`/api/v1/role-templates/${id}`);
      return res.data;
    },
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useRoleTemplateUsage(id: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['role-template', id, 'usage'],
    queryFn: async () => {
      const res = await api.get<RoleTemplateUsage>(`/api/v1/role-templates/${id}/usage`);
      return res.data;
    },
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateRoleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RoleTemplateCreateRequest) => {
      const res = await api.post<RoleTemplateRead>('/api/v1/role-templates', filterParams(payload));
      return res.data;
    },
    onSuccess: (template) => {
      invalidateRoleTemplateQueries(qc, template.id);
    },
  });
}

export function useUpdateRoleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & RoleTemplateUpdateRequest) => {
      const res = await api.patch<RoleTemplateRead>(`/api/v1/role-templates/${id}`, filterParams(payload));
      return res.data;
    },
    onSuccess: (template) => {
      invalidateRoleTemplateQueries(qc, template.id);
    },
  });
}

export function useUpdateRoleTemplatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      permission_ids,
    }: {
      id: string;
    } & RoleTemplatePermissionsUpdateRequest) => {
      const res = await api.patch<RoleTemplateRead>(`/api/v1/role-templates/${id}/permissions`, {
        permission_ids,
      });
      return res.data;
    },
    onSuccess: (template) => {
      invalidateRoleTemplateQueries(qc, template.id);
    },
  });
}

export function useCopyRoleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & RoleTemplateCopyRequest) => {
      const res = await api.post<RoleTemplateRead>(`/api/v1/role-templates/${id}/copy`, filterParams(payload));
      return res.data;
    },
    onSuccess: (template) => {
      invalidateRoleTemplateQueries(qc, template.id);
    },
  });
}

export function useActivateRoleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<RoleTemplateRead>(`/api/v1/role-templates/${id}/activate`);
      return res.data;
    },
    onSuccess: (template) => {
      invalidateRoleTemplateQueries(qc, template.id);
    },
  });
}

export function useDeactivateRoleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<RoleTemplateRead>(`/api/v1/role-templates/${id}/deactivate`);
      return res.data;
    },
    onSuccess: (template) => {
      invalidateRoleTemplateQueries(qc, template.id);
    },
  });
}

export function useDeleteRoleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/role-templates/${id}`);
      return id;
    },
    onSuccess: (id) => {
      invalidateRoleTemplateQueries(qc, id);
    },
  });
}
