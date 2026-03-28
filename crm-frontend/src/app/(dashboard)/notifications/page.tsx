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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track WhatsApp message delivery status</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="primary" size="md">
            <MessageSquare size={16} />
            {data?.total ?? 0} messages
          </Badge>
        </div>
      </div>

      {/* Notifications Table */}
      <Card className="p-0 overflow-hidden" variant="elevated">
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
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={32} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">No notification logs</h3>
            <p className="text-sm text-slate-500">WhatsApp messages will appear here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-slate-400" />
                      <span className="text-sm text-slate-700">{log.customer_phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-700 capitalize">
                      {log.message_type.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
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
                      >
                        {log.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-500">
                      {log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : '—'}
                    </span>
                  </TableCell>
                  <TableCell>
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
                  <TableCell align="right">
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
                        className="text-slate-400 hover:text-primary-600"
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
        <Card className="p-4" variant="default">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page <span className="font-medium text-slate-900">{page}</span> of{' '}
              <span className="font-medium text-slate-900">{Math.ceil(data.total / data.page_size)}</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / data.page_size)}
                onClick={() => setPage((p) => p + 1)}
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
