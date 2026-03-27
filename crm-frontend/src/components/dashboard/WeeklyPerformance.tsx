'use client';

import { BarChart } from '@mui/x-charts/BarChart';
import type { DashboardStats } from '@/types/dashboard';

interface WeeklyPerformanceProps {
  stats: DashboardStats;
}

export default function WeeklyPerformance({ stats }: WeeklyPerformanceProps) {
  const data = [
    {
      day: 'Mon',
      confirmed: Math.floor(stats.total_appointments_week * 0.18),
      completed: Math.floor(stats.total_appointments_week * 0.15),
      cancelled: Math.floor(stats.total_appointments_week * 0.05),
    },
    {
      day: 'Tue',
      confirmed: Math.floor(stats.total_appointments_week * 0.16),
      completed: Math.floor(stats.total_appointments_week * 0.14),
      cancelled: Math.floor(stats.total_appointments_week * 0.04),
    },
    {
      day: 'Wed',
      confirmed: Math.floor(stats.total_appointments_week * 0.17),
      completed: Math.floor(stats.total_appointments_week * 0.16),
      cancelled: Math.floor(stats.total_appointments_week * 0.06),
    },
    {
      day: 'Thu',
      confirmed: Math.floor(stats.total_appointments_week * 0.15),
      completed: Math.floor(stats.total_appointments_week * 0.14),
      cancelled: Math.floor(stats.total_appointments_week * 0.05),
    },
    {
      day: 'Fri',
      confirmed: Math.floor(stats.total_appointments_week * 0.19),
      completed: Math.floor(stats.total_appointments_week * 0.17),
      cancelled: Math.floor(stats.total_appointments_week * 0.07),
    },
    {
      day: 'Sat',
      confirmed: Math.floor(stats.total_appointments_week * 0.1),
      completed: Math.floor(stats.total_appointments_week * 0.13),
      cancelled: Math.floor(stats.total_appointments_week * 0.04),
    },
    {
      day: 'Sun',
      confirmed: Math.floor(stats.total_appointments_week * 0.05),
      completed: Math.floor(stats.total_appointments_week * 0.11),
      cancelled: Math.floor(stats.total_appointments_week * 0.03),
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 h-80">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Performance</h3>
      <div className="h-64">
        <BarChart
          xAxis={[
            {
              id: 'x-axis',
              data: data.map((d) => d.day),
              scaleType: 'band',
              tickLabelStyle: {
                fontSize: 11,
                fill: '#6b7280',
              },
              label: 'Day of Week',
              labelStyle: {
                fontSize: 12,
                fill: '#6b7280',
              },
            },
          ]}
          yAxis={[
            {
              id: 'y-axis',
              tickLabelStyle: {
                fontSize: 11,
                fill: '#6b7280',
              },
              label: 'Appointments',
              labelStyle: {
                fontSize: 12,
                fill: '#6b7280',
              },
            },
          ]}
          series={[
            {
              id: 'confirmed',
              label: 'Confirmed',
              data: data.map((d) => d.confirmed),
              color: '#3b82f6',
            },
            {
              id: 'completed',
              label: 'Completed',
              data: data.map((d) => d.completed),
              color: '#22c55e',
            },
            {
              id: 'cancelled',
              label: 'Cancelled',
              data: data.map((d) => d.cancelled),
              color: '#ef4444',
            },
          ]}
          width={undefined}
          height={256}
          margin={{ top: 10, right: 20, bottom: 50, left: 50 }}
          borderRadius={4}
          sx={{
            '& .MuiChartsAxis-tick text': {
              fill: '#6b7280',
              fontSize: '11px',
            },
            '& .MuiChartsAxis-label': {
              fill: '#6b7280',
              fontSize: '12px',
            },
            '& .MuiChartsLegend-root': {
              fontSize: '12px',
            },
            '& .MuiBarElement-root': {
              cursor: 'pointer',
            },
          }}
          grid={{ vertical: false, horizontal: true }}
        />
      </div>
    </div>
  );
}
