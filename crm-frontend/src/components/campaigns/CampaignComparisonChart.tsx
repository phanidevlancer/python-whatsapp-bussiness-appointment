'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CampaignPerformance } from '@/types/campaign';

export type CampaignComparisonMetric =
  | 'bookings'
  | 'completed'
  | 'cancelled'
  | 'revenue'
  | 'targeted'
  | 'sent';

interface CampaignComparisonChartProps {
  campaigns: CampaignPerformance[];
  metrics: CampaignComparisonMetric[];
}

const metricConfig: Record<
  CampaignComparisonMetric,
  { key: string; label: string; color: string; formatter?: (value: number | string) => string }
> = {
  bookings: { key: 'bookings', label: 'Bookings', color: '#0f766e' },
  completed: { key: 'completed', label: 'Completed', color: '#0ea5e9' },
  cancelled: { key: 'cancelled', label: 'Cancelled', color: '#f97316' },
  revenue: {
    key: 'revenue',
    label: 'Revenue',
    color: '#7c3aed',
    formatter: (value) => {
      const amount = Number(value);
      return `Rs ${Number.isFinite(amount) ? amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`;
    },
  },
  targeted: { key: 'targeted', label: 'Targeted', color: '#475569' },
  sent: { key: 'sent', label: 'Sent', color: '#dc2626' },
};

function roundChartMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export default function CampaignComparisonChart({ campaigns, metrics }: CampaignComparisonChartProps) {
  const chartData = campaigns.map((campaign) => ({
    name: campaign.campaign_name,
    bookings: campaign.bookings,
    completed: campaign.completed,
    cancelled: campaign.cancelled,
    revenue: Number(campaign.total_final_value),
    targeted: campaign.targeted,
    sent: campaign.sent,
  }));
  const activeMetrics = metrics.map((metric) => metricConfig[metric]);
  const showLabels = campaigns.length <= 3 && activeMetrics.length <= 3;
  const usesRevenueMetric = metrics.includes('revenue');
  const maxMetricValue = Math.max(
    0,
    ...chartData.flatMap((item) =>
      activeMetrics.map((metric) => Number(item[metric.key as keyof typeof item] ?? 0))
    )
  );
  const yAxisMax = roundChartMax(maxMetricValue);

  return (
    <div className="mt-5 h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 12, bottom: 8, left: -10 }}
          barCategoryGap="12%"
          barGap={4}
        >
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
            domain={[0, yAxisMax]}
            allowDecimals={usesRevenueMetric}
            tickFormatter={usesRevenueMetric ? undefined : (value: number) => Math.round(value).toString()}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => {
              const config = activeMetrics.find((item) => item.key === name);
              return config?.formatter ? config.formatter(value) : value;
            }}
            contentStyle={{
              background: 'var(--surface-container-lowest)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
          />
          {activeMetrics.map((metric) => (
            <Bar
              key={metric.key}
              dataKey={metric.key}
              name={metric.label}
              fill={metric.color}
              radius={[8, 8, 0, 0]}
              maxBarSize={48}
            >
              {showLabels ? (
                <LabelList
                  dataKey={metric.key}
                  position="top"
                  formatter={(value: number | string) =>
                    metric.formatter ? metric.formatter(value) : value
                  }
                  style={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }}
                />
              ) : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
