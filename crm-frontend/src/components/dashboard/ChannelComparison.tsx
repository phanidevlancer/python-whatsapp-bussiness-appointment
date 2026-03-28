import { MessageCircle, UserRound, TrendingUp, CircleCheck, CircleX, EyeOff, Ban, CalendarMinus } from 'lucide-react';
import type { ChannelStats, ChannelCancellationStats, ChannelRescheduleStats } from '@/types/dashboard';

interface ChannelCardProps {
  channel: string;
  stats: ChannelStats;
  cancellationStats?: ChannelCancellationStats;
  rescheduleStats?: ChannelRescheduleStats;
  isBest?: boolean;
}

function ChannelCard({ channel, stats, cancellationStats, rescheduleStats, isBest }: ChannelCardProps) {
  const isWhatsapp = channel === 'whatsapp';
  const IconComponent = isWhatsapp ? MessageCircle : UserRound;
  const channelColor = isWhatsapp ? 'text-green-500' : 'text-indigo-500';
  const bgColor = isWhatsapp ? 'bg-green-100' : 'bg-indigo-50';
  const channelLabel = isWhatsapp ? 'WhatsApp' : 'Admin Dashboard';
  const dimRow = !isBest ? 'opacity-50' : '';

  return (
    <div className="glass-card rounded-2xl p-5">
      {/* Card Header */}
      <div className="flex justify-between items-start border-b border-slate-200/50 pb-3 mb-3">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded ${bgColor} flex items-center justify-center mr-3`}>
            <IconComponent size={18} className={channelColor} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">{channelLabel}</h4>
            {isBest && (
              <p className="text-xs text-blue-500 font-medium">More User Engagement</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-800 leading-none">{stats.total_appointments}</p>
          <p className="text-[10px] text-slate-500 uppercase">Total</p>
        </div>
      </div>

      {/* Stats List */}
      <div className="space-y-2.5 mb-4">
        <div className={`flex justify-between items-center text-sm ${dimRow}`}>
          <div className="flex items-center text-slate-600">
            <CircleCheck size={14} className="text-green-500 w-4 mr-2" /> Confirmed
          </div>
          <span className="font-semibold text-slate-800">{stats.confirmed}</span>
        </div>
        <div className={`flex justify-between items-center text-sm ${dimRow}`}>
          <div className="flex items-center text-slate-600">
            <CircleX size={14} className="text-red-500 w-4 mr-2" /> Cancelled
          </div>
          <span className="font-semibold text-slate-800">{stats.cancelled}</span>
        </div>
        <div className={`flex justify-between items-center text-sm ${dimRow}`}>
          <div className="flex items-center text-slate-600">
            <CircleCheck size={14} className="text-teal-500 w-4 mr-2" /> Completed
          </div>
          <span className="font-semibold text-slate-800">{stats.completed}</span>
        </div>
        <div className={`flex justify-between items-center text-sm ${dimRow}`}>
          <div className="flex items-center text-slate-600">
            <EyeOff size={14} className="text-orange-400 w-4 mr-2" /> No Show
          </div>
          <span className="font-semibold text-slate-800">{stats.no_show}</span>
        </div>
      </div>

      {/* Conversion Rate Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className={`flex items-center text-slate-600 ${dimRow}`}>
            <TrendingUp size={12} className="text-blue-500 mr-1.5" /> Conversion Rate
          </span>
          <span className={`text-blue-500 font-semibold ${dimRow}`}>{stats.conversion_rate}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-blue-400 to-teal-400 h-1.5 rounded-full"
            style={{ width: `${Math.min(stats.conversion_rate, 100)}%` }}
          />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-2 gap-4 border-t border-slate-200/50 pt-3">
        <div className={`flex justify-between items-center text-sm ${dimRow}`}>
          <div className="flex items-center text-slate-600 text-xs">
            <Ban size={12} className="text-red-400 mr-1.5" /> Cancellations
          </div>
          <span className="font-semibold text-blue-500 text-xs">
            {cancellationStats?.cancellations ?? 0}
          </span>
        </div>
        <div className={`flex justify-between items-center text-sm ${dimRow}`}>
          <div className="flex items-center text-slate-600 text-xs">
            <CalendarMinus size={12} className="text-indigo-400 mr-1.5" /> Reschedules
          </div>
          <span className="font-semibold text-blue-500 text-xs">
            {rescheduleStats?.reschedules ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ChannelComparison({
  channels,
  cancellations,
  reschedules,
}: {
  channels: ChannelStats[];
  cancellations?: ChannelCancellationStats[];
  reschedules?: ChannelRescheduleStats[];
}) {
  if (!channels || channels.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Channel Performance</h2>
        <p className="text-sm text-slate-500 text-center py-8">No channel data available</p>
      </div>
    );
  }

  const bestChannel = channels.reduce((max, ch) =>
    ch.total_appointments > max.total_appointments ? ch : max
  , channels[0]);

  const cancellationMap = new Map<string, ChannelCancellationStats>();
  if (cancellations) cancellations.forEach((c) => cancellationMap.set(c.channel, c));

  const rescheduleMap = new Map<string, ChannelRescheduleStats>();
  if (reschedules) reschedules.forEach((r) => rescheduleMap.set(r.channel, r));

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">Channel Performance</h3>
      <p className="text-xs text-slate-500 mb-4">Compare WhatsApp to Admin Dashboard (Last 7 Days)</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {channels.map((ch) => (
          <ChannelCard
            key={ch.channel}
            channel={ch.channel}
            stats={ch}
            cancellationStats={cancellationMap.get(ch.channel)}
            rescheduleStats={rescheduleMap.get(ch.channel)}
            isBest={ch.channel === bestChannel.channel && ch.total_appointments > 0}
          />
        ))}
      </div>
    </div>
  );
}
