'use client';

import Link from 'next/link';
import { Eye, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import type { Campaign } from '@/types/campaign';

interface CampaignsTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(value: number | string) {
  const amount = Number(value);
  return `Rs ${Number.isFinite(amount) ? amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}`;
}

function truncate(value: string | null | undefined, maxLength = 72) {
  if (!value) return 'No internal description yet.';
  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}...` : value;
}

function getRunStatusVariant(runStatus: Campaign['run_status']) {
  if (runStatus === 'running') return 'success';
  if (runStatus === 'failed') return 'error';
  if (runStatus === 'paused') return 'warning';
  return 'default';
}

export default function CampaignsTable({ campaigns, isLoading }: CampaignsTableProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[2.2fr,1fr,0.7fr,0.7fr,0.7fr,0.7fr,96px] items-center gap-4">
            <div className="space-y-2">
              <Skeleton variant="text" className="h-4 w-40" />
              <Skeleton variant="text" className="h-3 w-56" />
            </div>
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="text" className="h-4 w-12" />
            <Skeleton variant="text" className="h-4 w-12" />
            <Skeleton variant="text" className="h-4 w-12" />
            <Skeleton variant="text" className="h-4 w-12" />
            <div className="flex justify-end gap-2">
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="py-20 text-center">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">No campaigns found</h3>
        <p className="text-sm text-slate-500">Create a campaign to start tracking rollout and bookings</p>
      </div>
    );
  }

  return (
    <Table className="min-w-full">
      <TableHeader className="dashboard-page-table-head border-b">
        <TableRow hoverable={false}>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Campaign
          </TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Status
          </TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Targeted
          </TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Sent
          </TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Bookings
          </TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Completed
          </TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Value
          </TableHead>
          <TableHead align="right" className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
        {campaigns.map((campaign) => (
          <TableRow key={campaign.id} className="group">
            <TableCell className="py-4">
              <div className="min-w-[240px]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{campaign.name}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {campaign.code}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{truncate(campaign.description)}</p>
                <p className="mt-1 text-xs text-slate-400">Valid through {formatDateTime(campaign.valid_to)}</p>
              </div>
            </TableCell>
            <TableCell className="py-4">
              <div className="space-y-1">
                <Badge variant={campaign.status === 'active' ? 'success' : 'warning'} size="sm" dot>
                  {campaign.status}
                </Badge>
                <div>
                  <Badge variant={getRunStatusVariant(campaign.run_status)} size="sm" dot>
                    {campaign.run_status ?? 'draft'}
                  </Badge>
                </div>
              </div>
            </TableCell>
            <TableCell className="py-4">
              <span className="text-sm font-semibold text-slate-900">{campaign.targeted}</span>
            </TableCell>
            <TableCell className="py-4">
              <span className="text-sm font-semibold text-slate-900">{campaign.sent}</span>
            </TableCell>
            <TableCell className="py-4">
              <span className="text-sm font-semibold text-slate-900">{campaign.bookings}</span>
            </TableCell>
            <TableCell className="py-4">
              <span className="text-sm font-semibold text-slate-900">{campaign.completed}</span>
            </TableCell>
            <TableCell className="py-4">
              <span className="text-sm text-slate-700">{formatMoney(campaign.total_final_value)}</span>
            </TableCell>
            <TableCell align="right" className="py-4">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/campaigns/new?campaignId=${campaign.id}`}
                  className="rounded-xl p-2 transition-colors hover:bg-primary-50 hover:text-primary-600"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="Edit campaign"
                >
                  <PencilLine size={16} />
                </Link>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="rounded-xl p-2 transition-colors hover:bg-primary-50 hover:text-primary-600"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="View campaign"
                >
                  <Eye size={16} />
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
