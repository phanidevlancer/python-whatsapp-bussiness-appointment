'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { CampaignPerformance } from '@/types/campaign';

interface CampaignComparisonChartProps {
  campaigns: CampaignPerformance[];
}

export default function CampaignComparisonChart({ campaigns }: CampaignComparisonChartProps) {
  const chartData = campaigns.map((campaign) => ({
    name: campaign.campaign_name,
    bookings: campaign.bookings,
    cancelled: campaign.cancelled,
    completed: campaign.completed,
  }));

  return (
    <Card className="rounded-[28px] p-5" variant="elevated">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Campaign vs Organic</h3>
        <p className="mt-1 text-sm text-slate-500">
          Compare bookings, completions, and cancellations across active campaigns and organic flow.
        </p>
      </div>

      <div className="mt-5 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: -10 }}>
            <CartesianGrid vertical={false} stroke="var(--border-light)" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-container-lowest)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="bookings" fill="#0f766e" radius={[8, 8, 0, 0]} />
            <Bar dataKey="completed" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
            <Bar dataKey="cancelled" fill="#f97316" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
