'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, Ban, CheckCircle, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Appointment } from '@/types/appointment';
import StatusBadge from './StatusBadge';
import SourceBadge from './SourceBadge';
import CancelDialog from './CancelDialog';
import { useCompleteAppointment } from '@/hooks/useAppointments';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';

interface Props {
  appointments: Appointment[];
  isLoading: boolean;
}

export default function AppointmentsTable({ appointments, isLoading }: Props) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { mutate: complete } = useCompleteAppointment();

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-32 h-4" />
              <Skeleton variant="text" className="w-24 h-3" />
            </div>
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton variant="text" className="w-16 h-4" />
          </div>
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
          <Eye size={32} className="text-primary-400" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">No appointments found</h3>
        <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <>
    <Table className="min-w-full">
      <TableHeader className="border-b border-slate-100 bg-slate-50/80">
        <TableRow hoverable={false}>
          <TableHead className="w-12 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="sr-only">Avatar</span></TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Customer</TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Service</TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Date/Time</TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Provider</TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Source</TableHead>
          <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
          <TableHead align="right" className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-slate-100">
        {appointments.map((appt) => (
          <TableRow key={appt.id} className="group hover:bg-slate-50/70">
            <TableCell className="py-4">
              <Avatar
                name={appt.customer?.name ?? appt.user_phone}
                size="sm"
              />
            </TableCell>
            <TableCell className="py-4">
              <div>
                <p className="font-semibold text-slate-900">
                  {appt.customer?.name ?? 'Walk-in Customer'}
                </p>
                <p className="text-xs text-slate-500">{appt.user_phone}</p>
              </div>
            </TableCell>
            <TableCell className="py-4">
              <div>
                <p className="text-sm text-slate-900">{appt.service?.name ?? '—'}</p>
                {appt.service?.duration_minutes && (
                  <p className="text-xs text-slate-500">{appt.service.duration_minutes} min</p>
                )}
              </div>
            </TableCell>
            <TableCell className="py-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                <span className="text-sm text-slate-700 whitespace-nowrap">
                  {appt.slot ? format(new Date(appt.slot.start_time), 'MMM d, h:mm a') : '—'}
                </span>
              </div>
            </TableCell>
            <TableCell className="py-4">
              <span className="text-sm text-slate-700">{appt.provider?.name ?? '—'}</span>
            </TableCell>
            <TableCell className="py-4">
              <SourceBadge source={appt.source} size="sm" />
            </TableCell>
            <TableCell className="py-4">
              <StatusBadge status={appt.status} size="sm" />
            </TableCell>
            <TableCell align="right" className="py-4">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/appointments/${appt.id}`}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                  title="View details"
                >
                  <Eye size={16} />
                </Link>
                {appt.status === 'confirmed' && (
                  <>
                    {appt.slot && new Date(appt.slot.start_time) <= new Date() && (
                      <IconButton
                        variant="default"
                        size="sm"
                        onClick={() => complete(appt.id, {
                          onSuccess: () => toast.success('Marked as completed'),
                        })}
                        tooltip="Mark complete"
                        className="rounded-xl text-slate-400 hover:bg-primary-50 hover:text-primary-600"
                      >
                        <CheckCircle size={16} />
                      </IconButton>
                    )}
                    <IconButton
                      variant="default"
                      size="sm"
                      onClick={() => setCancellingId(appt.id)}
                      tooltip="Cancel"
                      className="rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Ban size={16} />
                    </IconButton>
                  </>
                )}
                <IconButton variant="default" size="sm" className="rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <MoreVertical size={16} />
                </IconButton>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    {cancellingId && (
      <CancelDialog
        appointmentId={cancellingId}
        onClose={() => setCancellingId(null)}
      />
    )}
    </>
  );
}
