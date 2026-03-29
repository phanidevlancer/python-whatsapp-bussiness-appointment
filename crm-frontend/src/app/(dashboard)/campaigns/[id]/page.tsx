'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, ImageIcon, Layers3, Send, Users2 } from 'lucide-react';
import CampaignMetricsCards from '@/components/campaigns/CampaignMetricsCards';
import CampaignRecipientsTable from '@/components/campaigns/CampaignRecipientsTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaignDetail } from '@/hooks/useCampaigns';

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getRunStatusVariant(runStatus: string | null) {
  if (runStatus === 'running') return 'success';
  if (runStatus === 'failed') return 'error';
  if (runStatus === 'paused') return 'warning';
  return 'default';
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = typeof params?.id === 'string' ? params.id : null;
  const { data: campaign, isLoading } = useCampaignDetail(campaignId);

  if (isLoading) {
    return (
      <div className="dashboard-page-shell space-y-6">
        <Skeleton variant="rounded" className="h-36 w-full rounded-[28px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" className="h-32 rounded-[24px]" />
          ))}
        </div>
        <Skeleton variant="rounded" className="h-80 w-full rounded-[28px]" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="dashboard-page-shell">
        <Card className="rounded-[28px] p-8 text-center" variant="elevated">
          <h2 className="text-xl font-bold text-slate-900">Campaign not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            The campaign detail payload is unavailable or the record no longer exists.
          </p>
          <div className="mt-5">
            <Button asChild variant="outline" size="md" leftIcon={<ArrowLeft size={16} />}>
              <Link href="/campaigns">Back to campaigns</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const previewUrl = campaign.message.image_path
    ? `${apiBaseUrl}/${campaign.message.image_path.replace(/^\/+/, '')}`
    : null;

  return (
    <div className="dashboard-page-shell space-y-6">
      <div className="dashboard-page-header rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <ArrowLeft size={16} />
              Back to campaigns
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={campaign.status === 'active' ? 'success' : 'warning'} size="sm" dot>
                {campaign.status}
              </Badge>
              <Badge variant={getRunStatusVariant(campaign.run_status)} size="sm" dot>
                {campaign.run_status ?? 'draft'}
              </Badge>
            </div>
            <h1 className="mt-4 text-[2rem] font-black tracking-[-0.04em] text-slate-900">
              {campaign.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              {campaign.description ?? 'No internal description added for this campaign.'}
            </p>
          </div>
          <div className="rounded-[24px] bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Campaign Code</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-slate-900">{campaign.code}</p>
            <p className="mt-1 text-xs text-slate-500">Updated {formatDateTime(campaign.updated_at)}</p>
          </div>
        </div>
      </div>

      <CampaignMetricsCards metrics={campaign.metrics} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="rounded-[28px] p-5" variant="elevated">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Layers3 size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Campaign Setup</h3>
              <p className="text-sm text-slate-500">Audience, rollout, and validity rules.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Audience</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {campaign.audience.type.replaceAll('_', ' ')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {JSON.stringify(campaign.audience.filters)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rollout</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Batch size {campaign.batch.size ?? 'N/A'} every {campaign.batch.delay_seconds ?? 'N/A'} sec
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Started {formatDateTime(campaign.lifecycle.started_at)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Message CTA</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {campaign.message.button_label ?? 'No button label'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Button ID: {campaign.message.booking_button_id ?? 'Not set'}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Lifecycle</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Completed {formatDateTime(campaign.lifecycle.completed_at)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Failed {formatDateTime(campaign.lifecycle.failed_at)}
              </p>
            </div>
          </div>

          {campaign.lifecycle.last_error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {campaign.lifecycle.last_error}
            </div>
          ) : null}
        </Card>

        <Card className="rounded-[28px] p-5" variant="elevated">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Creative Preview</h3>
              <p className="text-sm text-slate-500">What the targeted users received on WhatsApp.</p>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={`${campaign.name} creative`}
                width={1200}
                height={600}
                className="h-52 w-full rounded-2xl object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-52 items-center justify-center rounded-2xl bg-white text-slate-400">
                <div className="text-center">
                  <ImageIcon size={24} className="mx-auto" />
                  <p className="mt-2 text-sm font-medium">No image uploaded</p>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold leading-6 text-slate-900">
                {campaign.message.body ?? 'No campaign message body'}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Footer</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {campaign.message.footer ?? 'No footer'}
                  </p>
                </div>
                <div className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
                  {campaign.message.button_label ?? 'Book now'}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <CampaignRecipientsTable recipients={campaign.recipients} />

      <Card className="rounded-[28px] p-5" variant="elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Users2 size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Source Comparison</h3>
            <p className="text-sm text-slate-500">
              Current payload separates campaign and organic sources so the clinic team can compare attribution.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {campaign.source_comparison.map((source) => (
            <div key={source.source} className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{source.source}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Bookings</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{source.bookings}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cancelled</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{source.cancelled}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
