'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TrendDataPoint } from '@/types/dashboard';
import { format } from 'date-fns';

interface TrendChartProps {
  data: TrendDataPoint[];
  range?: '7d' | '30d' | '90d';
  onRangeChange?: (range: '7d' | '30d' | '90d') => void;
}

export default function TrendChart({ data, range = '30d', onRangeChange }: TrendChartProps) {
  const chartData = data.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    confirmed: d.confirmed,
    completed: d.completed,
    cancelled: d.cancelled,
  }));

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Appointment Trends</h3>
        {onRangeChange && (
          <div className="flex bg-slate-100 rounded-md p-0.5 text-xs font-medium">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={`px-3 py-1 rounded transition-all ${
                  range === r
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center space-x-6 mb-2 text-xs text-slate-600">
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
          Confirmed
        </div>
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-teal-400 mr-2" />
          Completed
        </div>
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-red-400 mr-2" />
          Cancelled
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="confirmedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="" />
            <XAxis
              dataKey="date"
              interval={1}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 20]}
              ticks={[0, 10, 20]}
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
            <Area
              type="monotone"
              dataKey="confirmed"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#confirmedGradient)"
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#2dd4bf"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cancelled"
              stroke="#f87171"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
