import { format } from 'date-fns';
import type { AppointmentStatusHistory } from '@/types/appointment';
import { clsx } from 'clsx';

const statusColor: Record<string, string> = {
  confirmed: 'bg-blue-500',
  cancelled: 'bg-red-500',
  completed: 'bg-green-500',
  no_show: 'bg-gray-400',
  pending: 'bg-amber-500',
};

export default function StatusTimeline({ history }: { history: AppointmentStatusHistory[] }) {
  if (!history.length) return <p className="text-sm text-gray-400">No history</p>;

  return (
    <div className="relative pl-5 space-y-4">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
      {history.map((entry) => (
        <div key={entry.id} className="relative flex items-start gap-3">
          <div className={clsx('w-3 h-3 rounded-full shrink-0 -ml-1.5 mt-0.5', statusColor[entry.new_status] ?? 'bg-gray-300')} />
          <div>
            <p className="text-sm font-medium text-gray-800 capitalize">
              {entry.old_status ? `${entry.old_status} → ` : 'Created as '}
              {entry.new_status}
            </p>
            {entry.reason && <p className="text-xs text-gray-500 mt-0.5">{entry.reason}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
