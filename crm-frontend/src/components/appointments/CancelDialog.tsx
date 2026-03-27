'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCancelAppointment } from '@/hooks/useAppointments';

interface Props {
  appointmentId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CancelDialog({ appointmentId, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const { mutate: cancel, isPending } = useCancelAppointment();

  const handleSubmit = () => {
    cancel(
      { id: appointmentId, reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success('Appointment cancelled. WhatsApp notification sent to customer.');
          onClose();
          onSuccess?.();
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to cancel'),
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Cancel Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">
          A WhatsApp notification will be sent to the customer immediately.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="e.g. Provider unavailable"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Go back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {isPending ? 'Cancelling…' : 'Cancel Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
