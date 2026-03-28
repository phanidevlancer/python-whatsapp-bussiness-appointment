'use client';

import { useState } from 'react';
import { Plus, PowerOff, Clock, Tag, Pencil, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
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

function ServiceHistoryRow({ serviceId }: { serviceId: string }) {
  const { data: history = [], isLoading } = useServiceHistory(serviceId);
  return (
    <tr>
      <td colSpan={6} className="px-4 pb-4 bg-slate-50/70">
        <ChangeHistoryPanel history={history} isLoading={isLoading} />
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
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: update, isPending: saving } = useUpdateService();

  const startEdit = () => {
    setEditName(s.name);
    setEditDesc(s.description ?? '');
    setEditDuration(String(s.duration_minutes));
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

    if (!changes.length) { setEditing(false); return; }
    setPendingChanges(changes);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    const payload: any = {};
    pendingChanges.forEach((c) => {
      payload[c.field] = c.field === 'duration_minutes' ? parseInt(c.newValue ?? '0') : c.newValue;
    });
    update(
      { id: s.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Service updated');
          setShowConfirm(false);
          setEditing(false);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.detail ?? 'Failed to update service');
          setShowConfirm(false);
        },
      }
    );
  };

  return (
    <>
      <TableRow key={s.id}>
        <TableCell>
          <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
            <Tag size={18} className="text-primary-600" />
          </div>
        </TableCell>
        <TableCell>
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[180px]" />
          ) : (
            <span className="font-medium text-slate-900">{s.name}</span>
          )}
        </TableCell>
        <TableCell>
          {editing ? (
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={1} resize="none" className="max-w-[220px] text-sm" />
          ) : (
            <span className="text-sm text-slate-500">{s.description ?? '—'}</span>
          )}
        </TableCell>
        <TableCell>
          {editing ? (
            <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="max-w-[90px]" />
          ) : (
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-sm text-slate-700">{s.duration_minutes} min</span>
            </div>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={s.is_active ? 'success' : 'default'} size="sm" dot>
            {s.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell align="right">
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={cancelEdit}>Cancel</Button>
                <Button variant="primary" size="sm" leftIcon={<Check size={14} />} onClick={requestSave}>Save</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={startEdit} className="text-slate-400 hover:text-slate-700">Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-slate-400 hover:text-slate-700"
                  title="Show history"
                >
                  {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
                {s.is_active ? (
                  <Button variant="ghost" size="sm" leftIcon={<PowerOff size={14} />} onClick={() => onDeactivate(s.id)} className="text-slate-400 hover:text-error-600">
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => onActivate(s.id)} className="text-slate-400 hover:text-success-600">
                    Activate
                  </Button>
                )}
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {showHistory && <ServiceHistoryRow serviceId={s.id} />}

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
  const [newDesc, setNewDesc] = useState('');

  const { data: services, isLoading } = useServicesList(true);
  const { mutate: create, isPending: creating } = useCreateService();
  const { mutate: deactivate } = useDeleteService();
  const { mutate: update } = useUpdateService();

  const handleCreate = () => {
    if (!newName || !newDuration) return;
    create(
      { name: newName, description: newDesc || undefined, duration_minutes: parseInt(newDuration) },
      {
        onSuccess: () => {
          toast.success('Service created successfully');
          setShowCreate(false);
          setNewName(''); setNewDuration('30'); setNewDesc('');
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create service'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Services</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your clinic services and pricing</p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Plus size={18} />} onClick={() => setShowCreate(true)}>
          New Service
        </Button>
      </div>

      {showCreate && (
        <Card className="p-5" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle>Create New Service</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Service Name" value={newName} onChange={(e) => setNewName(e.target.value)} leftIcon={<Tag size={16} />} />
            <Input placeholder="Duration (minutes)" type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} leftIcon={<Clock size={16} />} />
            <Textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} resize="none" rows={1} />
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
            <Button variant="primary" size="md" onClick={handleCreate} isLoading={creating}>
              {creating ? 'Creating...' : 'Create Service'}
            </Button>
            <Button variant="outline" size="md" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden" variant="elevated">
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
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag size={32} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">No services found</h3>
            <p className="text-sm text-slate-500">Create your first service to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead className="w-12"><span className="sr-only">Icon</span></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
