import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  Appointment,
  AppointmentFilters,
  AppointmentStatusHistory,
  PaginatedAppointmentResponse,
} from '@/types/appointment';

export function useAppointmentsList(filters: AppointmentFilters = {}) {
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedAppointmentResponse>('/api/v1/appointments', {
        params: filters,
      });
      return res.data;
    },
  });
}

export function useAppointmentDetail(id: string | null) {
  return useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const res = await api.get<Appointment>(`/api/v1/appointments/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useAppointmentHistory(id: string | null) {
  return useQuery({
    queryKey: ['appointment', id, 'history'],
    queryFn: async () => {
      const res = await api.get<AppointmentStatusHistory[]>(`/api/v1/appointments/${id}/history`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      user_phone: string;
      service_id: string;
      slot_id: string;
      provider_id?: string;
      notes?: string;
    }) => {
      const res = await api.post<Appointment>('/api/v1/appointments', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.post<Appointment>(`/api/v1/appointments/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['appointment', id] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, new_slot_id, reason }: { id: string; new_slot_id: string; reason?: string }) => {
      const res = await api.post<Appointment>(`/api/v1/appointments/${id}/reschedule`, {
        new_slot_id,
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCompleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Appointment>(`/api/v1/appointments/${id}/complete`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useNoShowAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Appointment>(`/api/v1/appointments/${id}/no-show`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
