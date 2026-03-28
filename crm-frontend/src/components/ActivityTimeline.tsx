'use client';

import { format } from 'date-fns';
import { 
  PhoneCall, 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  MessageSquare, 
  Clock,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { LeadActivity, LeadActivityType } from '@/types/lead';

interface ActivityTimelineProps {
  activities: LeadActivity[];
}

const activityIcons: Record<LeadActivityType, React.ReactNode> = {
  status_changed: <TrendingUp size={16} />,
  call_logged: <PhoneCall size={16} />,
  assigned: <UserCheck size={16} />,
  unassigned: <UserX size={16} />,
  converted: <CheckCircle2 size={16} />,
  note_added: <MessageSquare size={16} />,
  created: <PlusCircle size={16} />,
  follow_up_scheduled: <Clock size={16} />,
  sla_breached: <AlertTriangle size={16} />,
  reassigned: <RefreshCw size={16} />,
};

const activityColors: Record<LeadActivityType, string> = {
  status_changed: 'bg-blue-100 text-blue-600',
  call_logged: 'bg-green-100 text-green-600',
  assigned: 'bg-purple-100 text-purple-600',
  unassigned: 'bg-slate-100 text-slate-600',
  converted: 'bg-teal-100 text-teal-600',
  note_added: 'bg-yellow-100 text-yellow-600',
  created: 'bg-indigo-100 text-indigo-600',
  follow_up_scheduled: 'bg-orange-100 text-orange-600',
  sla_breached: 'bg-red-100 text-red-600',
  reassigned: 'bg-pink-100 text-pink-600',
};

const activityLabels: Record<LeadActivityType, string> = {
  status_changed: 'Status Changed',
  call_logged: 'Call Logged',
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  converted: 'Converted',
  note_added: 'Note Added',
  created: 'Lead Created',
  follow_up_scheduled: 'Follow-up Scheduled',
  sla_breached: 'SLA Breached',
  reassigned: 'Reassigned',
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${activityColors[activity.activity_type]}`}
            >
              {activityIcons[activity.activity_type]}
            </div>
            {index < activities.length - 1 && (
              <div className="w-px h-full bg-slate-200 my-1" />
            )}
          </div>

          {/* Activity content */}
          <div className="flex-1 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {activityLabels[activity.activity_type]}
                </span>
                {activity.previous_value && activity.new_value && (
                  <span className="text-xs text-slate-500">
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {activity.previous_value}
                    </span>
                    {' → '}
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {activity.new_value}
                    </span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {format(new Date(activity.performed_at), 'MMM d, h:mm a')}
              </span>
            </div>

            {activity.notes && (
              <p className="text-sm text-slate-600 mt-1 bg-slate-50 rounded-md p-2">
                {activity.notes}
              </p>
            )}

            {activity.performed_by && (
              <div className="mt-1 flex items-center gap-1">
                <UserCheck size={12} className="text-slate-400" />
                <span className="text-xs text-slate-500">
                  by {activity.performed_by.name}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
