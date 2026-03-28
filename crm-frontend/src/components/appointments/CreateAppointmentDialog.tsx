'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { User, Phone, Tag } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  useCreateAppointment,
  useServicesListForForm,
  useProvidersListForForm,
  useSlotsList,
} from '@/hooks/useAppointments';
import { Modal, ModalHeader, ModalTitle, ModalContent } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { DeliveryScheduler } from '@/components/ui/delivery-scheduler';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateAppointmentDialog({ isOpen, onClose }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [userPhone, setUserPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [notes, setNotes] = useState('');

  const { mutate: create, isPending: creating } = useCreateAppointment();
  const { data: services, isLoading: loadingServices } = useServicesListForForm();
  const { data: providers, isLoading: loadingProviders } = useProvidersListForForm();
  const { data: slots, isLoading: loadingSlots } = useSlotsList(
    selectedServiceId || undefined,
    selectedDate || undefined
  );

  const isFormValid = userPhone && selectedServiceId && selectedSlotId;

  const handleSubmit = () => {
    if (!isFormValid) return;

    create(
      {
        user_phone: userPhone,
        service_id: selectedServiceId,
        slot_id: selectedSlotId,
        provider_id: selectedProviderId || undefined,
        notes: notes || undefined,
        source: 'admin_dashboard',
      },
      {
        onSuccess: () => {
          toast.success('Appointment created successfully');
          resetForm();
          onClose();
        },
        onError: (err: unknown) => {
          const message = axios.isAxiosError(err)
            ? (err.response?.data as { detail?: string } | undefined)?.detail ?? 'Failed to create appointment'
            : 'Failed to create appointment';
          toast.error(message);
        },
      }
    );
  };

  const resetForm = () => {
    setUserPhone('');
    setSelectedServiceId('');
    setSelectedProviderId('');
    setSelectedDate(today);
    setSelectedSlotId('');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const selectedService = services?.find((s) => s.id === selectedServiceId);
  const slotOptions =
    slots?.map((slot) => ({
      value: slot.id,
      label: format(new Date(slot.start_time), 'h:mm a'),
    })) ?? [];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalHeader>
        <ModalTitle>Create New Appointment</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          {/* Customer Phone */}
          <Input
            label="Customer Phone *"
            placeholder="+1234567890"
            value={userPhone}
            onChange={(e) => setUserPhone(e.target.value)}
            leftIcon={<Phone size={16} />}
            required
          />

          {/* Service Selection */}
          <Select
            label="Service *"
            value={selectedServiceId}
            onChange={(e) => {
              setSelectedServiceId(e.target.value);
              setSelectedSlotId('');
            }}
            options={[
              { value: '', label: 'Select a service' },
              ...(services?.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.duration_minutes} min)`,
              })) ?? []),
            ]}
            leftIcon={<Tag size={16} />}
            disabled={loadingServices}
          />

          {/* Provider Selection (Optional) */}
          <Select
            label="Provider (Optional)"
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            options={[
              { value: '', label: 'Any available provider' },
              ...(providers?.map((p) => ({
                value: p.id,
                label: p.name,
              })) ?? []),
            ]}
            leftIcon={<User size={16} />}
            disabled={loadingProviders}
          />

          {selectedServiceId ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Appointment Window *</p>
                <p className="mt-1 text-xs text-slate-500">
                  {loadingSlots
                    ? 'Loading available time slots...'
                    : slotOptions.length
                    ? `${slotOptions.length} slot(s) available for ${selectedService?.name ?? 'the selected service'}`
                    : 'Choose a day to check available time slots.'}
                </p>
              </div>
              <DeliveryScheduler
                initialDate={new Date(selectedDate)}
                minDate={new Date()}
                timeSlots={slotOptions}
                timeZone="Clinic local time"
                selectedTime={selectedSlotId || null}
                onTimeChange={setSelectedSlotId}
                onDateChange={(date) => {
                  setSelectedDate(format(date, 'yyyy-MM-dd'));
                  setSelectedSlotId('');
                }}
                onSchedule={() => handleSubmit()}
                onCancel={handleClose}
                scheduleLabel={creating ? 'Creating...' : 'Create Appointment'}
                scheduleDisabled={!isFormValid || creating}
                className="max-w-none"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Select a service first to open the scheduler and load available time slots.
            </div>
          )}

          {/* Notes */}
          <Textarea
            label="Notes (Optional)"
            placeholder="Add any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            resize="vertical"
            rows={3}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}
