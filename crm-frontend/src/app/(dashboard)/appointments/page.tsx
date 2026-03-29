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
    <div className="space-y-5 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(240,249,255,0.62))] p-1">
      {/* Page Header */}
      <div className="flex items-center justify-between rounded-[24px] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_16px_40px_rgba(13,148,136,0.08)] backdrop-blur-sm">
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
        className="relative z-20 rounded-[24px] border-white/80 bg-white/85 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm"
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
              className="h-12 w-full rounded-2xl border-0 bg-slate-100/80 text-slate-700 shadow-none ring-1 ring-transparent placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-primary-200"
            />
          </div>

          {/* Status Filter */}
          <FluidDropdown
            value={filters.status}
            onChange={(value) => setFilter('status', value)}
            className="h-12 w-full rounded-2xl border-0 bg-slate-100/80 px-1 text-sm font-medium text-slate-700 shadow-none md:w-44"
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
            className="h-12 w-full justify-start rounded-2xl border-0 bg-slate-100/80 px-4 text-left text-sm font-medium text-slate-700 shadow-none md:w-[280px]"
          />

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilters({ page: 1, page_size: 20 }); setSearch(''); }}
              className="h-10 rounded-2xl px-4 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
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
        className="relative z-0 overflow-hidden rounded-[28px] border-white/80 bg-white/90 p-0 shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
        variant="elevated"
      >
        <AppointmentsTable appointments={data?.items ?? []} isLoading={isLoading} />
      </Card>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <Card className="rounded-[24px] border-white/70 bg-white/75 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]" variant="default">
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
                className="rounded-2xl border-slate-200 bg-white px-4 text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) >= Math.ceil(data.total / data.page_size)}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                className="rounded-2xl border-slate-200 bg-white px-4 text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
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
