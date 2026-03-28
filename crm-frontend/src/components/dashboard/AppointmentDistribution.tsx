'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardStats } from '@/types/dashboard';

interface AppointmentDistributionProps {
  stats: DashboardStats;
}

const DISTRIBUTION_DATA = [
  { id: 'confirmed', label: 'Confirmed', color: '#2dd4bf' },
  { id: 'completed', label: 'Completed', color: '#3b82f6' },
  { id: 'cancelled', label: 'Cancelled', color: '#6366f1' },
];

export default function AppointmentDistribution({ stats }: AppointmentDistributionProps) {
  const rawData = [
    { id: 'confirmed', label: 'Confirmed', value: stats.total_confirmed, color: '#2dd4bf' },
    { id: 'completed', label: 'Completed', value: stats.total_completed, color: '#3b82f6' },
    { id: 'cancelled', label: 'Cancelled', value: stats.total_cancelled, color: '#6366f1' },
  ];

  // Use placeholder data if all zeros so donut is visible
  const total = rawData.reduce((acc, d) => acc + d.value, 0);
  const chartData = total > 0
    ? rawData.filter((d) => d.value > 0)
    : rawData.map((d) => ({ ...d, value: 1 }));

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Appointment Distribution</h3>
        <span className="text-xs text-slate-500">Total {total}</span>
      </div>

      {/* Donut */}
      <div className="flex-1 relative flex items-center justify-center py-4">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {DISTRIBUTION_DATA.map((item) => (
          <div key={item.id} className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-slate-600 text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
