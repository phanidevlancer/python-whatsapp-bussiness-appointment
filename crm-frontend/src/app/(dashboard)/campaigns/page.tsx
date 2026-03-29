'use client';

import Link from 'next/link';
import { useState } from 'react';
import axios from 'axios';
import {
  ArrowRight,
  BarChart3,
  CircleDot,
  Megaphone,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CampaignBuilder from '@/components/campaigns/CampaignBuilder';
import CampaignComparisonChart from '@/components/campaigns/CampaignComparisonChart';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useCampaigns,
  useCreateCampaign,
  usePauseCampaign,
  useStartCampaign,
  useUpdateCampaign,
  useUploadCampaignImage,
} from '@/hooks/useCampaigns';
import { useCampaignPerformance } from '@/hooks/useDashboard';
import { useServicesList } from '@/hooks/useServices';
import { cn } from '@/lib/utils';
import type {
  Campaign,
  CampaignImageUploadResponse,
  CampaignMutationPayload,
} from '@/types/campaign';

function getErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data as { detail?: string } | undefined;
  return detail?.detail ?? error.message ?? fallback;
}

function formatMoney(value: number | string) {
  const amount = Number(value);
  return `Rs ${Number.isFinite(amount) ? amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getRunStatusVariant(runStatus: Campaign['run_status']) {
  if (runStatus === 'running') return 'success';
  if (runStatus === 'failed') return 'error';
  if (runStatus === 'paused') return 'warning';
  return 'default';
}

export default function CampaignsPage() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [builderNonce, setBuilderNonce] = useState(0);

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useCampaigns();
  const { data: campaignPerformance = [], isLoading: isLoadingPerformance } = useCampaignPerformance();
  const { data: services = [], isLoading: isLoadingServices } = useServicesList(true);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const uploadCampaignImage = useUploadCampaignImage();
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

  const serviceNamesById = Object.fromEntries(services.map((service) => [service.id, service.name]));

  const campaignSummary = campaigns.reduce(
    (summary, campaign) => {
      summary.targeted += campaign.targeted;
      summary.sent += campaign.sent;
      summary.bookings += campaign.bookings;
      summary.totalValue += Number(campaign.total_final_value);
      if (campaign.run_status === 'running') summary.running += 1;
      if (campaign.status === 'active') summary.active += 1;
      return summary;
    },
    { targeted: 0, sent: 0, bookings: 0, totalValue: 0, running: 0, active: 0 },
  );

  const persistCampaign = async (payload: CampaignMutationPayload) => {
    const savedCampaign = selectedCampaign
      ? await updateCampaign.mutateAsync({
          campaignId: selectedCampaign.id,
          data: payload,
        })
      : await createCampaign.mutateAsync(payload);

    setSelectedCampaignId(savedCampaign.id);
    return savedCampaign;
  };

  const handleSave = async (payload: CampaignMutationPayload) => {
    try {
      const savedCampaign = await persistCampaign(payload);
      toast.success(selectedCampaign ? 'Campaign updated' : 'Campaign created');
      return savedCampaign;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save campaign');
      toast.error(message);
      throw error;
    }
  };

  const handleLaunch = async (
    payload: CampaignMutationPayload,
    mode: 'start' | 'send-now',
  ) => {
    try {
      const savedCampaign = await persistCampaign(payload);
      const launchedCampaign = await startCampaign.mutateAsync({
        campaignId: savedCampaign.id,
        mode,
      });
      setSelectedCampaignId(launchedCampaign.id);
      toast.success(mode === 'send-now' ? 'Campaign send started' : 'Campaign started');
      return launchedCampaign;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to launch campaign');
      toast.error(message);
      throw error;
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      const pausedCampaign = await pauseCampaign.mutateAsync(campaignId);
      setSelectedCampaignId(pausedCampaign.id);
      toast.success('Campaign paused');
      return pausedCampaign;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to pause campaign');
      toast.error(message);
      throw error;
    }
  };

  const handleUploadImage = async (file: File): Promise<CampaignImageUploadResponse> => {
    try {
      const uploadedImage = await uploadCampaignImage.mutateAsync(file);
      toast.success('Campaign image uploaded');
      return uploadedImage;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to upload campaign image');
      toast.error(message);
      throw error;
    }
  };

  const resetBuilder = () => {
    setSelectedCampaignId(null);
    setBuilderNonce((current) => current + 1);
  };

  return (
    <div className="dashboard-page-shell space-y-6">
      <div className="dashboard-page-header rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
              <Sparkles size={14} />
              Campaign Studio
            </div>
            <h2 className="mt-4 text-[2rem] font-black tracking-[-0.04em] text-slate-900">
              Builder-first Campaign Admin
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Build the offer, audience, and launch flow in one place, then compare every campaign
              against organic performance from the same admin workspace.
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            leftIcon={<Megaphone size={16} />}
            onClick={resetBuilder}
            className="h-11 rounded-2xl border-primary-200 bg-white px-5 font-semibold text-primary-700"
          >
            New Draft
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[24px] p-5" variant="elevated">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Live Campaigns
            </p>
            <CircleDot size={16} className="text-emerald-500" />
          </div>
          <p className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">
            {campaignSummary.active}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {campaignSummary.running} currently running out of {campaigns.length} total campaigns
          </p>
        </Card>

        <Card className="rounded-[24px] p-5" variant="elevated">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Targeted
            </p>
            <BarChart3 size={16} className="text-sky-500" />
          </div>
          <p className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">
            {campaignSummary.targeted}
          </p>
          <p className="mt-1 text-sm text-slate-500">Audience size already materialized by the runner</p>
        </Card>

        <Card className="rounded-[24px] p-5" variant="elevated">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Sent
            </p>
            <TrendingUp size={16} className="text-amber-500" />
          </div>
          <p className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">
            {campaignSummary.sent}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Messages delivered through current campaign launches
          </p>
        </Card>

        <Card className="rounded-[24px] p-5" variant="elevated">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Final Value
            </p>
            <WalletCards size={16} className="text-primary-600" />
          </div>
          <p className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">
            {formatMoney(campaignSummary.totalValue)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {campaignSummary.bookings} attributed bookings ready for later organic comparison
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <CampaignBuilder
          key={`${selectedCampaign?.id ?? 'new'}:${selectedCampaign?.updated_at ?? 'draft'}:${builderNonce}`}
          campaign={selectedCampaign}
          services={services}
          isServicesLoading={isLoadingServices}
          isSaving={createCampaign.isPending || updateCampaign.isPending}
          isLaunching={startCampaign.isPending}
          isPausing={pauseCampaign.isPending}
          isUploadingImage={uploadCampaignImage.isPending}
          onSave={handleSave}
          onLaunch={handleLaunch}
          onPause={handlePause}
          onUploadImage={handleUploadImage}
          onCreateNew={resetBuilder}
        />

        <div className="space-y-4">
          <Card className="rounded-[28px] p-5" variant="elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Campaign List</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Pick a campaign to edit in the builder or open its detail page for recipient and delivery insights.
                </p>
              </div>
              <Badge variant="teal" size="sm">
                {campaigns.length} total
              </Badge>
            </div>
          </Card>

          {isLoadingCampaigns ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="rounded-[28px] p-5" variant="elevated">
                <Skeleton variant="text" className="h-5 w-40" />
                <Skeleton variant="text" className="mt-3 h-4 w-28" />
                <Skeleton variant="rounded" className="mt-4 h-28" />
              </Card>
            ))
          ) : campaigns.length === 0 ? (
            <Card className="rounded-[28px] p-8 text-center" variant="elevated">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-50 text-primary-700">
                <Megaphone size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No campaigns yet</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Build the first campaign on the left, save it as a draft, and it will appear here with
                its funnel summary.
              </p>
            </Card>
          ) : (
            campaigns.map((campaign) => {
              const isSelected = campaign.id === selectedCampaignId;
              const serviceLabels = campaign.allowed_service_ids
                .map((serviceId) => serviceNamesById[serviceId] ?? 'Unknown service')
                .slice(0, 3);

              return (
                <Card
                  key={campaign.id}
                  className={`rounded-[28px] p-5 transition ${
                    isSelected ? 'border-primary-300 shadow-[0_20px_40px_rgba(13,148,136,0.14)]' : ''
                  }`}
                  variant="elevated"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={campaign.status === 'active' ? 'success' : 'warning'} size="sm" dot>
                          {campaign.status}
                        </Badge>
                        <Badge variant={getRunStatusVariant(campaign.run_status)} size="sm" dot>
                          {campaign.run_status ?? 'draft'}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-slate-900">{campaign.name}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {campaign.code}
                      </p>
                    </div>
                    <Button
                      variant={isSelected ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      rightIcon={<ArrowRight size={14} />}
                    >
                      {isSelected ? 'Editing' : 'Edit'}
                    </Button>
                  </div>

                  <div className="mt-3">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                    >
                      View insights
                    </Link>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {campaign.description ?? 'No internal description yet.'}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Targeted
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{campaign.targeted}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Sent
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{campaign.sent}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Read
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{campaign.read}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Bookings
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{campaign.bookings}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Completed
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{campaign.completed}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Final Value
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-900">
                        {formatMoney(campaign.total_final_value)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {serviceLabels.map((serviceLabel) => (
                      <span
                        key={serviceLabel}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {serviceLabel}
                      </span>
                    ))}
                    {!serviceLabels.length ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                        No services
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <span>Audience: {campaign.audience_type.replaceAll('_', ' ')}</span>
                      <span>{campaign.source_comparison.length} comparison source(s)</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-slate-300">
                      <span>Valid through {formatDateTime(campaign.valid_to)}</span>
                      <span>Updated {formatDateTime(campaign.updated_at)}</span>
                    </div>
                  </div>

                  {campaign.last_error ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                      Runner error: {campaign.last_error}
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
        {isLoadingPerformance ? (
          <Skeleton variant="rounded" className="h-[24rem] rounded-[28px]" />
        ) : (
          <CampaignComparisonChart campaigns={campaignPerformance} />
        )}

        <Card className="rounded-[28px] p-5" variant="elevated">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Campaign Leaderboard</h3>
              <p className="mt-1 text-sm text-slate-500">
                Organic is included so campaign lift is visible against the default booking flow.
              </p>
            </div>
            <Badge variant="teal" size="sm">
              {campaignPerformance.length} sources
            </Badge>
          </div>

          <div className="mt-5 space-y-3">
            {campaignPerformance.map((entry) => (
              <div
                key={entry.campaign_code}
                className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.campaign_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {entry.campaign_code}
                    </p>
                  </div>
                  <Badge variant={entry.campaign_code === 'organic' ? 'info' : 'success'} size="sm" dot>
                    {entry.campaign_code === 'organic' ? 'organic' : entry.run_status ?? 'campaign'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Bookings</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{entry.bookings}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Completed</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{entry.completed}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cancelled</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{entry.cancelled}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
