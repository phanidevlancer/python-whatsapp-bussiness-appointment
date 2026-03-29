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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Change History</h3>
        <span className="ml-auto text-xs text-gray-400">Last {history.length} changes</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !history.length ? (
        <p className="text-sm text-gray-400 text-center py-4">No changes recorded yet</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-gray-50 text-sm"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-700">
                  {FIELD_LABELS[entry.field_name] ?? entry.field_name}
                </span>{' '}
                changed from{' '}
                <span className="text-gray-500 line-through">{entry.old_value || '(empty)'}</span>{' '}
                to{' '}
                <span className="font-medium text-gray-900">{entry.new_value || '(empty)'}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">
                  {formatActorLabel(entry.changed_by_name, entry.changed_by_email)}
                </p>
                <p className="text-xs text-gray-400">
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
