'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCustomerDetail, useCustomerAppointments, useUpdateCustomer, useCustomerHistory } from '@/hooks/useCustomers';
import { ConfirmChangeDialog, type FieldChange } from '@/components/ui/ConfirmChangeDialog';
import { ChangeHistoryPanel } from '@/components/ui/ChangeHistoryPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import StatusBadge from '@/components/appointments/StatusBadge';
import Link from 'next/link';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomerDetail(id);
  const { data: appts } = useCustomerAppointments(id);
  const { data: history = [], isLoading: historyLoading } = useCustomerHistory(id);
  const { mutate: updateCustomer, isPending: saving } = useUpdateCustomer();

  const [editing, setEditing] = useState(false);
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
        onError: (err: any) => {
          toast.error(err?.response?.data?.detail ?? 'Failed to update customer');
          setShowConfirm(false);
        },
      }
    );
  };

  if (isLoading) return <div className="text-gray-400 text-sm p-8 text-center">Loading…</div>;
  if (!customer) return <div className="text-gray-400 text-sm p-8 text-center">Not found</div>;

  return (
    <div className="max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{customer.name ?? 'Unknown'}</h2>
          {!editing ? (
            <Button variant="outline" size="sm" leftIcon={<Pencil size={14} />} onClick={startEdit}>
              Edit
            </Button>
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
              <p className="text-gray-400 text-xs">Phone</p>
              <p className="font-medium">{customer.phone}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Email</p>
              <p className="font-medium">{customer.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Customer since</p>
              <p className="font-medium">{format(new Date(customer.created_at), 'MMM d, yyyy')}</p>
            </div>
            {customer.notes && (
              <div>
                <p className="text-gray-400 text-xs">Notes</p>
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
              <p className="text-xs text-gray-400">Phone (cannot be changed)</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">{customer.phone}</p>
            </div>
          </div>
        )}
      </div>

      {/* Change history */}
      <ChangeHistoryPanel history={history} isLoading={historyLoading} />

      {/* Appointments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Appointment History ({appts?.total ?? 0})</h3>
        {!appts?.items.length ? (
          <p className="text-sm text-gray-400">No appointments</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {appts.items.map((a) => (
              <Link key={a.id} href={`/appointments/${a.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.service?.name ?? '—'}</p>
                  <p className="text-xs text-gray-400">
                    {a.slot ? format(new Date(a.slot.start_time), 'MMM d, h:mm a') : '—'}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmChangeDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        isLoading={saving}
        title="Confirm Customer Changes"
        changes={pendingChanges}
      />
    </div>
  );
}
