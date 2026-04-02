'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useRescheduleAppointment } from '@/hooks/useAppointments';
import api from '@/lib/api';
import type { TimeSlot } from '@/types/appointment';

interface Props {
  appointmentId: string;
  serviceId: string;
  onClose: () => void;
}

export default function RescheduleDialog({ appointmentId, serviceId, onClose }: Props) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [reason, setReason] = useState('');

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: async () => {
      const res = await api.get<{ items: TimeSlot[]; total: number }>('/api/v1/slots', {
        params: { service_id: serviceId, filter_date: selectedDate, available_only: true },
      });
      return res.data.items;
    },
    enabled: !!selectedDate && !!serviceId,
  });

  const { mutate: reschedule, isPending } = useRescheduleAppointment();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  const handleSubmit = () => {
    if (!selectedSlotId) {
      toast.error('Please select a time slot');
      return;
    }
    reschedule(
      { 
        id: appointmentId, 
        new_slot_id: selectedSlotId, 
        reason: reason || undefined,
        reschedule_source: 'admin_dashboard',
      },
      {
        onSuccess: () => {
          toast.success('Appointment rescheduled. WhatsApp notification sent to customer.');
          onClose();
        },
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
              ? ((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Failed to reschedule')
              : 'Failed to reschedule';
          toast.error(message);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-4">
      <div className="flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-6rem)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl sm:max-h-[90dvh]">
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border-light)' }}>
          <h2 className="text-lg font-semibold text-gray-900">Reschedule Appointment</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlotId(''); }}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {selectedDate && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Available Slots</label>
            {slotsLoading ? (
              <p className="text-sm text-gray-400">Loading slots…</p>
            ) : !slots?.length ? (
              <p className="text-sm text-gray-400">No available slots on this date</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`text-xs py-2 px-2 rounded-lg border transition-colors ${
                      selectedSlotId === slot.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {format(new Date(slot.start_time), 'h:mm a')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Reason for rescheduling"
          />
        </div>
        </div>

        <div className="flex justify-end gap-3 border-t bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-6 sm:pb-4" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !selectedSlotId}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {isPending ? 'Rescheduling…' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
