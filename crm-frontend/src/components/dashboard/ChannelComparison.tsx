import { MessageCircle, User, TrendingUp, CheckCircle, XCircle, AlertCircle, CalendarClock } from 'lucide-react';
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
  const IconComponent = isWhatsapp ? MessageCircle : User;
  const channelColor = isWhatsapp ? 'text-green-600' : 'text-blue-600';
  const bgColor = isWhatsapp ? 'bg-green-50' : 'bg-blue-50';
  const borderColor = isBest ? 'border-2 border-orange-500' : 'border border-gray-200';

  // Calculate cancellation rate for this channel
  const cancellationRate = stats.total_appointments > 0
    ? ((stats.cancelled / stats.total_appointments) * 100).toFixed(1)
    : '0';
  const highCancellationRate = parseFloat(cancellationRate) > 15; // Flag if > 15% cancellation rate

  return (
    <div className={`bg-white rounded-lg border ${borderColor} p-4 hover:shadow-md transition-shadow duration-200 ${isBest ? 'ring-2 ring-orange-500 ring-opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <IconComponent size={20} className={channelColor} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 capitalize">
              {channel.replace('_', ' ')}
            </h3>
            {isBest && (
              <span className="text-xs text-orange-600 font-medium">More User Engagement</span>
            )}
            {highCancellationRate && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs text-red-600 font-medium">⚠️ High Cancellations</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{stats.total_appointments}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-xs text-gray-600">Confirmed</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats.confirmed}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <XCircle size={14} className="text-red-600" />
            <span className="text-xs text-gray-600">Cancelled</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats.cancelled}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-teal-600" />
            <span className="text-xs text-gray-600">Completed</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats.completed}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} className="text-orange-600" />
            <span className="text-xs text-gray-600">No Show</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{stats.no_show}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-purple-600" />
            <span className="text-xs text-gray-600">Conversion Rate</span>
          </div>
          <span className="text-sm font-bold text-purple-600">{stats.conversion_rate}%</span>
        </div>
      </div>

      {cancellationStats && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <XCircle size={14} className={highCancellationRate ? 'text-red-600' : 'text-red-500'} />
              <span className={`text-xs ${highCancellationRate ? 'font-medium text-red-700' : 'text-gray-600'}`}>
                Cancellations
              </span>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${highCancellationRate ? 'text-red-600' : 'text-red-500'}`}>
                {cancellationStats.cancellations}
              </span>
              {cancellationStats.percentage > 0 && (
                <p className="text-xs text-gray-500">{cancellationStats.percentage}% of total</p>
              )}
              {highCancellationRate && (
                <p className="text-xs text-red-600 font-medium">{cancellationRate}% rate</p>
              )}
            </div>
          </div>
        </div>
      )}

      {rescheduleStats && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarClock size={14} className="text-indigo-600" />
              <span className="text-xs text-gray-600">Reschedules</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-indigo-600">{rescheduleStats.reschedules}</span>
              {rescheduleStats.percentage > 0 && (
                <p className="text-xs text-gray-500">{rescheduleStats.percentage}% of total</p>
              )}
            </div>
          </div>
        </div>
      )}
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Channel Performance</h2>
        <p className="text-sm text-gray-500 text-center py-8">No channel data available</p>
      </div>
    );
  }

  // Find the best performing channel (highest total appointments)
  const bestChannel = channels.reduce((max, channel) =>
    channel.total_appointments > max.total_appointments ? channel : max
  , channels[0]);

  // Build a map of cancellation stats by channel
  const cancellationMap = new Map<string, ChannelCancellationStats>();
  if (cancellations) {
    cancellations.forEach((c) => cancellationMap.set(c.channel, c));
  }

  // Build a map of reschedule stats by channel
  const rescheduleMap = new Map<string, ChannelRescheduleStats>();
  if (reschedules) {
    reschedules.forEach((r) => rescheduleMap.set(r.channel, r));
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Channel Performance</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Compare WhatsApp vs Admin Dashboard (Last 7 Days)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.channel}
            channel={channel.channel}
            stats={channel}
            cancellationStats={cancellationMap.get(channel.channel)}
            rescheduleStats={rescheduleMap.get(channel.channel)}
            isBest={channel.channel === bestChannel.channel && channel.total_appointments > 0}
          />
        ))}
      </div>
    </div>
  );
}
