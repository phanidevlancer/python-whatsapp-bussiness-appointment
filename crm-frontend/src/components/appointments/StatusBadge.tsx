import { clsx } from 'clsx';
import type { AppointmentStatus } from '@/types/appointment';
import { Badge } from '@/components/ui/Badge';

const config: Record<AppointmentStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'primary' | 'default' | 'info' | 'teal' }> = {
  confirmed:  { label: 'Confirmed',  variant: 'success' },
  pending:    { label: 'Pending',    variant: 'warning' },
  cancelled:  { label: 'Cancelled',  variant: 'error' },
  completed:  { label: 'Completed',  variant: 'teal' },
  no_show:    { label: 'No Show',    variant: 'default' },
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  confirmed: '#10b981',
  pending:   '#f59e0b',
  cancelled: '#ef4444',
  completed: '#3b82f6',
  no_show:   '#6b7280',
};

interface StatusBadgeProps {
  status: AppointmentStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export default function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const { label, variant } = config[status] ?? { label: status, variant: 'default' };
  return (
    <Badge variant={variant} size={size} dot={showDot}>
      {label}
    </Badge>
  );
}
