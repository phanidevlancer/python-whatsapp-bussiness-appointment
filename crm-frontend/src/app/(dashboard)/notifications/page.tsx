'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotificationLogs, useResendNotification } from '@/hooks/useNotifications';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotificationLogs({ page });
  const { mutate: resend } = useResendNotification();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle size={16} className="text-success-600" />;
      case 'failed':
        return <AlertCircle size={16} className="text-error-600" />;
      default:
        return <MessageSquare size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="dashboard-page-shell space-y-5">
      {/* Page Header */}
      <div className="dashboard-page-header flex items-center justify-between rounded-[24px] px-6 py-5">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Track WhatsApp message delivery status</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="primary" size="md" className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">
            <MessageSquare size={16} />
            {data?.total ?? 0} messages
          </Badge>
        </div>
      </div>

      {/* Notifications Table */}
      <Card className="dashboard-page-panel overflow-hidden rounded-[28px] p-0" variant="elevated">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton variant="text" className="w-32 h-4" />
                <Skeleton variant="text" className="w-24 h-4" />
                <Skeleton variant="text" className="w-20 h-4" />
                <Skeleton variant="text" className="w-32 h-4" />
                <Skeleton variant="text" className="w-40 h-4" />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="py-20 text-center">
            <div className="dashboard-empty-state-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <MessageSquare size={32} className="text-primary-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">No notification logs</h3>
            <p className="text-sm text-slate-500">WhatsApp messages will appear here</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableHeader className="dashboard-page-table-head border-b">
              <TableRow hoverable={false}>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Phone</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Type</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Sent At</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Error</TableHead>
                <TableHead align="right" className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {data.items.map((log) => (
                <TableRow key={log.id} className="group">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-slate-400" />
                      <span className="text-sm text-slate-700">{log.customer_phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-sm text-slate-700 capitalize">
                      {log.message_type.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <Badge
                        variant={
                          log.status === 'sent'
                            ? 'success'
                            : log.status === 'failed'
                            ? 'error'
                            : 'default'
                        }
                        size="sm"
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      >
                        {log.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-sm text-slate-500">
                      {log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    {log.error_message ? (
                      <div className="flex items-center gap-1 text-sm text-error-600 max-w-xs">
                        <AlertCircle size={14} />
                        <span className="truncate" title={log.error_message}>
                          {log.error_message}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell align="right" className="py-4">
                    {log.appointment_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<RefreshCw size={14} />}
                        onClick={() =>
                          resend(log.appointment_id!, {
                            onSuccess: () => toast.success('Notification resent successfully'),
                            onError: () => toast.error('Failed to resend notification'),
                          })
                        }
                        className="rounded-2xl px-3 hover:bg-primary-50 hover:text-primary-600"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        Resend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <Card className="dashboard-page-panel rounded-[24px] p-4" variant="default">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
              <span className="font-semibold text-slate-900">{Math.ceil(data.total / data.page_size)}</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="dashboard-action-outline rounded-2xl border px-4"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / data.page_size)}
                onClick={() => setPage((p) => p + 1)}
                className="dashboard-action-outline rounded-2xl border px-4"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
