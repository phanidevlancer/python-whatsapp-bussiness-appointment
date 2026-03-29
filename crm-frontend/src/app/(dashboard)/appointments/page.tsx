'use client';

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useAppointmentsList } from '@/hooks/useAppointments';
import AppointmentsTable from '@/components/appointments/AppointmentsTable';
import CreateAppointmentDialog from '@/components/appointments/CreateAppointmentDialog';
import type { AppointmentFilters, AppointmentStatus } from '@/types/appointment';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { FluidDropdown } from '@/components/ui/fluid-dropdown';
import { DropdownRangeDatePicker } from '@/components/ui/dropdown-range-date-picker';

export default function AppointmentsPage() {
  const [filters, setFilters] = useState<AppointmentFilters>({ page: 1, page_size: 20 });
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading } = useAppointmentsList({ ...filters, search: search || undefined });

  const setFilter = (key: keyof AppointmentFilters, value: string | AppointmentStatus | undefined) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }));

  const hasActiveFilters = search || filters.status || filters.date_from || filters.date_to;

  return (
    <div className="dashboard-page-shell space-y-5">
      {/* Page Header */}
      <div className="dashboard-page-header flex items-center justify-between rounded-[24px] px-6 py-5">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Appointments</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage and track all clinic appointments</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
          onClick={() => setShowCreateDialog(true)}
          className="h-11 rounded-2xl border border-primary-500/20 px-5 font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)]"
        >
          New Appointment
        </Button>
      </div>

      {/* Filters Card */}
      <Card
        className="dashboard-page-panel relative z-20 rounded-[24px] p-5"
        variant="elevated"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={16} />}
              className="dashboard-surface-input h-12 w-full rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200"
            />
          </div>

          {/* Status Filter */}
          <FluidDropdown
            value={filters.status}
            onChange={(value) => setFilter('status', value)}
            className="dashboard-surface-input h-12 w-full rounded-2xl border px-1 text-sm font-medium shadow-none md:w-44"
          />

          {/* Date Range */}
          <DropdownRangeDatePicker
            value={{ from: filters.date_from, to: filters.date_to }}
            onApply={({ from, to }) =>
              setFilters((current) => ({
                ...current,
                date_from: from,
                date_to: to,
                page: 1,
              }))
            }
            className="dashboard-surface-input h-12 w-full justify-start rounded-2xl border px-4 text-left text-sm font-medium shadow-none md:w-[280px]"
          />

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilters({ page: 1, page_size: 20 }); setSearch(''); }}
              className="h-10 rounded-2xl px-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              Clear filters
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="primary" size="md" className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">
              {data?.total ?? 0} results
            </Badge>
          </div>
        </div>
      </Card>

      {/* Table Card */}
      <Card
        className="dashboard-page-panel relative z-0 overflow-hidden rounded-[28px] p-0"
        variant="elevated"
      >
        <AppointmentsTable appointments={data?.items ?? []} isLoading={isLoading} />
      </Card>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <Card className="dashboard-page-panel rounded-[24px] p-4" variant="default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-900">{((filters.page ?? 1) - 1) * (filters.page_size ?? 20) + 1}</span> to{' '}
                <span className="font-semibold text-slate-900">{Math.min((filters.page ?? 1) * (filters.page_size ?? 20), data.total)}</span> of{' '}
                <span className="font-semibold text-slate-900">{data.total}</span> results
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                className="dashboard-action-outline rounded-2xl border px-4"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) >= Math.ceil(data.total / data.page_size)}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                className="dashboard-action-outline rounded-2xl border px-4"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
