'use client';

import { useState } from 'react';
import { Plus, User, Mail, Phone, Pencil, X, Check, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProvidersList, useCreateProvider, useUpdateProvider, useProviderHistory } from '@/hooks/useProviders';
import { useServicesList } from '@/hooks/useServices';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmChangeDialog, type FieldChange } from '@/components/ui/ConfirmChangeDialog';
import { ChangeHistoryPanel } from '@/components/ui/ChangeHistoryPanel';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Provider } from '@/types/appointment';

const ROLES = ['doctor', 'technician', 'therapist', 'nurse'];

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { data?: unknown } }).response?.data &&
    typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
  ) {
    return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? fallback;
  }
  return fallback;
}

function ServiceMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: services = [] } = useServicesList(false);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {services.map((s) => {
        const selected = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              selected
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {selected && <span className="mr-1">✓</span>}
            {s.name}
          </button>
        );
      })}
      {services.length === 0 && (
        <span className="text-xs text-slate-400">No services available — add services first</span>
      )}
    </div>
  );
}

function ProviderHistoryRow({ providerId }: { providerId: string }) {
  const { data: history = [], isLoading } = useProviderHistory(providerId);
  return (
    <tr>
      <td colSpan={7} className="dashboard-page-table-head px-4 pb-4">
        <ChangeHistoryPanel history={history} isLoading={isLoading} />
      </td>
    </tr>
  );
}

function ProviderRow({ p }: { p: Provider }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSlotDuration, setEditSlotDuration] = useState(20);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: update, isPending: saving } = useUpdateProvider();

  const currentServiceIds = (p.services ?? []).map((s) => s.id);

  const startEdit = () => {
    setEditName(p.name);
    setEditEmail(p.email ?? '');
    setEditPhone(p.phone ?? '');
    setEditRole(p.role ?? 'doctor');
    setEditSlotDuration(p.slot_duration_minutes ?? 20);
    setEditServiceIds(currentServiceIds);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const requestSave = () => {
    const changes: FieldChange[] = [];
    if (editName !== p.name)
      changes.push({ field: 'name', label: 'Name', oldValue: p.name, newValue: editName });
    if (editEmail !== (p.email ?? ''))
      changes.push({ field: 'email', label: 'Email', oldValue: p.email, newValue: editEmail });
    if (editPhone !== (p.phone ?? ''))
      changes.push({ field: 'phone', label: 'Phone', oldValue: p.phone, newValue: editPhone });
    if (editRole !== (p.role ?? 'doctor'))
      changes.push({ field: 'role', label: 'Role', oldValue: p.role, newValue: editRole });
    if (editSlotDuration !== (p.slot_duration_minutes ?? 20))
      changes.push({ field: 'slot_duration_minutes', label: 'Slot Duration (min)', oldValue: String(p.slot_duration_minutes ?? 20), newValue: String(editSlotDuration) });
    const sidsChanged =
      JSON.stringify([...editServiceIds].sort()) !== JSON.stringify([...currentServiceIds].sort());
    if (sidsChanged)
      changes.push({ field: 'service_ids', label: 'Services', oldValue: `${currentServiceIds.length} assigned`, newValue: `${editServiceIds.length} assigned` });

    if (!changes.length) { setEditing(false); return; }
    setPendingChanges(changes);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    const payload: { name?: string; email?: string; phone?: string; role?: string; slot_duration_minutes?: number; service_ids?: string[] } = {};
    pendingChanges.forEach((c) => {
      if (c.field === 'name') payload.name = c.newValue ?? '';
      if (c.field === 'email') payload.email = c.newValue || undefined;
      if (c.field === 'phone') payload.phone = c.newValue || undefined;
      if (c.field === 'role') payload.role = editRole;
      if (c.field === 'slot_duration_minutes') payload.slot_duration_minutes = editSlotDuration;
      if (c.field === 'service_ids') payload.service_ids = editServiceIds;
    });
    update(
      { id: p.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Provider updated');
          setShowConfirm(false);
          setEditing(false);
        },
        onError: (err: unknown) => {
          toast.error(getErrorMessage(err, 'Failed to update provider'));
          setShowConfirm(false);
        },
      }
    );
  };

  return (
    <>
      <TableRow className="group">
        <TableCell className="py-4">
          <Avatar name={p.name} size="sm" />
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="dashboard-surface-input max-w-[160px] rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          ) : (
            <span className="font-semibold text-slate-900">{p.name}</span>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="dashboard-surface-input h-10 rounded-2xl border px-3 text-sm shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200 bg-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          ) : (
            <Badge variant="default" size="sm" className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
              {p.role ?? 'doctor'}
            </Badge>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input
              type="number"
              min={5}
              max={120}
              value={editSlotDuration}
              onChange={(e) => setEditSlotDuration(Number(e.target.value))}
              className="dashboard-surface-input max-w-[80px] rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200"
            />
          ) : (
            <span className="text-sm text-slate-600">{p.slot_duration_minutes ?? 20} min</span>
          )}
        </TableCell>
        <TableCell className="py-4 max-w-[220px]">
          {editing ? (
            <ServiceMultiSelect value={editServiceIds} onChange={setEditServiceIds} />
          ) : (
            <div className="flex flex-wrap gap-1">
              {(p.services ?? []).length > 0
                ? (p.services ?? []).map((s) => (
                    <span key={s.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{s.name}</span>
                  ))
                : <span className="text-xs text-slate-400">None assigned</span>
              }
            </div>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="dashboard-surface-input max-w-[200px] rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail size={14} className="text-slate-400" />
              {p.email ?? '—'}
            </div>
          )}
        </TableCell>
        <TableCell className="py-4">
          <Badge variant={p.is_active ? 'success' : 'default'} size="sm" dot className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {p.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell align="right" className="py-4">
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={cancelEdit} className="rounded-2xl px-3" style={{ color: 'var(--text-secondary)' }}>Cancel</Button>
                <Button variant="primary" size="sm" leftIcon={<Check size={14} />} onClick={requestSave} className="rounded-2xl px-3">Save</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={startEdit} className="rounded-2xl px-3" style={{ color: 'var(--text-tertiary)' }}>Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory((v) => !v)}
                  className="rounded-2xl px-3"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="Show history"
                >
                  {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(
                      { id: p.id, is_active: !p.is_active },
                      { onSuccess: () => toast.success(`Provider ${p.is_active ? 'deactivated' : 'activated'}`) }
                    )
                  }
                  className={p.is_active ? 'rounded-2xl px-3 text-slate-400 hover:bg-red-50 hover:text-error-600' : 'rounded-2xl px-3 text-slate-400 hover:bg-emerald-50 hover:text-success-600'}
                >
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {showHistory && <ProviderHistoryRow providerId={p.id} />}

      <ConfirmChangeDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        isLoading={saving}
        title="Confirm Provider Changes"
        changes={pendingChanges}
      />
    </>
  );
}

