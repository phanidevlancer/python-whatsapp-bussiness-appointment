import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AdminRole } from '@/types/auth';

export interface UserRead {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  template_id: string | null;
  template_name: string | null;
  phone: string | null;
  employee_code: string | null;
  is_active: boolean;
  is_first_login: boolean;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface UserAuditRead {
  id: string;
  user_id: string;
  action: string;
  performed_by_id: string | null;
  performed_by_name: string | null;
  details_json: Record<string, unknown> | unknown[] | null;
  created_at: string;
}

export interface PaginatedUserResponse {
  items: UserRead[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserCreateRequest {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  employee_code?: string | null;
  template_id?: string | null;
  is_active?: boolean;
  must_change_password?: boolean;
}

export interface UserUpdateRequest {
  name?: string;
  email?: string;
  phone?: string | null;
  employee_code?: string | null;
}

export interface UserTemplateAssignmentRequest {
  template_id: string;
}

export interface UserForcePasswordResetRequest {
  must_change_password?: boolean;
}

export interface AdminPasswordResetRequest {
  user_id: string;
  new_password: string;
}

type UserListParams = {
  search?: string;
  page?: number;
  page_size?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

function filterParams<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function invalidateUserQueries(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['users'] });
  if (id) {
    qc.invalidateQueries({ queryKey: ['user', id] });
    qc.invalidateQueries({ queryKey: ['user', id, 'audit-log'] });
  }
}

export function useUsersList(params: UserListParams = {}, options: QueryOptions = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const res = await api.get<PaginatedUserResponse>('/api/v1/users', {
        params: filterParams(params),
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}

export function useUserDetail(id: string | null, options: QueryOptions = {}) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await api.get<UserRead>(`/api/v1/users/${id}`);
      return res.data;
    },
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useUserAuditLog(id: string | null, options: QueryOptions = {}) {
  return useQuery({
    queryKey: ['user', id, 'audit-log'],
    queryFn: async () => {
      const res = await api.get<UserAuditRead[]>(`/api/v1/users/${id}/audit-log`);
      return res.data;
    },
    enabled: !!id && (options.enabled ?? true),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserCreateRequest) => {
      const res = await api.post<UserRead>('/api/v1/users', data);
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UserUpdateRequest) => {
      const res = await api.patch<UserRead>(`/api/v1/users/${id}`, data);
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/users/${id}`);
    },
    onSuccess: (_, id) => {
      invalidateUserQueries(qc, id);
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<UserRead>(`/api/v1/users/${id}/deactivate`);
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<UserRead>(`/api/v1/users/${id}/activate`);
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}

export function useAssignUserTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, template_id }: { id: string } & UserTemplateAssignmentRequest) => {
      const res = await api.patch<UserRead>(`/api/v1/users/${id}/template`, { template_id });
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}

export function useForcePasswordReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UserForcePasswordResetRequest) => {
      const res = await api.patch<UserRead>(`/api/v1/users/${id}/force-password-reset`, payload);
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}

export function useAdminPasswordReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AdminPasswordResetRequest) => {
      const res = await api.post<UserRead>('/api/v1/auth/admin-reset-password', payload);
      return res.data;
    },
    onSuccess: (user) => {
      invalidateUserQueries(qc, user.id);
    },
  });
}
