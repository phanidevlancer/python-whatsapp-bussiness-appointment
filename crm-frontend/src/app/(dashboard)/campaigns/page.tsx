'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';
import CampaignComparisonChart, { type CampaignComparisonMetric } from '@/components/campaigns/CampaignComparisonChart';
import CampaignsTable from '@/components/campaigns/CampaignsTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCampaignPerformance } from '@/hooks/useDashboard';
import type { Campaign } from '@/types/campaign';
import type { CampaignPerformance } from '@/types/dashboard';

function createZeroPerformance(campaign: Campaign): CampaignPerformance {
  return {
    campaign_id: campaign.id,
    campaign_code: campaign.code,
    campaign_name: campaign.name,
    run_status: campaign.run_status,
    targeted: campaign.targeted,
    pending: campaign.pending,
    sent: campaign.sent,
    delivered: campaign.delivered,
    read: campaign.read,
    clicked: campaign.clicked,
    failed: campaign.failed,
    bookings: campaign.bookings,
    confirmed: campaign.confirmed,
    cancelled: campaign.cancelled,
    completed: campaign.completed,
    no_show: campaign.no_show,
    total_service_value: campaign.total_service_value,
    total_final_value: campaign.total_final_value,
    source_comparison: [],
  };
}

export default function CampaignsPage() {
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useCampaigns();
  const { data: campaignPerformance = [] } = useCampaignPerformance();
  const [manualSelectedComparisonKeys, setManualSelectedComparisonKeys] = useState<string[] | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<CampaignComparisonMetric[]>([
    'bookings',
    'completed',
    'cancelled',
  ]);

  const metricOptions: Array<{ value: CampaignComparisonMetric; label: string }> = [
    { value: 'bookings', label: 'Bookings' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'targeted', label: 'Targeted' },
    { value: 'sent', label: 'Sent' },
  ];

  const performanceByCode = new Map(campaignPerformance.map((entry) => [entry.campaign_code, entry]));
  const comparisonOptions = [
    {
      key: 'organic',
      label: 'Organic',
      performance:
        performanceByCode.get('organic') ?? {
          campaign_id: null,
          campaign_code: 'organic',
          campaign_name: 'Organic',
          run_status: null,
          targeted: 0,
          pending: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          clicked: 0,
          failed: 0,
          bookings: 0,
          confirmed: 0,
          cancelled: 0,
          completed: 0,
          no_show: 0,
          total_service_value: 0,
          total_final_value: 0,
          source_comparison: [],
        },
    },
    ...campaigns.map((campaign) => ({
      key: campaign.id,
      label: campaign.name,
      performance: performanceByCode.get(campaign.code) ?? createZeroPerformance(campaign),
    })),
  ];
  const defaultSelectedComparisonKeys = ['organic', ...campaigns.slice(0, 2).map((campaign) => campaign.id)];
  const selectedComparisonKeys = (manualSelectedComparisonKeys ?? defaultSelectedComparisonKeys).filter((key) =>
    key === 'organic' ? true : campaigns.some((campaign) => campaign.id === key)
  );
  const selectedComparison = comparisonOptions.filter((option) => selectedComparisonKeys.includes(option.key));

  function toggleComparison(key: string) {
    const current = manualSelectedComparisonKeys ?? defaultSelectedComparisonKeys;
    setManualSelectedComparisonKeys(
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  return (
    <div className="dashboard-page-shell space-y-6">
      <div className="dashboard-page-header rounded-[20px] px-4 py-4 sm:rounded-[28px] sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
              <Megaphone size={14} />
              Campaigns
            </div>
            <h2 className="mt-4 text-[2rem] font-black tracking-[-0.04em] text-slate-900">
              Campaign list
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Create a campaign, review its status, and open a focused detail page when you need insights.
            </p>
          </div>
          <Link href="/campaigns/new">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Plus size={16} />}
              className="h-11 rounded-2xl border-primary-200 bg-white px-5 font-semibold text-primary-700"
            >
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {isLoadingCampaigns ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-[20px] p-4 sm:rounded-[28px] sm:p-5" variant="elevated">
              <Skeleton variant="text" className="h-5 w-40" />
              <Skeleton variant="text" className="mt-3 h-4 w-28" />
              <Skeleton variant="rounded" className="mt-4 h-28" />
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="rounded-[20px] p-6 text-center sm:rounded-[28px] sm:p-8" variant="elevated">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-50 text-primary-700">
            <Megaphone size={22} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">No campaigns yet</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Start with one clean campaign setup and come back here to track the rest.
          </p>
          <div className="mt-5">
            <Link href="/campaigns/new">
              <Button variant="primary" size="md" leftIcon={<Plus size={16} />}>
                Create first campaign
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="rounded-[20px] p-4 sm:rounded-[28px] sm:p-5" variant="elevated">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Compare Campaigns</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Compare selected metrics across selected campaigns and organic bookings.
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Metrics</p>
                <p className="mt-1 font-medium text-slate-700">
                  {metricOptions
                    .filter((option) => selectedMetrics.includes(option.value))
                    .map((option) => option.label)
                    .join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {comparisonOptions.map((option) => {
                const isSelected = selectedComparisonKeys.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleComparison(option.key)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {metricOptions.map((option) => {
                const isSelected = selectedMetrics.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setSelectedMetrics((current) => {
                        if (current.includes(option.value)) {
                          return current.length === 1 ? current : current.filter((metric) => metric !== option.value);
                        }
                        return [...current, option.value];
                      })
                    }
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'border-primary-700 bg-primary-50 text-primary-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {selectedComparison.length > 0 ? (
              <CampaignComparisonChart
                campaigns={selectedComparison.map((option) => option.performance)}
                metrics={selectedMetrics}
              />
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-500">
                Select at least one campaign or Organic to compare campaign outcomes.
              </div>
            )}
          </Card>

          <Card className="dashboard-page-panel relative z-0 overflow-hidden rounded-[20px] p-0 sm:rounded-[28px]" variant="elevated">
            <CampaignsTable campaigns={campaigns} isLoading={false} />
          </Card>
        </div>
      )}
    </div>
  );
}
