'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, Ban, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Appointment } from '@/types/appointment';
import StatusBadge from './StatusBadge';
import { useCancelAppointment, useCompleteAppointment } from '@/hooks/useAppointments';

interface Props {
  appointments: Appointment[];
  isLoading: boolean;
}

export default function AppointmentsTable({ appointments, isLoading }: Props) {
  const { mutate: cancel } = useCancelAppointment();
  const { mutate: complete } = useCompleteAppointment();

  if (isLoading) return <div className="text-gray-400 text-sm text-center py-16">Loading…</div>;
  if (appointments.length === 0) return <div className="text-gray-400 text-sm text-center py-16">No appointments found</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Customer</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Service</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Date/Time</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Provider</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {appointments.map((appt) => (
            <tr key={appt.id} className="hover:bg-gray-50">
              <td className="py-3 px-4">
                <p className="font-medium text-gray-900">{appt.customer?.name ?? appt.user_phone}</p>
                <p className="text-xs text-gray-400">{appt.user_phone}</p>
              </td>
              <td className="py-3 px-4 text-gray-700">{appt.service?.name ?? '—'}</td>
              <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                {appt.slot ? format(new Date(appt.slot.start_time), 'MMM d, h:mm a') : '—'}
              </td>
              <td className="py-3 px-4 text-gray-600">{appt.provider?.name ?? '—'}</td>
              <td className="py-3 px-4"><StatusBadge status={appt.status} /></td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/appointments/${appt.id}`} className="text-gray-400 hover:text-blue-600 transition-colors">
                    <Eye size={15} />
                  </Link>
                  {appt.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => complete(appt.id, { onSuccess: () => toast.success('Marked as completed') })}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                        title="Mark complete"
                      >
                        <CheckCircle size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Cancel this appointment?')) {
                            cancel({ id: appt.id }, {
                              onSuccess: () => toast.success('Appointment cancelled. WhatsApp notification sent.'),
                            });
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Cancel"
                      >
                        <Ban size={15} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
