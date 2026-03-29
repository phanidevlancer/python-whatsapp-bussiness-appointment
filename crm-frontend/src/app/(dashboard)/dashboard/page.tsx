'use client';

import { useState } from 'react';
import { useStats, useTrends, useUpcoming, useChannelStats, useCancellationStats, useRescheduleStats } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/authStore';
import StatsCards from '@/components/dashboard/StatsCards';
import TrendChart from '@/components/dashboard/TrendChart';
import UpcomingList from '@/components/dashboard/UpcomingList';
import AppointmentDistribution from '@/components/dashboard/AppointmentDistribution';
import WeeklyPerformance from '@/components/dashboard/WeeklyPerformance';
import ChannelComparison from '@/components/dashboard/ChannelComparison';
import { Skeleton } from '@/components/ui/Skeleton';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: trends, isLoading: trendsLoading } = useTrends(range);
  const { data: upcoming, isLoading: upcomingLoading } = useUpcoming(50);
  const { data: channels, isLoading: channelsLoading } = useChannelStats();
  const { data: cancellations, isLoading: cancellationsLoading } = useCancellationStats();
  const { data: reschedules, isLoading: reschedulesLoading } = useRescheduleStats();
  const displayName = user?.name?.trim() || 'there';
  const avatarLabel = displayName.charAt(0).toUpperCase();

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dashboard-page-panel rounded-lg p-4">
              <Skeleton variant="rounded" width={40} height={40} className="mb-3" />
              <Skeleton variant="text" width={60} height={24} className="mb-2" />
              <Skeleton variant="text" width={40} height={16} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton variant="rounded" className="h-80" />
          <Skeleton variant="rounded" className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Greeting Row */}
      <div className="flex justify-end items-center mb-6">
        <h2 className="mr-3 text-lg" style={{ color: 'var(--text-secondary)' }}>
          {getGreeting()}, <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
        </h2>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-white shadow-sm" style={{ border: '2px solid var(--panel-border)' }}>
          {avatarLabel}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && <StatsCards stats={stats} />}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 flex flex-col">
          {trends && !trendsLoading && (
            <TrendChart data={trends.data} range={range} onRangeChange={setRange} />
          )}
        </div>
        <div>
          {stats && <AppointmentDistribution stats={stats} />}
        </div>
      </div>

      {/* Channel Performance Comparison */}
      <div className="mb-6">
        {!channelsLoading && !cancellationsLoading && !reschedulesLoading && channels && (
          <ChannelComparison channels={channels} cancellations={cancellations} reschedules={reschedules} />
        )}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6 items-start">
        <div className="lg:col-span-2">
          {stats && <WeeklyPerformance stats={stats} />}
        </div>
        <div className="lg:self-stretch">
          {upcoming && !upcomingLoading && <UpcomingList items={upcoming} />}
        </div>
      </div>
    </div>
  );
}