export default function ProvidersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('doctor');
  const [newSlotDuration, setNewSlotDuration] = useState(20);
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);

  const { data: providers, isLoading } = useProvidersList(false);
  const { mutate: create, isPending: creating } = useCreateProvider();

  const handleCreate = () => {
    if (!newName) return;
    create(
      { name: newName, role: newRole, email: newEmail || undefined, phone: newPhone || undefined, slot_duration_minutes: newSlotDuration, service_ids: newServiceIds },
      {
        onSuccess: () => {
          toast.success('Provider created successfully');
          setShowCreate(false);
          setNewName(''); setNewEmail(''); setNewPhone(''); setNewRole('doctor'); setNewSlotDuration(20); setNewServiceIds([]);
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to create provider')),
      }
    );
  };

  return (
    <div className="dashboard-page-shell space-y-5">
      <div className="dashboard-page-header flex items-center justify-between rounded-[24px] px-6 py-5">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Providers</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage your clinic staff and providers</p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Plus size={18} />} onClick={() => setShowCreate(true)} className="h-11 rounded-2xl border border-primary-500/20 px-5 font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)]">
          Add Provider
        </Button>
      </div>

      {showCreate && (
        <Card className="dashboard-page-panel rounded-[24px] p-5" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle className="text-lg font-bold tracking-[-0.02em] text-slate-900">Add New Provider</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Full Name *" value={newName} onChange={(e) => setNewName(e.target.value)} leftIcon={<User size={16} />} className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
            <div className="relative">
              <Stethoscope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="dashboard-surface-input h-12 w-full rounded-2xl border pl-9 pr-4 text-sm shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200 bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <Input placeholder="Email (optional)" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} leftIcon={<Mail size={16} />} className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
            <Input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} leftIcon={<Phone size={16} />} className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
            <div>
              <label className="block mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Slot Duration (min)</label>
              <Input
                type="number"
                min={5}
                max={120}
                value={newSlotDuration}
                onChange={(e) => setNewSlotDuration(Number(e.target.value))}
                className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Assign Services</p>
            <ServiceMultiSelect value={newServiceIds} onChange={setNewServiceIds} />
          </div>
          <div className="mt-4 flex gap-3 border-t pt-4" style={{ borderColor: 'var(--border-light)' }}>
            <Button variant="primary" size="md" onClick={handleCreate} isLoading={creating} className="rounded-2xl px-5 shadow-[0_14px_28px_rgba(13,148,136,0.18)]">
              {creating ? 'Creating...' : 'Add Provider'}
            </Button>
            <Button variant="outline" size="md" onClick={() => setShowCreate(false)} className="dashboard-action-outline rounded-2xl border px-5">Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="dashboard-page-panel overflow-hidden rounded-[28px] p-0" variant="elevated">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="w-40 h-4" />
                  <Skeleton variant="text" className="w-32 h-3" />
                </div>
                <Skeleton variant="text" className="w-24 h-4" />
                <Skeleton variant="text" className="w-20 h-4" />
              </div>
            ))}
          </div>
        ) : !providers?.length ? (
          <div className="py-20 text-center">
            <div className="dashboard-empty-state-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <User size={32} className="text-primary-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">No providers found</h3>
            <p className="text-sm text-slate-500">Add your first provider to get started</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableHeader className="dashboard-page-table-head border-b">
              <TableRow hoverable={false}>
                <TableHead className="w-12 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="sr-only">Avatar</span></TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Slot Duration</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Services</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                <TableHead align="right" className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {providers.map((p) => (
                <ProviderRow key={p.id} p={p} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
