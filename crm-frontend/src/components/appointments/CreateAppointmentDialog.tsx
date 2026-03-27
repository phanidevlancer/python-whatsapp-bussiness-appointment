'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, User, Phone, Tag, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useCreateAppointment,
  useServicesListForForm,
  useProvidersListForForm,
  useSlotsList,
} from '@/hooks/useAppointments';
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateAppointmentDialog({ isOpen, onClose }: Props) {
  const [userPhone, setUserPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
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
        onError: (err: any) => {
          const message = err?.response?.data?.detail ?? 'Failed to create appointment';
          toast.error(message);
        },
      }
    );
  };

  const resetForm = () => {
    setUserPhone('');
    setSelectedServiceId('');
    setSelectedProviderId('');
    setSelectedDate('');
    setSelectedSlotId('');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Reset slot selection when service or date changes
  useEffect(() => {
    setSelectedSlotId('');
  }, [selectedServiceId, selectedDate]);

  const selectedService = services?.find((s) => s.id === selectedServiceId);

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
            onChange={(e) => setSelectedServiceId(e.target.value)}
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

          {/* Date Selection */}
          <Input
            label="Date *"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            leftIcon={<Calendar size={16} />}
            min={format(new Date(), 'yyyy-MM-dd')}
            required
          />

          {/* Time Slot Selection */}
          {selectedServiceId && selectedDate && (
            <Select
              label="Time Slot *"
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              options={[
                { value: '', label: 'Select a time slot' },
                ...(slots?.map((slot) => ({
                  value: slot.id,
                  label: format(new Date(slot.start_time), 'h:mm a'),
                })) ?? []),
              ]}
              leftIcon={<Clock size={16} />}
              disabled={loadingSlots || !slots?.length}
              helperText={
                slots?.length
                  ? `${slots.length} slot(s) available`
                  : selectedDate
                  ? 'No slots available for this date'
                  : undefined
              }
            />
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
      <ModalFooter>
        <Button variant="outline" size="md" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={!isFormValid || creating}
          isLoading={creating}
        >
          {creating ? 'Creating...' : 'Create Appointment'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
