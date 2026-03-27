import { MessageCircle, User, TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ChannelStats } from '@/types/dashboard';

interface ChannelCardProps {
  channel: string;
  stats: ChannelStats;
  isBest?: boolean;
}

function ChannelCard({ channel, stats, isBest }: ChannelCardProps) {
  const isWhatsapp = channel === 'whatsapp';
  const IconComponent = isWhatsapp ? MessageCircle : User;
  const channelColor = isWhatsapp ? 'text-green-600' : 'text-blue-600';
  const bgColor = isWhatsapp ? 'bg-green-50' : 'bg-blue-50';
  const borderColor = isBest ? 'border-2 border-orange-500' : 'border border-gray-200';

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
              <span className="text-xs text-orange-600 font-medium">Best Performer</span>
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
    </div>
  );
}

export default function ChannelComparison({ channels }: { channels: ChannelStats[] }) {
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Channel Performance</h2>
        <p className="text-xs text-gray-500 mt-0.5">Compare WhatsApp vs Admin Dashboard (Last 7 Days)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.channel}
            channel={channel.channel}
            stats={channel}
            isBest={channel.channel === bestChannel.channel && channel.total_appointments > 0}
          />
        ))}
      </div>
    </div>
  );
}
