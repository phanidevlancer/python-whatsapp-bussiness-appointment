'use client';

import { PieChart } from '@mui/x-charts/PieChart';
import type { DashboardStats } from '@/types/dashboard';

interface AppointmentDistributionProps {
  stats: DashboardStats;
}

export default function AppointmentDistribution({ stats }: AppointmentDistributionProps) {
  const data = [
    { id: 'confirmed', label: 'Confirmed', value: stats.total_confirmed, color: '#22c55e' },
    { id: 'completed', label: 'Completed', value: stats.total_completed, color: '#3b82f6' },
    { id: 'cancelled', label: 'Cancelled', value: stats.total_cancelled, color: '#ef4444' },
    { id: 'no-show', label: 'No Show', value: stats.total_no_show, color: '#6b7280' },
  ].filter((d) => d.value > 0);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 h-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Appointment Distribution</h3>
        <span className="text-xs text-gray-500">Total: {total}</span>
      </div>
      <div className="h-64">
        <PieChart
          series={[
            {
              data,
              innerRadius: 45,
              outerRadius: 100,
              paddingAngle: 2,
              cornerRadius: 4,
              highlightScope: { fade: 'global', highlight: 'item' },
              highlighted: {
                additionalRadius: 8,
              },
            },
          ]}
          width={undefined}
          height={256}
          margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
          sx={{
            '& .MuiPieArcLabel-root': {
              fontSize: '12px',
              fontWeight: 500,
            },
            '& .MuiChartsLegend-root': {
              fontSize: '12px',
            },
          }}
        />
      </div>
    </div>
  );
}
