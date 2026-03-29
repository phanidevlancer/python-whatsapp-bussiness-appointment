'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, X, Check, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCustomerDetail, useCustomerAppointments, useUpdateCustomer, useCustomerActivity } from '@/hooks/useCustomers';
import { useOpenLeadByPhone, useUpdateLead } from '@/hooks/useLeads';
import { ConfirmChangeDialog, type FieldChange } from '@/components/ui/ConfirmChangeDialog';
import ActivityTimeline from '@/components/customers/ActivityTimeline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import StatusBadge from '@/components/appointments/StatusBadge';
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from '@/components/ui/Modal';
import type { Lead, LeadStatus } from '@/types/lead';
import Link from 'next/link';

function LogCallDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [notes, setNotes] = useState(lead.crm_notes ?? '');
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const { mutate: update, isPending } = useUpdateLead();

  const handleSave = () => {
    update(
      { id: lead.id, status, crm_notes: notes },
      {
        onSuccess: () => { toast.success('Lead updated'); onClose(); },
        onError: () => toast.error('Failed to update lead'),
      }
    );
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeader>
        <ModalTitle>Log Call — {lead.customer?.name ?? lead.phone}</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Outcome</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
            className="dashboard-surface-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="contacted">Contacted — spoke to them</option>
              <option value="follow_up">Follow Up — call again later</option>
              <option value="lost">Lost — not interested</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What did they say? Any special requests?"
              className="dashboard-surface-input w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleSave} isLoading={isPending}>Save</Button>
      </ModalFooter>
    </Modal>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomerDetail(id);
  const { data: appts } = useCustomerAppointments(id);
  const { data: activity = [], isLoading: activityLoading } = useCustomerActivity(id);
  const { mutate: updateCustomer, isPending: saving } = useUpdateCustomer();
  const { data: openLead } = useOpenLeadByPhone(customer?.phone);

  const [editing, setEditing] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const startEdit = () => {
    setEditName(customer?.name ?? '');
    setEditEmail(customer?.email ?? '');
    setEditNotes(customer?.notes ?? '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const requestSave = () => {
    if (!customer) return;
    const changes: FieldChange[] = [];
    if (editName !== (customer.name ?? ''))
      changes.push({ field: 'name', label: 'Name', oldValue: customer.name, newValue: editName });
    if (editEmail !== (customer.email ?? ''))
      changes.push({ field: 'email', label: 'Email', oldValue: customer.email, newValue: editEmail });
    if (editNotes !== (customer.notes ?? ''))
      changes.push({ field: 'notes', label: 'Notes', oldValue: customer.notes, newValue: editNotes });

    if (!changes.length) {
      setEditing(false);
      return;
    }
    setPendingChanges(changes);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    if (!customer) return;
    const payload: Record<string, string> = {};
    pendingChanges.forEach((c) => {
      payload[c.field] = c.newValue ?? '';
    });
    updateCustomer(
      { id: customer.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Customer updated');
          setShowConfirm(false);
          setEditing(false);
        },
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof err.response === 'object' &&
            err.response !== null &&
            'data' in err.response &&
            typeof err.response.data === 'object' &&
            err.response.data !== null &&
            'detail' in err.response.data &&
            typeof err.response.data.detail === 'string'
              ? err.response.data.detail
              : 'Failed to update customer';
          toast.error(message);
          setShowConfirm(false);
        },
      }
    );
  };

  if (isLoading) return <div className="text-slate-400 text-sm p-8 text-center">Loading…</div>;
  if (!customer) return <div className="text-slate-400 text-sm p-8 text-center">Not found</div>;

  return (
    <div className="dashboard-page-shell space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
        <div className="space-y-5">
          {/* Details card */}
          <div className="dashboard-page-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">{customer.name ?? 'Unknown'}</h2>
              {!editing ? (
                <div className="flex gap-2">
                  {openLead && (
                    <Button variant="outline" size="sm" leftIcon={<PhoneCall size={14} />} onClick={() => setShowLogCall(true)}>
                      Log Call
                    </Button>
                  )}
                  <Button variant="outline" size="sm" leftIcon={<Pencil size={14} />} onClick={startEdit}>
                    Edit
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" leftIcon={<X size={14} />} onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" leftIcon={<Check size={14} />} onClick={requestSave}>
                    Save
                  </Button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Phone</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Email</p>
                  <p className="font-medium">{customer.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Customer since</p>
                  <p className="font-medium">{format(new Date(customer.created_at), 'MMM d, yyyy')}</p>
                </div>
                {customer.notes && (
                  <div>
                    <p className="text-slate-400 text-xs">Notes</p>
                    <p className="font-medium">{customer.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <Textarea
                  label="Notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                />
                <div>
                  <p className="text-xs text-slate-400">Phone (cannot be changed)</p>
                  <p className="text-sm font-medium text-slate-500 mt-0.5">{customer.phone}</p>
                </div>
              </div>
            )}
          </div>

          <ActivityTimeline events={activity} isLoading={activityLoading} />
        </div>

        <div className="space-y-5">
          <div className="dashboard-page-panel rounded-xl p-6 xl:sticky xl:top-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Appointment History ({appts?.total ?? 0})</h3>
            {!appts?.items.length ? (
              <p className="text-sm text-slate-400">No appointments</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {appts.items.map((a) => (
                  <Link key={a.id} href={`/appointments/${a.id}`} className="flex items-center justify-between rounded px-2 py-3 transition-colors -mx-2 hover:[background:color-mix(in_srgb,var(--surface-container-low)_90%,transparent)]">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{a.service?.name ?? '—'}</p>
                      <p className="text-xs text-slate-400">
                        {a.slot ? format(new Date(a.slot.start_time), 'MMM d, h:mm a') : '—'}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmChangeDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        isLoading={saving}
        title="Confirm Customer Changes"
        changes={pendingChanges}
      />

      {showLogCall && openLead && (
        <LogCallDialog lead={openLead} onClose={() => setShowLogCall(false)} />
      )}
    </div>
  );
}
