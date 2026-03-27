import { Calendar, CheckCircle, XCircle, Clock, Users, Activity } from 'lucide-react';
import type { DashboardStats } from '@/types/dashboard';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard label="Today" value={stats.total_appointments_today} icon={<Calendar size={18} className="text-blue-600" />} color="bg-blue-50" />
      <StatCard label="This Week" value={stats.total_appointments_week} icon={<Activity size={18} className="text-purple-600" />} color="bg-purple-50" />
      <StatCard label="Confirmed" value={stats.total_confirmed} icon={<CheckCircle size={18} className="text-green-600" />} color="bg-green-50" />
      <StatCard label="Cancelled" value={stats.total_cancelled} icon={<XCircle size={18} className="text-red-600" />} color="bg-red-50" />
      <StatCard label="Completed" value={stats.total_completed} icon={<CheckCircle size={18} className="text-teal-600" />} color="bg-teal-50" />
      <StatCard label="Customers" value={stats.total_customers} icon={<Users size={18} className="text-orange-600" />} color="bg-orange-50" />
    </div>
  );
}
