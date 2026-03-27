'use client';

import { useState } from 'react';
import { useStats, useTrends, useUpcoming, useChannelStats, useCancellationStats } from '@/hooks/useDashboard';
import StatsCards from '@/components/dashboard/StatsCards';
import TrendChart from '@/components/dashboard/TrendChart';
import UpcomingList from '@/components/dashboard/UpcomingList';
import AppointmentDistribution from '@/components/dashboard/AppointmentDistribution';
import WeeklyPerformance from '@/components/dashboard/WeeklyPerformance';
import ChannelComparison from '@/components/dashboard/ChannelComparison';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats();
  const { data: trends, isLoading: trendsLoading, error: trendsError } = useTrends(range);
  const { data: upcoming, isLoading: upcomingLoading, error: upcomingError } = useUpcoming(50);
  const { data: channels, isLoading: channelsLoading } = useChannelStats();
  const { data: cancellations, isLoading: cancellationsLoading } = useCancellationStats();

  // Debug logging
  console.log('Dashboard - Stats:', stats, statsError);
  console.log('Dashboard - Trends:', trends, trendsError);
  console.log('Dashboard - Upcoming:', upcoming, upcomingError);
  console.log('Dashboard - Channels:', channels);
  console.log('Dashboard - Cancellations:', cancellations);

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
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
    <div className="space-y-4">
      {/* Page Header - Zoho Style */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of your clinic performance</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:inline">
            Last updated: Just now
          </span>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && <StatsCards stats={stats} />}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend Chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Appointment Trends</h2>
            <div className="flex gap-1">
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                    range === r
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {trends && !trendsLoading && <TrendChart data={trends.data} />}
        </div>

        {/* Appointment Distribution */}
        <div>
          {stats && <AppointmentDistribution stats={stats} />}
        </div>
      </div>

      {/* Channel Performance Comparison */}
      <div>
        {!channelsLoading && !cancellationsLoading && channels && (
          <ChannelComparison channels={channels} cancellations={cancellations} />
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Performance */}
        <div className="lg:col-span-2">
          {stats && <WeeklyPerformance stats={stats} />}
        </div>

        {/* Upcoming Appointments */}
        <div>
          {upcoming && !upcomingLoading && <UpcomingList items={upcoming} />}
        </div>
      </div>
    </div>
  );
}
