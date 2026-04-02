'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BriefcaseMedical, Phone, UserRound } from 'lucide-react';
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
import { Textarea } from '@/components/ui/Textarea';
import { DeliveryScheduler } from '@/components/ui/delivery-scheduler';
import { FluidDropdown, type FluidDropdownOption } from '@/components/ui/fluid-dropdown';

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
  const initialSchedulerDate = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const minimumSchedulerDate = useMemo(() => new Date(), []);
  const slotOptions =
    slots?.map((slot) => ({
      value: slot.id,
      label: format(new Date(slot.start_time), 'h:mm a'),
    })) ?? [];

  const serviceOptions: Array<FluidDropdownOption<string>> = loadingServices
    ? [{ id: '', label: 'Loading services...', icon: BriefcaseMedical, color: '#64748b' }]
    : [
        { id: '', label: 'Select a service', icon: BriefcaseMedical, color: '#64748b' },
        ...((services ?? []).map((service) => ({
          id: service.id,
          label: `${service.name} (${service.duration_minutes} min)`,
          icon: BriefcaseMedical,
          color: '#0d9488',
        })) satisfies Array<FluidDropdownOption<string>>),
      ];

  const providerOptions: Array<FluidDropdownOption<string>> = loadingProviders
    ? [{ id: '', label: 'Loading providers...', icon: UserRound, color: '#64748b' }]
    : [
        { id: '', label: 'Any available provider', icon: UserRound, color: '#64748b' },
        ...((providers ?? []).map((provider) => ({
          id: provider.id,
          label: provider.name,
          icon: UserRound,
          color: '#3b82f6',
        })) satisfies Array<FluidDropdownOption<string>>),
      ];

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
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Service *
            </label>
            <FluidDropdown
              value={selectedServiceId}
              options={serviceOptions}
              onChange={(value) => {
                setSelectedServiceId(value);
                setSelectedSlotId('');
              }}
              className="dashboard-surface-input h-12 w-full rounded-xl border text-base font-medium shadow-sm sm:h-10 sm:text-sm"
            />
          </div>

          {/* Provider Selection (Optional) */}
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Provider (Optional)
            </label>
            <FluidDropdown
              value={selectedProviderId}
              options={providerOptions}
              onChange={(value) => setSelectedProviderId(value)}
              className="dashboard-surface-input h-12 w-full rounded-xl border text-base font-medium shadow-sm sm:h-10 sm:text-sm"
            />
          </div>

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
                initialDate={initialSchedulerDate}
                minDate={minimumSchedulerDate}
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
