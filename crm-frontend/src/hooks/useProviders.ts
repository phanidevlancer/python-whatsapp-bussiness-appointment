import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Provider } from '@/types/appointment';

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
    mutationFn: async ({ id, ...data }: { id: string; name?: string; is_active?: boolean }) => {
      const res = await api.patch<Provider>(`/api/v1/providers/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  });
}
