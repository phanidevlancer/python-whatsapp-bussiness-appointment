'use client';

import { LineChart } from '@mui/x-charts/LineChart';
import type { TrendDataPoint } from '@/types/dashboard';
import { format } from 'date-fns';

export default function TrendChart({ data }: { data: TrendDataPoint[] }) {
  const labels = data.map((d) => format(new Date(d.date), 'MMM d'));

  const series = [
    {
      id: 'confirmed',
      label: 'Confirmed',
      data: data.map((d) => d.confirmed),
      color: '#3b82f6',
      curve: 'catmullRom' as const,
      showMark: true,
      markRadius: 4,
    },
    {
      id: 'completed',
      label: 'Completed',
      data: data.map((d) => d.completed),
      color: '#22c55e',
      curve: 'catmullRom' as const,
      showMark: true,
      markRadius: 4,
    },
    {
      id: 'cancelled',
      label: 'Cancelled',
      data: data.map((d) => d.cancelled),
      color: '#ef4444',
      curve: 'catmullRom' as const,
      showMark: true,
      markRadius: 4,
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 h-80">
      <LineChart
        xAxis={[
          {
            id: 'x-axis',
            data: labels,
            scaleType: 'point',
            tickLabelStyle: {
              fontSize: 11,
              fill: '#6b7280',
            },
            label: 'Date',
            labelStyle: {
              fontSize: 12,
              fill: '#6b7280',
            },
          },
        ]}
        yAxis={[
          {
            id: 'y-axis',
            min: 0,
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
        series={series}
        width={undefined}
        height={280}
        margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
        sx={{
          '& .MuiChartsLegend-root': {
            fontSize: '12px',
          },
          '& .MuiChartsAxis-tick text': {
            fill: '#6b7280',
            fontSize: '11px',
          },
          '& .MuiChartsAxis-label': {
            fill: '#6b7280',
            fontSize: '12px',
          },
          '& .MuiLineElement-root': {
            strokeWidth: 2,
          },
          '& .MuiAreaElement-root': {
            opacity: 0.1,
          },
        }}
        grid={{ vertical: false, horizontal: true }}
      />
    </div>
  );
}
