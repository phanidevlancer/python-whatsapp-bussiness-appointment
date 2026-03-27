import { clsx } from 'clsx';
import type { AppointmentStatus } from '@/types/appointment';

const config: Record<AppointmentStatus, { label: string; className: string }> = {
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-100 text-blue-700' },
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-100 text-red-700' },
  completed:  { label: 'Completed',  className: 'bg-green-100 text-green-700' },
  no_show:    { label: 'No Show',    className: 'bg-gray-100 text-gray-600' },
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  confirmed: '#3b82f6',
  pending:   '#f59e0b',
  cancelled: '#ef4444',
  completed: '#10b981',
  no_show:   '#6b7280',
};

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {label}
    </span>
  );
}
