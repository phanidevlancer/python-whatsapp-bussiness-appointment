'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  UserX, Phone, CheckCircle2, PhoneCall, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useLeadsList, useUpdateLead, useConvertLead, useBulkAssignLeads } from '@/hooks/useLeads';
import { useProvidersListForForm, useSlotsList } from '@/hooks/useAppointments';
import type { Lead, LeadStatus, CustomerType } from '@/types/lead';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  new_lead:   'New Lead',
  contacted:  'Contacted',
  follow_up:  'Follow Up',
  converted:  'Converted',
  lost:       'Lost',
};

const STATUS_COLORS: Record<LeadStatus, 'error' | 'warning' | 'primary' | 'success' | 'default'> = {
  new_lead:  'error',
  contacted: 'warning',
  follow_up: 'primary',
  converted: 'success',
  lost:      'default',
};

const TYPE_LABELS: Record<CustomerType, string> = {
  prospect:   'Prospect',
  returning:  'Returning',
  re_engaged: 'Re-engaged',
};

const TYPE_COLORS: Record<CustomerType, string> = {
  prospect:   'bg-blue-100 text-blue-700',
  returning:  'bg-teal-100 text-teal-700',
  re_engaged: 'bg-purple-100 text-purple-700',
};

const STEP_LABELS: Record<string, string> = {
  SERVICE_SELECTED:       'Picked a service',
  SLOT_SELECTED:          'Picked a slot',
  AWAITING_NAME:          'Mid-registration',
  AWAITING_EMAIL:         'Mid-registration',
  APPOINTMENT_CANCELLED:  'Clinic cancelled — re-book',
};

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

// ─── Log Call Dialog ────────────────────────────────────────────────────────

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

// ─── Convert Lead Dialog ────────────────────────────────────────────────────

function ConvertDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [notes, setNotes] = useState('');

  const serviceId = lead.selected_service_id ?? '';
  const { data: providers } = useProvidersListForForm();
  const { data: slots, isLoading: loadingSlots } = useSlotsList(serviceId || undefined, selectedDate || undefined);
  const { mutate: convert, isPending } = useConvertLead();

  const handleConvert = () => {
    if (!selectedSlotId) return;
    convert(
      {
        leadId: lead.id,
        slot_id: selectedSlotId,
        service_id: serviceId || undefined,
        provider_id: selectedProviderId || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => { toast.success('Lead converted — appointment created!'); onClose(); },
        onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to convert')),
      }
    );
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeader>
        <ModalTitle>Convert Lead — {lead.customer?.name ?? lead.phone}</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          {lead.service && (
            <div className="rounded-lg p-3 text-sm text-blue-700" style={{ background: 'color-mix(in srgb, var(--info-50) 92%, transparent)' }}>
              <span className="font-medium">Service:</span> {lead.service.name}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Provider (optional)</label>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="dashboard-surface-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Any available provider</option>
              {providers?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Date *"
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlotId(''); }}
            min={format(new Date(), 'yyyy-MM-dd')}
          />

          {selectedDate && serviceId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Time Slot *</label>
              <select
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                disabled={loadingSlots}
                className="dashboard-surface-input w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a slot</option>
                {slots?.map((s) => (
                  <option key={s.id} value={s.id}>{format(new Date(s.start_time), 'h:mm a')}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                {slots?.length ? `${slots.length} slot(s) available` : selectedDate ? 'No slots available' : ''}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="dashboard-surface-input w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={handleConvert} disabled={!selectedSlotId} isLoading={isPending}>
          Book Appointment
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ─── Lead Row ───────────────────────────────────────────────────────────────

function LeadRow({ 
  lead, 
  isSelected, 
  onToggleSelect,
}: { 
  lead: Lead; 
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
}) {
  const [showLog, setShowLog] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const isOpen = lead.status !== 'converted' && lead.status !== 'lost';
  
  // Priority badge color based on score
  const getPriorityColor = (score: number | null) => {
    if (score === null) return 'dashboard-surface-muted text-[color:var(--text-secondary)]';
    if (score >= 70) return 'bg-red-100 text-red-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };
  
  const getPriorityLabel = (score: number | null) => {
    if (score === null) return 'Normal';
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  return (
    <>
      <tr className="group transition-colors">
        <td className="px-4 py-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(lead.id)}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
        </td>
        <td className="px-4 py-4">
          <div>
            {lead.customer?.id ? (
              <Link href={`/customers/${lead.customer.id}`} className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline">
                {lead.customer.name ?? 'Unknown'}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-slate-900">{lead.customer?.name ?? 'Unknown'}</p>
            )}
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Phone size={11} /> {lead.phone}
            </p>
          </div>
        </td>
        <td className="hidden px-4 py-4 md:table-cell">
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${TYPE_COLORS[lead.customer_type]}`}>
              {TYPE_LABELS[lead.customer_type]}
            </span>
            {lead.priority_score !== null && (
              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getPriorityColor(lead.priority_score)}`}>
                {getPriorityLabel(lead.priority_score)} ({lead.priority_score})
              </span>
            )}
          </div>
        </td>
        <td className="hidden px-4 py-4 text-sm text-slate-700 lg:table-cell">
          {lead.service?.name ?? '—'}
        </td>
        <td className="hidden px-4 py-4 text-sm text-slate-500 lg:table-cell">
          {STEP_LABELS[lead.dropped_at_step] ?? lead.dropped_at_step}
        </td>
        <td className="hidden px-4 py-4 text-xs text-slate-500 whitespace-nowrap md:table-cell">
          {format(new Date(lead.dropped_at), 'MMM d, h:mm a')}
        </td>
        <td className="px-4 py-4">
          <Badge variant={STATUS_COLORS[lead.status]} size="sm" className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {STATUS_LABELS[lead.status]}
          </Badge>
        </td>
        <td className="hidden px-4 py-4 text-xs text-slate-500 xl:table-cell">
          {lead.assigned_to?.name ?? <span className="text-slate-300">Unassigned</span>}
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-1 justify-end">
            {isOpen && (
              <>
                <button
                  onClick={() => setShowLog(true)}
                  title="Log call"
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                >
                  <PhoneCall size={15} />
                </button>
                <button
                  onClick={() => setShowConvert(true)}
                  title="Convert to appointment"
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                >
                  <CheckCircle2 size={15} />
                </button>
              </>
            )}
            {lead.crm_notes && (
              <span title={lead.crm_notes} className="cursor-help p-1.5 text-slate-300 transition-colors hover:text-slate-500">
                💬
              </span>
            )}
          </div>
        </td>
      </tr>

      {showLog && <LogCallDialog lead={lead} onClose={() => setShowLog(false)} />}
      {showConvert && <ConvertDialog lead={lead} onClose={() => setShowConvert(false)} />}
    </>
  );
}

function LeadMobileCard({
  lead,
  isSelected,
  onToggleSelect,
}: {
  lead: Lead;
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
}) {
  const [showLog, setShowLog] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const isOpen = lead.status !== 'converted' && lead.status !== 'lost';

  const getPriorityColor = (score: number | null) => {
    if (score === null) return 'dashboard-surface-muted text-[color:var(--text-secondary)]';
    if (score >= 70) return 'bg-red-100 text-red-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  const getPriorityLabel = (score: number | null) => {
    if (score === null) return 'Normal';
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  return (
    <>
      <div className="dashboard-surface-soft rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(lead.id)}
              className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="min-w-0">
              {lead.customer?.id ? (
                <Link href={`/customers/${lead.customer.id}`} className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline">
                  {lead.customer.name ?? 'Unknown'}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-slate-900">{lead.customer?.name ?? 'Unknown'}</p>
              )}
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Phone size={11} /> {lead.phone}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_COLORS[lead.status]} size="sm" className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {STATUS_LABELS[lead.status]}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${TYPE_COLORS[lead.customer_type]}`}>
            {TYPE_LABELS[lead.customer_type]}
          </span>
          {lead.priority_score !== null && (
            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getPriorityColor(lead.priority_score)}`}>
              {getPriorityLabel(lead.priority_score)} ({lead.priority_score})
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-600">
          <p>Service: {lead.service?.name ?? '—'}</p>
          <p>Dropped at: {STEP_LABELS[lead.dropped_at_step] ?? lead.dropped_at_step}</p>
          <p>Date: {format(new Date(lead.dropped_at), 'MMM d, h:mm a')}</p>
          <p>Assigned: {lead.assigned_to?.name ?? 'Unassigned'}</p>
        </div>

        <div className="mt-3 flex items-center gap-1">
          {isOpen && (
            <>
              <button
                onClick={() => setShowLog(true)}
                title="Log call"
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <PhoneCall size={15} />
              </button>
              <button
                onClick={() => setShowConvert(true)}
                title="Convert to appointment"
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
              >
                <CheckCircle2 size={15} />
              </button>
            </>
          )}
          {lead.crm_notes ? (
            <span title={lead.crm_notes} className="cursor-help p-1.5 text-slate-300 transition-colors hover:text-slate-500">
              💬
            </span>
          ) : null}
        </div>
      </div>

      {showLog && <LogCallDialog lead={lead} onClose={() => setShowLog(false)} />}
      {showConvert && <ConvertDialog lead={lead} onClose={() => setShowConvert(false)} />}
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [tab, setTab] = useState<'open' | 'returning' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignTo, setBulkAssignTo] = useState('');

  const { data: providers } = useProvidersListForForm();

  // Build filters based on tab
  const filters = {
    search: search || undefined,
    customer_type: tab === 'returning' ? ('returning' as CustomerType) : undefined,
    // For "open" tab, filter by excluding converted/lost statuses via API
    // We'll use a custom approach - fetch all and filter client-side for now
    // TODO: Add status_not_in parameter to API
    page,
    page_size: 20,
  };

  const { data, isLoading } = useLeadsList(filters);
  const { mutate: bulkAssign } = useBulkAssignLeads();

  // Filter items based on tab
  const items = data?.items.filter((l) => {
    if (tab === 'open') {
      return l.status !== 'converted' && l.status !== 'lost' && l.customer_type !== 'returning';
    }
    if (tab === 'returning') {
      return l.customer_type === 'returning';
    }
    return true;
  }) ?? [];

  const openCount = data?.items.filter((l) => l.status === 'new_lead' && l.customer_type !== 'returning').length ?? 0;

  const handleBulkAssign = () => {
    if (!bulkAssignTo || selectedLeadIds.length === 0) return;
    
    bulkAssign(
      { lead_ids: selectedLeadIds, assigned_to_id: bulkAssignTo },
      {
        onSuccess: () => {
          toast.success(`Assigned ${selectedLeadIds.length} leads`);
          setSelectedLeadIds([]);
          setBulkAssignTo('');
        },
        onError: () => toast.error('Failed to assign leads'),
      }
    );
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === items.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(items.map(l => l.id));
    }
  };

  return (
    <div className="dashboard-page-shell space-y-5">
      {/* Header */}
      <div className="dashboard-page-header flex flex-col gap-4 rounded-[20px] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[24px] sm:px-6 sm:py-5">
        <div>
          <h2 className="flex items-center gap-3 text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">
            <UserX size={24} className="text-slate-400" />
            Leads
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Incomplete bookings — follow up to convert</p>
        </div>
        {openCount > 0 && (
          <Badge variant="error" size="md" className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">{openCount} new</Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto border-b px-2" style={{ borderColor: 'var(--border-medium)' }}>
        <div className="flex w-max gap-8">
        {([
          ['open',      'New Prospects'],
          ['returning', 'Returning Customers'],
          ['all',       'All Leads'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(1); }}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
              tab === key
                ? 'rounded-none border-b-2 border-primary-600 px-0 pb-4 text-primary-700 shadow-none'
                : 'rounded-none border-b-2 border-transparent px-0 pb-4 text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        </div>
      </div>

      {/* Filters */}
      <Card className="dashboard-page-panel rounded-[20px] p-4 sm:rounded-[24px] sm:p-5" variant="elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            placeholder="Search by phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={15} />}
            className="dashboard-surface-input h-12 w-full rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200 lg:w-64"
          />
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="rounded-2xl px-4" style={{ color: 'var(--text-secondary)' }}>
              Clear
            </Button>
          )}
          
          {/* Bulk Actions */}
          {selectedLeadIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3 lg:ml-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0" style={{ borderColor: 'var(--border-medium)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {selectedLeadIds.length} selected
              </span>
              <select
                value={bulkAssignTo}
                onChange={(e) => setBulkAssignTo(e.target.value)}
                className="dashboard-surface-input rounded-2xl border px-3 py-2 text-sm"
              >
                <option value="">Assign to...</option>
                {providers?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleBulkAssign}
                disabled={!bulkAssignTo}
                className="rounded-2xl px-4"
              >
                Assign
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedLeadIds([])}
                className="dashboard-action-outline rounded-2xl border px-4"
              >
                Clear
              </Button>
            </div>
          )}
          
          <div className="lg:ml-auto">
            <Badge variant="primary" size="md" className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">{data?.total ?? 0} results</Badge>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="dashboard-page-panel overflow-hidden rounded-[20px] p-0 sm:rounded-[28px]" variant="elevated">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="text" className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center">
            <div className="dashboard-empty-state-icon mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full">
              <UserX size={36} />
            </div>
            <p className="text-sm font-semibold text-slate-700">No leads in this queue</p>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'open'
                ? 'Leads appear here when WhatsApp users start booking but don\'t complete.'
                : 'No returning customers with incomplete flows.'}
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-3 p-3 md:hidden">
            {items.map((lead) => (
              <LeadMobileCard
                key={lead.id}
                lead={lead}
                isSelected={selectedLeadIds.includes(lead.id)}
                onToggleSelect={toggleSelectLead}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="dashboard-page-table-head border-b">
                <tr>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.length === items.length && items.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Customer</th>
                  <th className="hidden px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap md:table-cell">Type</th>
                  <th className="hidden px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap lg:table-cell">Service</th>
                  <th className="hidden px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap lg:table-cell">Dropped At</th>
                  <th className="hidden px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap md:table-cell">Date</th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Status</th>
                  <th className="hidden px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap xl:table-cell">Assigned To</th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {items.map((lead) => (
                  <LeadRow 
                    key={lead.id} 
                    lead={lead} 
                    isSelected={selectedLeadIds.includes(lead.id)}
                    onToggleSelect={toggleSelectLead}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <Card className="dashboard-page-panel rounded-[20px] p-4 sm:rounded-[24px]" variant="default">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-900">{page}</span> of <span className="font-semibold text-slate-900">{Math.ceil(data.total / data.page_size)}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="dashboard-action-outline rounded-2xl border px-4">Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage((p) => p + 1)} className="dashboard-action-outline rounded-2xl border px-4">Next</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
