import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Service } from '@/types/appointment';
import type { ChangeHistoryEntry } from '@/components/ui/ChangeHistoryPanel';

export function useServicesList(includeInactive = false) {
  return useQuery({
    queryKey: ['services', includeInactive],
    queryFn: async () => {
      const res = await api.get<Service[]>('/api/v1/services', {
        params: { include_inactive: includeInactive },
      });
      return res.data;
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; duration_minutes: number; cost: number }) => {
      const res = await api.post<Service>('/api/v1/services', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; duration_minutes?: number; cost?: number; is_active?: boolean }) => {
      const res = await api.patch<Service>(`/api/v1/services/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['service-history', id] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/services/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useServiceHistory(id: string | null) {
  return useQuery({
    queryKey: ['service-history', id],
    queryFn: async () => {
      const res = await api.get<ChangeHistoryEntry[]>(`/api/v1/services/${id}/history`);
      return res.data;
    },
    enabled: !!id,
  });
}
