'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, RefreshCw, Ban, CheckCircle, AlertCircle, MessageSquare, Clock, User, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppointmentDetail, useAppointmentHistory, useCompleteAppointment, useNoShowAppointment } from '@/hooks/useAppointments';
import { useNotificationLogs } from '@/hooks/useNotifications';
import StatusBadge from '@/components/appointments/StatusBadge';
import StatusTimeline from '@/components/appointments/StatusTimeline';
import CancelDialog from '@/components/appointments/CancelDialog';
import RescheduleDialog from '@/components/appointments/RescheduleDialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

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

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" className="w-20 h-4" />
        </div>
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={48} height={48} />
              <div>
                <Skeleton variant="text" className="w-48 h-5 mb-2" />
                <Skeleton variant="text" className="w-32 h-4" />
              </div>
            </div>
            <Skeleton variant="rounded" width={80} height={24} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton variant="text" className="w-16 h-3 mb-2" />
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="max-w-4xl">
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Appointment not found</h3>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isConfirmed = appt.status === 'confirmed';
  const isSlotPast = appt.slot ? new Date(appt.slot.start_time) < new Date() : false;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header Card */}
      <Card className="p-6" variant="elevated">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Avatar
              name={appt.customer?.name ?? appt.user_phone}
              size="lg"
            />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {appt.customer?.name ?? appt.user_phone}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                <MessageSquare size={14} />
                {appt.user_phone}
              </p>
            </div>
          </div>
          <StatusBadge status={appt.status} size="lg" />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Stethoscope size={14} />
              <span>Service</span>
            </div>
            <p className="font-medium text-gray-900">{appt.service?.name ?? '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Clock size={14} />
              <span>Date/Time</span>
            </div>
            <p className="font-medium text-gray-900">
              {appt.slot ? format(new Date(appt.slot.start_time), 'MMM d, h:mm a') : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <User size={14} />
              <span>Provider</span>
            </div>
            <p className="font-medium text-gray-900">{appt.provider?.name ?? '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <CalendarIcon size={14} />
              <span>Booked</span>
            </div>
            <p className="font-medium text-gray-900">
              {format(new Date(appt.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Notes */}
        {appt.notes && (
          <div className="mt-4 p-3 bg-blue-50 rounded-xl text-sm text-blue-800 border border-blue-100">
            <span className="font-medium">Notes: </span>{appt.notes}
          </div>
        )}

        {/* Cancellation Reason */}
        {appt.cancellation_reason && (
          <div className="mt-4 p-3 bg-error-50 rounded-xl text-sm text-error-700 border border-error-100">
            <span className="font-medium">Cancellation reason: </span>{appt.cancellation_reason}
          </div>
        )}

        {/* Action Buttons */}
        {isConfirmed && (
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-100">
            <Button
              variant="outline"
              size="md"
              leftIcon={<RefreshCw size={16} />}
              onClick={() => setShowReschedule(true)}
            >
              Reschedule
            </Button>
            <Button
              variant="success"
              size="md"
              leftIcon={<CheckCircle size={16} />}
              onClick={() => complete(appt.id, { onSuccess: () => toast.success('Marked as completed') })}
              disabled={!isSlotPast}
              title={!isSlotPast ? 'Available after the appointment time has passed' : undefined}
            >
              Mark Complete
            </Button>
            <Button
              variant="outline"
              size="md"
              leftIcon={<AlertCircle size={16} />}
              onClick={() => noShow(appt.id, { onSuccess: () => toast.success('Marked as no-show') })}
              disabled={!isSlotPast}
              title={!isSlotPast ? 'Available after the appointment time has passed' : undefined}
            >
              No Show
            </Button>
            <Button
              variant="danger"
              size="md"
              leftIcon={<Ban size={16} />}
              onClick={() => setShowCancel(true)}
            >
              Cancel
            </Button>
          </div>
        )}
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Timeline */}
        <Card className="p-6" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle>Status History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StatusTimeline history={history ?? []} appointmentSource={appt.source} />
          </CardContent>
        </Card>

        {/* WhatsApp Logs */}
        <Card className="p-6" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle>WhatsApp Notifications</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {!notifLogs?.items.length ? (
              <div className="text-center py-8">
                <MessageSquare size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No notifications sent</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifLogs.items.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {log.message_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.sent_at
                          ? format(new Date(log.sent_at), 'MMM d, h:mm a')
                          : format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
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

// Import CalendarIcon
function CalendarIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
