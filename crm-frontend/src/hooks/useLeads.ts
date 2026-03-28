import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Lead, LeadListResponse, LeadStatus, CustomerType, LeadActivity, LeadActivityListResponse } from '@/types/lead';
import type { Appointment } from '@/types/appointment';

interface LeadFilters {
  status?: LeadStatus;
  customer_type?: CustomerType;
  assigned_to_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useLeadsList(filters: LeadFilters = {}) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      const res = await api.get<LeadListResponse>('/api/v1/leads', { params: filters });
      return res.data;
    },
  });
}

export function useOpenLeadByPhone(phone: string | undefined) {
  return useQuery({
    queryKey: ['leads', 'by-phone', phone],
    queryFn: async () => {
      const res = await api.get<LeadListResponse>('/api/v1/leads', {
        params: { search: phone, page_size: 1 },
      });
      const open = res.data.items.find(
        (l) => l.status !== 'converted' && l.status !== 'lost'
      );
      return open ?? null;
    },
    enabled: !!phone,
  });
}

export function useLeadDetail(id: string | null) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const res = await api.get<Lead>(`/api/v1/leads/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useLeadActivity(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-activity', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const res = await api.get<LeadActivityListResponse>(`/api/v1/leads/${leadId}/activity`);
      return res.data;
    },
    enabled: !!leadId,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      assigned_to_id, 
      crm_notes,
      follow_up_at,
      priority_score,
    }: { 
      id: string; 
      status?: LeadStatus; 
      assigned_to_id?: string | null; 
      crm_notes?: string;
      follow_up_at?: string | null;
      priority_score?: number;
    }) => {
      const res = await api.patch<Lead>(`/api/v1/leads/${id}`, {
        status,
        assigned_to_id,
        crm_notes,
        follow_up_at,
        priority_score,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-activity'] });
    },
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      slot_id,
      service_id,
      provider_id,
      notes,
    }: {
      leadId: string;
      slot_id: string;
      service_id?: string;
      provider_id?: string;
      notes?: string;
    }) => {
      const res = await api.post<Appointment>(`/api/v1/leads/${leadId}/convert`, {
        slot_id,
        service_id,
        provider_id,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useBulkAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      lead_ids, 
      assigned_to_id 
    }: { 
      lead_ids: string[]; 
      assigned_to_id: string;
    }) => {
      const res = await api.post('/api/v1/leads/bulk/assign', {
        lead_ids,
        assigned_to_id,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useBulkUpdateLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lead_ids,
      status,
      assigned_to_id,
      crm_notes,
    }: {
      lead_ids: string[];
      status?: LeadStatus;
      assigned_to_id?: string;
      crm_notes?: string;
    }) => {
      const res = await api.post('/api/v1/leads/bulk/update', {
        lead_ids,
        status,
        assigned_to_id,
        crm_notes,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useScheduleFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      leadId, 
      follow_up_at 
    }: { 
      leadId: string; 
      follow_up_at: string | null;
    }) => {
      const params = new URLSearchParams();
      if (follow_up_at) {
        params.append('follow_up_at', follow_up_at);
      }
      const res = await api.patch<Lead>(`/api/v1/leads/${leadId}/follow-up?${params.toString()}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-activity'] });
    },
  });
}
