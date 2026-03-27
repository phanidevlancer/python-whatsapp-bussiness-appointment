'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotificationLogs, useResendNotification } from '@/hooks/useNotifications';
import Link from 'next/link';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotificationLogs({ page });
  const { mutate: resend } = useResendNotification();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Phone</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Type</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Sent At</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Error</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : !data?.items.length ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No notification logs</td></tr>
            ) : data.items.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-700">{log.customer_phone}</td>
                <td className="py-3 px-4 text-gray-600 capitalize">{log.message_type.replace(/_/g, ' ')}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    log.status === 'sent' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-400 text-xs">
                  {log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : '—'}
                </td>
                <td className="py-3 px-4 text-red-500 text-xs max-w-xs truncate" title={log.error_message ?? ''}>
                  {log.error_message ?? '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  {log.appointment_id && (
                    <button
                      onClick={() => resend(log.appointment_id!, {
                        onSuccess: () => toast.success('Notification resent'),
                        onError: () => toast.error('Resend failed'),
                      })}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Resend"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page} of {Math.ceil(data.total / data.page_size)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <button disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
