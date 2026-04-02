'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { CampaignRecipient } from '@/types/campaign';

function formatDateTime(value: string | null) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusVariant(status: string) {
  if (status === 'clicked' || status === 'read' || status === 'delivered') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'pending') return 'warning';
  return 'default';
}

interface CampaignRecipientsTableProps {
  recipients: CampaignRecipient[];
}

export default function CampaignRecipientsTable({ recipients }: CampaignRecipientsTableProps) {
  return (
    <Card className="rounded-[28px] p-5" variant="elevated">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Targeted Users</h3>
          <p className="mt-1 text-sm text-slate-500">
            Who received the campaign and how far each person moved through delivery and booking.
          </p>
        </div>
        <Badge variant="teal" size="sm">
          {recipients.length} recipients
        </Badge>
      </div>

      <div className="mt-5">
        <div className="space-y-3 md:hidden">
          {recipients.map((recipient) => {
            const lastActivity =
              recipient.clicked_at ??
              recipient.read_at ??
              recipient.delivered_at ??
              recipient.sent_at ??
              recipient.failed_at ??
              recipient.skipped_at;
            return (
              <div key={recipient.id} className="dashboard-surface-soft rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{recipient.customer_name || 'Unknown recipient'}</p>
                    <p className="text-xs text-slate-500">{recipient.phone}</p>
                  </div>
                  <Badge variant={getStatusVariant(recipient.delivery_status)} size="sm" dot>
                    {recipient.delivery_status}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <p>Bookings: {recipient.booking_metrics.bookings}</p>
                  <p>Completed: {recipient.booking_metrics.completed}</p>
                  <p className="col-span-2">Last: {formatDateTime(lastActivity)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead align="center">Bookings</TableHead>
              <TableHead align="center">Completed</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((recipient) => {
              const lastActivity =
                recipient.clicked_at ??
                recipient.read_at ??
                recipient.delivered_at ??
                recipient.sent_at ??
                recipient.failed_at ??
                recipient.skipped_at;

              return (
                <TableRow key={recipient.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {recipient.customer_name || 'Unknown recipient'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {recipient.send_logs.length} send attempt{recipient.send_logs.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{recipient.phone}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(recipient.delivery_status)} size="sm" dot>
                      {recipient.delivery_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(lastActivity)}</TableCell>
                  <TableCell align="center">{recipient.booking_metrics.bookings}</TableCell>
                  <TableCell align="center">{recipient.booking_metrics.completed}</TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{recipient.last_error ?? 'None'}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>
    </Card>
  );
}
