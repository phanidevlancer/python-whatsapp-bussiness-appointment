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
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Eye size={32} className="text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 mb-1">No appointments found</h3>
        <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow hoverable={false}>
          <TableHead className="w-12"><span className="sr-only">Avatar</span></TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Date/Time</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Status</TableHead>
          <TableHead align="right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((appt) => (
          <TableRow key={appt.id}>
            <TableCell>
              <Avatar
                name={appt.customer?.name ?? appt.user_phone}
                size="sm"
              />
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium text-slate-900">
                  {appt.customer?.name ?? 'Walk-in Customer'}
                </p>
                <p className="text-xs text-slate-500">{appt.user_phone}</p>
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p className="text-sm text-slate-900">{appt.service?.name ?? '—'}</p>
                {appt.service?.duration_minutes && (
                  <p className="text-xs text-slate-500">{appt.service.duration_minutes} min</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-sm text-slate-700 whitespace-nowrap">
                  {appt.slot ? format(new Date(appt.slot.start_time), 'MMM d, h:mm a') : '—'}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-slate-700">{appt.provider?.name ?? '—'}</span>
            </TableCell>
            <TableCell>
              <SourceBadge source={appt.source} size="sm" />
            </TableCell>
            <TableCell>
              <StatusBadge status={appt.status} size="sm" />
            </TableCell>
            <TableCell align="right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/appointments/${appt.id}`}
                  className="text-slate-400 hover:text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-colors"
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
                      >
                        <CheckCircle size={16} />
                      </IconButton>
                    )}
                    <IconButton
                      variant="default"
                      size="sm"
                      onClick={() => setCancellingId(appt.id)}
                      tooltip="Cancel"
                    >
                      <Ban size={16} />
                    </IconButton>
                  </>
                )}
                <IconButton variant="default" size="sm">
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
