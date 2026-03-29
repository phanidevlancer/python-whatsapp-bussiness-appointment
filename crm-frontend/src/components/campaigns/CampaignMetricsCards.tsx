'use client';

import { Activity, CheckCircle2, MousePointerClick, Send, Users2, WalletCards, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { CampaignMetrics } from '@/types/campaign';

function formatMoney(value: number | string) {
  const amount = Number(value);
  return `Rs ${Number.isFinite(amount) ? amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`;
}

interface CampaignMetricsCardsProps {
  metrics: CampaignMetrics;
}

const metricCards = [
  { key: 'targeted', label: 'Targeted', icon: Users2 },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'clicked', label: 'Clicked', icon: MousePointerClick },
  { key: 'bookings', label: 'Bookings', icon: Activity },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle },
] as const;

export default function CampaignMetricsCards({ metrics }: CampaignMetricsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metricCards.map(({ key, label, icon: Icon }) => (
        <Card key={key} className="rounded-[24px] p-5" variant="elevated">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <Icon size={16} className="text-primary-600" />
          </div>
          <p className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">
            {metrics[key]}
          </p>
        </Card>
      ))}

      <Card className="rounded-[24px] p-5 md:col-span-2 xl:col-span-2" variant="elevated">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Revenue Snapshot
          </p>
          <WalletCards size={16} className="text-emerald-600" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Service Value
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">
              {formatMoney(metrics.total_service_value)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Final Value
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">
              {formatMoney(metrics.total_final_value)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
