import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  DashboardStats,
  TrendResponse,
  UpcomingAppointment,
  ChannelStats,
  ChannelCancellationStats,
  ChannelRescheduleStats,
} from '@/types/dashboard';

export function useStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/api/v1/dashboard/stats');
      return res.data;
    },
  });
}

export function useTrends(range: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['dashboard', 'trends', range],
    queryFn: async () => {
      const res = await api.get<TrendResponse>('/api/v1/dashboard/trends', { params: { range } });
      return res.data;
    },
  });
}

export function useUpcoming(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'upcoming', limit],
    queryFn: async () => {
      const res = await api.get<UpcomingAppointment[]>('/api/v1/dashboard/upcoming', { params: { limit } });
      return res.data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 401 errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function useChannelStats() {
  return useQuery({
    queryKey: ['dashboard', 'channels'],
    queryFn: async () => {
      const res = await api.get<ChannelStats[]>('/api/v1/dashboard/channels');
      return res.data;
    },
  });
}

export function useCancellationStats() {
  return useQuery({
    queryKey: ['dashboard', 'cancellations'],
    queryFn: async () => {
      const res = await api.get<ChannelCancellationStats[]>('/api/v1/dashboard/cancellations');
      return res.data;
    },
  });
}

export function useRescheduleStats() {
  return useQuery({
    queryKey: ['dashboard', 'reschedules'],
    queryFn: async () => {
      const res = await api.get<ChannelRescheduleStats[]>('/api/v1/dashboard/reschedules');
      return res.data;
    },
  });
}
