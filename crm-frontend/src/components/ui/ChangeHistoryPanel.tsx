'use client';

import { format } from 'date-fns';
import { History } from 'lucide-react';

export interface ChangeHistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  changed_by_email: string | null;
  changed_by_id: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  notes: 'Notes',
  description: 'Description',
  duration_minutes: 'Duration (min)',
  is_active: 'Status',
};

interface ChangeHistoryPanelProps {
  history: ChangeHistoryEntry[];
  isLoading?: boolean;
}

function formatActorLabel(name: string | null, email: string | null) {
  if (name && email) return `${name} <${email}>`;
  if (email) return email;
  if (name) return name;
  return 'Unknown';
}

export function ChangeHistoryPanel({ history, isLoading }: ChangeHistoryPanelProps) {
  return (
    <div className="dashboard-page-panel rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} style={{ color: 'var(--text-tertiary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Change History</h3>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>Last {history.length} changes</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg animate-pulse dashboard-surface-muted" />
          ))}
        </div>
      ) : !history.length ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No changes recorded yet</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="dashboard-surface-muted flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {FIELD_LABELS[entry.field_name] ?? entry.field_name}
                </span>{' '}
                changed from{' '}
                <span className="line-through" style={{ color: 'var(--text-secondary)' }}>{entry.old_value || '(empty)'}</span>{' '}
                to{' '}
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{entry.new_value || '(empty)'}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatActorLabel(entry.changed_by_name, entry.changed_by_email)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
