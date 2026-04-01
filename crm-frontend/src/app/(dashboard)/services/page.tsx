'use client';

import { useState } from 'react';
import { Plus, PowerOff, Clock, Tag, Pencil, X, Check, ChevronDown, ChevronUp, IndianRupee, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useServicesList, useCreateService, useDeleteService, useUpdateService, useServiceHistory } from '@/hooks/useServices';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
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
import type { Service } from '@/types/appointment';

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

function formatCost(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 'Rs 0.00';
  }
  return `Rs ${amount.toFixed(2)}`;
}

function ServiceDetailsRow({ service, showHistory }: { service: Service; showHistory: boolean }) {
  const { data: history = [], isLoading } = useServiceHistory(service.id);
  const providers = service.providers ?? [];

  return (
    <tr>
      <td colSpan={8} className="px-6 pb-4 pt-0 dashboard-page-table-head">
        <div className="space-y-4">
          {providers.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                Assigned Providers
              </p>
              <div className="flex flex-wrap gap-2">
                {providers.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: 'var(--panel-background)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                    {p.name}
                    <span className="text-[10px] capitalize" style={{ color: 'var(--text-tertiary)' }}>({p.role})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {showHistory && <ChangeHistoryPanel history={history} isLoading={isLoading} />}
        </div>
      </td>
    </tr>
  );
}

function ServiceRow({
  s,
  onDeactivate,
  onActivate,
}: {
  s: Service;
  onDeactivate: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editCost, setEditCost] = useState('');
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: update, isPending: saving } = useUpdateService();

  const startEdit = () => {
    setEditName(s.name);
    setEditDesc(s.description ?? '');
    setEditDuration(String(s.duration_minutes));
    setEditCost(String(s.cost));
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const requestSave = () => {
    const changes: FieldChange[] = [];
    if (editName !== s.name)
      changes.push({ field: 'name', label: 'Name', oldValue: s.name, newValue: editName });
    if (editDesc !== (s.description ?? ''))
      changes.push({ field: 'description', label: 'Description', oldValue: s.description, newValue: editDesc });
    if (editDuration !== String(s.duration_minutes))
      changes.push({ field: 'duration_minutes', label: 'Duration (min)', oldValue: String(s.duration_minutes), newValue: editDuration });
    if (editCost !== String(s.cost))
      changes.push({ field: 'cost', label: 'Cost', oldValue: String(s.cost), newValue: editCost });

    if (!changes.length) { setEditing(false); return; }
    setPendingChanges(changes);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    const payload: { name?: string; description?: string; duration_minutes?: number; cost?: number } = {};
    pendingChanges.forEach((c) => {
      if (c.field === 'name') payload.name = c.newValue ?? '';
      if (c.field === 'description') payload.description = c.newValue || undefined;
      if (c.field === 'duration_minutes') payload.duration_minutes = parseInt(c.newValue ?? '0');
      if (c.field === 'cost') payload.cost = parseFloat(c.newValue ?? '0');
    });
    update(
      { id: s.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Service updated');
          setShowConfirm(false);
          setEditing(false);
        },
        onError: (err: unknown) => {
          toast.error(getErrorMessage(err, 'Failed to update service'));
          setShowConfirm(false);
        },
      }
    );
  };

    return (
    <>
      <TableRow key={s.id} className="group">
        <TableCell className="py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Tag size={18} className="text-primary-600" />
          </div>
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="dashboard-surface-input max-w-[180px] rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          ) : (
            <span className="font-semibold text-slate-900">{s.name}</span>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={1} resize="none" className="dashboard-surface-input max-w-[220px] rounded-2xl border text-sm shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          ) : (
            <span className="text-sm text-slate-500">{s.description ?? '—'}</span>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="dashboard-surface-input max-w-[90px] rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          ) : (
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-sm text-slate-700">{s.duration_minutes} min</span>
            </div>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="dashboard-surface-input max-w-[110px] rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          ) : (
            <div className="flex items-center gap-2">
              <IndianRupee size={14} className="text-slate-400" />
              <span className="text-sm text-slate-700">{formatCost(s.cost)}</span>
            </div>
          )}
        </TableCell>
        <TableCell className="py-4">
          {(() => {
            const providers = s.providers ?? [];
            const count = providers.length;
            if (count === 0) {
              return (
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-amber-400" />
                  <span className="text-sm font-medium text-amber-500">None</span>
                </div>
              );
            }
            const shown = providers.slice(0, 2);
            const extra = count - 2;
            return (
              <div className="flex flex-wrap items-center gap-1">
                {shown.map((p) => (
                  <span key={p.id} className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>+{extra} more</span>
                )}
              </div>
            );
          })()}
        </TableCell>
        <TableCell className="py-4">
          <Badge
            variant={s.is_active ? 'success' : 'default'}
            size="sm"
            dot
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          >
            {s.is_active ? 'Active' : 'Inactive'}
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
                {s.is_active ? (
                  <Button variant="ghost" size="sm" leftIcon={<PowerOff size={14} />} onClick={() => onDeactivate(s.id)} className="rounded-2xl px-3 text-slate-400 hover:bg-red-50 hover:text-error-600">
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => onActivate(s.id)} className="rounded-2xl px-3 text-slate-400 hover:bg-emerald-50 hover:text-success-600">
                    Activate
                  </Button>
                )}
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {showHistory && <ServiceDetailsRow service={s} showHistory={showHistory} />}

      <ConfirmChangeDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        isLoading={saving}
        title="Confirm Service Changes"
        changes={pendingChanges}
      />
    </>
  );
}

