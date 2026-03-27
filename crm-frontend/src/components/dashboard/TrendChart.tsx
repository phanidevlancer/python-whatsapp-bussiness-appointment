'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TrendDataPoint } from '@/types/dashboard';
import { format } from 'date-fns';

export default function TrendChart({ data }: { data: TrendDataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: format(new Date(d.date), 'MMM d'),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Appointment Trends</h2>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="confirmed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cancelled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="completed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="confirmed" stroke="#3b82f6" fill="url(#confirmed)" strokeWidth={2} />
          <Area type="monotone" dataKey="cancelled" stroke="#ef4444" fill="url(#cancelled)" strokeWidth={2} />
          <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#completed)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
