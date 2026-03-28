import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Customer } from '@/types/appointment';
import type { PaginatedAppointmentResponse } from '@/types/appointment';
import type { ChangeHistoryEntry } from '@/components/ui/ChangeHistoryPanel';

interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
}

export function useCustomersList(params: { search?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const res = await api.get<CustomerListResponse>('/api/v1/customers', { params });
      return res.data;
    },
  });
}

export function useCustomerDetail(id: string | null) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await api.get<Customer>(`/api/v1/customers/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; email?: string; notes?: string }) => {
      const res = await api.patch<Customer>(`/api/v1/customers/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-history', id] });
    },
  });
}

export function useCustomerHistory(id: string | null) {
  return useQuery({
    queryKey: ['customer-history', id],
    queryFn: async () => {
      const res = await api.get<ChangeHistoryEntry[]>(`/api/v1/customers/${id}/history`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCustomerAppointments(id: string | null, page = 1) {
  return useQuery({
    queryKey: ['customer', id, 'appointments', page],
    queryFn: async () => {
      const res = await api.get<PaginatedAppointmentResponse>(`/api/v1/customers/${id}/appointments`, {
        params: { page },
      });
      return res.data;
    },
    enabled: !!id,
  });
}