export default function ServicesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newCost, setNewCost] = useState('0');
  const [newDesc, setNewDesc] = useState('');

  const { data: services, isLoading } = useServicesList(true);
  const { mutate: create, isPending: creating } = useCreateService();
  const { mutate: deactivate } = useDeleteService();
  const { mutate: update } = useUpdateService();

  const handleCreate = () => {
    if (!newName || !newDuration) return;
    create(
      {
        name: newName,
        description: newDesc || undefined,
        duration_minutes: parseInt(newDuration),
        cost: parseFloat(newCost || '0'),
      },
      {
        onSuccess: () => {
          toast.success('Service created successfully');
          setShowCreate(false);
          setNewName(''); setNewDuration('30'); setNewCost('0'); setNewDesc('');
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to create service')),
      }
    );
  };

  return (
    <div className="dashboard-page-shell space-y-5">
      <div className="dashboard-page-header flex items-center justify-between rounded-[24px] px-6 py-5">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Services</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage your clinic services and pricing</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
          onClick={() => setShowCreate(true)}
          className="h-11 rounded-2xl border border-primary-500/20 px-5 font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)]"
        >
          New Service
        </Button>
      </div>

      {showCreate && (
        <Card className="dashboard-page-panel rounded-[24px] p-5" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle className="text-lg font-bold tracking-[-0.02em] text-slate-900">Create New Service</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Service Name" value={newName} onChange={(e) => setNewName(e.target.value)} leftIcon={<Tag size={16} />} className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
            <Input placeholder="Duration (minutes)" type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} leftIcon={<Clock size={16} />} className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
            <Input placeholder="Cost" type="number" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} leftIcon={<IndianRupee size={16} />} className="dashboard-surface-input h-12 rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
            <Textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} resize="none" rows={1} className="dashboard-surface-input rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200" />
          </div>
          <div className="mt-4 flex gap-3 border-t pt-4" style={{ borderColor: 'var(--border-light)' }}>
            <Button variant="primary" size="md" onClick={handleCreate} isLoading={creating} className="rounded-2xl px-5 shadow-[0_14px_28px_rgba(13,148,136,0.18)]">
              {creating ? 'Creating...' : 'Create Service'}
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
        ) : !services?.length ? (
          <div className="py-20 text-center">
            <div className="dashboard-empty-state-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <Tag size={32} className="text-primary-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">No services found</h3>
            <p className="text-sm text-slate-500">Create your first service to get started</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableHeader className="dashboard-page-table-head border-b">
              <TableRow hoverable={false}>
                <TableHead className="w-12 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="sr-only">Icon</span></TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Description</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Duration</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Cost</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Providers</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                <TableHead align="right" className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {services.map((s) => (
                <ServiceRow
                  key={s.id}
                  s={s}
                  onDeactivate={(id) => deactivate(id, { onSuccess: () => toast.success('Service deactivated') })}
                  onActivate={(id) => update({ id, is_active: true }, { onSuccess: () => toast.success('Service activated') })}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
