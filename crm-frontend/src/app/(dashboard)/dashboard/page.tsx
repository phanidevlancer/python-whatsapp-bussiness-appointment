'use client';

import { useState } from 'react';
import { useStats, useTrends, useUpcoming } from '@/hooks/useDashboard';
import StatsCards from '@/components/dashboard/StatsCards';
import TrendChart from '@/components/dashboard/TrendChart';
import UpcomingList from '@/components/dashboard/UpcomingList';

export default function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: trends, isLoading: trendsLoading } = useTrends(range);
  const { data: upcoming, isLoading: upcomingLoading } = useUpcoming(10);

  if (statsLoading) {
    return <div className="text-gray-400 text-sm p-8 text-center">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      {stats && <StatsCards stats={stats} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Trends</h2>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    range === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {trends && !trendsLoading && <TrendChart data={trends.data} />}
        </div>
        <div>
          {upcoming && !upcomingLoading && <UpcomingList items={upcoming} />}
        </div>
      </div>
    </div>
  );
}
