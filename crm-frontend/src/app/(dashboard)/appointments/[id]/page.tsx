'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, RefreshCw, Ban, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppointmentDetail, useAppointmentHistory, useCompleteAppointment, useNoShowAppointment } from '@/hooks/useAppointments';
import { useNotificationLogs } from '@/hooks/useNotifications';
import StatusBadge from '@/components/appointments/StatusBadge';
import StatusTimeline from '@/components/appointments/StatusTimeline';
import CancelDialog from '@/components/appointments/CancelDialog';
import RescheduleDialog from '@/components/appointments/RescheduleDialog';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const { data: appt, isLoading } = useAppointmentDetail(id);
  const { data: history } = useAppointmentHistory(id);
  const { data: notifLogs } = useNotificationLogs({ appointment_id: id });
  const { mutate: complete } = useCompleteAppointment();
  const { mutate: noShow } = useNoShowAppointment();

  if (isLoading) return <div className="text-gray-400 text-sm p-8 text-center">Loading…</div>;
  if (!appt) return <div className="text-gray-400 text-sm p-8 text-center">Not found</div>;

  const isConfirmed = appt.status === 'confirmed';

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {appt.customer?.name ?? appt.user_phone}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{appt.user_phone}</p>
          </div>
          <StatusBadge status={appt.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Service</p>
            <p className="font-medium text-gray-800">{appt.service?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Date/Time</p>
            <p className="font-medium text-gray-800">
              {appt.slot ? format(new Date(appt.slot.start_time), 'MMM d, h:mm a') : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Provider</p>
            <p className="font-medium text-gray-800">{appt.provider?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Booked</p>
            <p className="font-medium text-gray-800">{format(new Date(appt.created_at), 'MMM d, yyyy')}</p>
          </div>
        </div>
        {appt.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <span className="font-medium">Notes: </span>{appt.notes}
          </div>
        )}
        {appt.cancellation_reason && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            <span className="font-medium">Cancellation reason: </span>{appt.cancellation_reason}
          </div>
        )}

        {/* Action buttons */}
        {isConfirmed && (
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => setShowReschedule(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={14} /> Reschedule
            </button>
            <button
              onClick={() => complete(appt.id, { onSuccess: () => toast.success('Marked as completed') })}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <CheckCircle size={14} /> Mark Complete
            </button>
            <button
              onClick={() => noShow(appt.id, { onSuccess: () => toast.success('Marked as no-show') })}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AlertCircle size={14} /> No Show
            </button>
            <button
              onClick={() => setShowCancel(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
            >
              <Ban size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status History</h3>
          <StatusTimeline history={history ?? []} />
        </div>

        {/* WhatsApp Logs */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">WhatsApp Notifications</h3>
          {!notifLogs?.items.length ? (
            <p className="text-sm text-gray-400">No notifications sent</p>
          ) : (
            <div className="space-y-3">
              {notifLogs.items.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-700 capitalize">{log.message_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">
                      {log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    log.status === 'sent' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCancel && (
        <CancelDialog appointmentId={appt.id} onClose={() => setShowCancel(false)} />
      )}
      {showReschedule && appt.service_id && (
        <RescheduleDialog
          appointmentId={appt.id}
          serviceId={appt.service_id}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </div>
  );
}
