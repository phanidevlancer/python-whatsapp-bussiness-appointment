'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DashboardStats } from '@/types/dashboard';

interface WeeklyPerformanceProps {
  stats: DashboardStats;
}

export default function WeeklyPerformance({ stats }: WeeklyPerformanceProps) {
  // Use actual status counts from stats and distribute proportionally across days
  const confirmed = stats.total_confirmed;
  const completed = stats.total_completed;
  const cancelled = stats.total_cancelled;

  const distribute = (total: number, weights: number[]) => {
    if (total === 0) return weights.map(() => 0);
    const raw = weights.map((w) => w * total);
    const floored = raw.map(Math.floor);
    let remainder = total - floored.reduce((a, b) => a + b, 0);
    // Distribute remaining units to highest fractional parts
    const fracs = raw.map((v, i) => ({ i, f: v - floored[i] })).sort((a, b) => b.f - a.f);
    for (let k = 0; k < remainder; k++) floored[fracs[k].i]++;
    return floored;
  };

  const dayWeights = [0.18, 0.16, 0.17, 0.15, 0.19, 0.10, 0.05];
  const confirmedDays = distribute(confirmed, dayWeights);
  const completedDays = distribute(completed, dayWeights);
  const cancelledDays = distribute(cancelled, dayWeights);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = days.map((day, i) => ({
    day,
    confirmed: confirmedDays[i],
    completed: completedDays[i],
    cancelled: cancelledDays[i],
  }));

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Weekly Performance</h3>
      </div>

      {/* Legend */}
      <div className="flex justify-center space-x-6 mb-2 text-xs text-slate-600">
        <div className="flex items-center">
          <span className="w-2.5 h-2.5 rounded bg-blue-500 mr-2" />
          Confirmed
        </div>
        <div className="flex items-center">
          <span className="w-2.5 h-2.5 rounded bg-teal-400 mr-2" />
          Completed
        </div>
        <div className="flex items-center">
          <span className="w-2.5 h-2.5 rounded bg-indigo-500 mr-2" />
          Cancelled
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="confirmed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cancelled" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
