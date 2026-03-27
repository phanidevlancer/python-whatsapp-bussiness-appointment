import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { NotificationLogListResponse } from '@/types/notification';

export function useNotificationLogs(params: { page?: number; page_size?: number; appointment_id?: string } = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const res = await api.get<NotificationLogListResponse>('/api/v1/notifications/logs', { params });
      return res.data;
    },
  });
}

export function useResendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const res = await api.post(`/api/v1/notifications/resend/${appointmentId}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
