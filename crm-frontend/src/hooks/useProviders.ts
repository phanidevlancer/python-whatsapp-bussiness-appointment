import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Provider } from '@/types/appointment';
import type { ChangeHistoryEntry } from '@/components/ui/ChangeHistoryPanel';

export function useProvidersList(activeOnly = true) {
  return useQuery({
    queryKey: ['providers', activeOnly],
    queryFn: async () => {
      const res = await api.get<Provider[]>('/api/v1/providers', {
        params: { active_only: activeOnly },
      });
      return res.data;
    },
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; email?: string; phone?: string }) => {
      const res = await api.post<Provider>('/api/v1/providers', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; email?: string; phone?: string; is_active?: boolean }) => {
      const res = await api.patch<Provider>(`/api/v1/providers/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      qc.invalidateQueries({ queryKey: ['provider-history', id] });
    },
  });
}

export function useProviderHistory(id: string | null) {
  return useQuery({
    queryKey: ['provider-history', id],
    queryFn: async () => {
      const res = await api.get<ChangeHistoryEntry[]>(`/api/v1/providers/${id}/history`);
      return res.data;
    },
    enabled: !!id,
  });
}
