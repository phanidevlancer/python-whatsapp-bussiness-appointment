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
  const w = stats.total_appointments_week;
  const data = [
    { day: 'Mon', confirmed: Math.floor(w * 0.18), completed: Math.floor(w * 0.15), cancelled: Math.floor(w * 0.05) },
    { day: 'Tue', confirmed: Math.floor(w * 0.16), completed: Math.floor(w * 0.14), cancelled: Math.floor(w * 0.04) },
    { day: 'Wed', confirmed: Math.floor(w * 0.17), completed: Math.floor(w * 0.16), cancelled: Math.floor(w * 0.06) },
    { day: 'Thu', confirmed: Math.floor(w * 0.15), completed: Math.floor(w * 0.14), cancelled: Math.floor(w * 0.05) },
    { day: 'Fri', confirmed: Math.floor(w * 0.19), completed: Math.floor(w * 0.17), cancelled: Math.floor(w * 0.07) },
    { day: 'Sat', confirmed: Math.floor(w * 0.10), completed: Math.floor(w * 0.13), cancelled: Math.floor(w * 0.04) },
    { day: 'Sun', confirmed: Math.floor(w * 0.05), completed: Math.floor(w * 0.11), cancelled: Math.floor(w * 0.03) },
  ];

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
