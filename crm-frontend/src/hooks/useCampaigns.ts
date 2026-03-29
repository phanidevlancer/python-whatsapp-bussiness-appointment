import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  Campaign,
  CampaignDetail,
  CampaignImageUploadResponse,
  CampaignMutationPayload,
  CampaignRecipientsResponse,
} from '@/types/campaign';

function invalidateCampaignQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['campaigns'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'campaigns'] });
  queryClient.invalidateQueries({ queryKey: ['campaign-details'] });
  queryClient.invalidateQueries({ queryKey: ['campaign-recipients'] });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await api.get<Campaign[]>('/api/v1/campaigns');
      return res.data;
    },
  });
}

export function useCampaignDetail(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-details', campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const res = await api.get<CampaignDetail>(`/api/v1/campaigns/${campaignId}`);
      return res.data;
    },
  });
}

export function useCampaignRecipients(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-recipients', campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const res = await api.get<CampaignRecipientsResponse>(`/api/v1/campaigns/${campaignId}/recipients`);
      return res.data;
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CampaignMutationPayload) => {
      const res = await api.post<Campaign>('/api/v1/campaigns', data);
      return res.data;
    },
    onSuccess: () => invalidateCampaignQueries(queryClient),
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      data,
    }: {
      campaignId: string;
      data: CampaignMutationPayload;
    }) => {
      const res = await api.patch<Campaign>(`/api/v1/campaigns/${campaignId}`, data);
      return res.data;
    },
    onSuccess: () => invalidateCampaignQueries(queryClient),
  });
}

export function useUploadCampaignImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<CampaignImageUploadResponse>('/api/v1/campaigns/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      mode = 'start',
    }: {
      campaignId: string;
      mode?: 'start' | 'send-now';
    }) => {
      const endpoint = mode === 'send-now' ? 'send-now' : 'start';
      const res = await api.post<Campaign>(`/api/v1/campaigns/${campaignId}/${endpoint}`);
      return res.data;
    },
    onSuccess: () => invalidateCampaignQueries(queryClient),
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await api.post<Campaign>(`/api/v1/campaigns/${campaignId}/pause`);
      return res.data;
    },
    onSuccess: () => invalidateCampaignQueries(queryClient),
  });
}
