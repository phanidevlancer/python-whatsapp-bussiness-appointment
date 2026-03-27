export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type AppointmentSource = 'whatsapp' | 'admin_dashboard';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  is_active: boolean;
}

export interface TimeSlot {
  id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  booked_at: string | null;
}

export interface Provider {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  user_phone: string;
  service_id: string;
  slot_id: string;
  status: AppointmentStatus;
  provider_id: string | null;
  customer_id: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  rescheduled_from_slot_id: string | null;
  source: AppointmentSource;
  booked_at: string;
  created_at: string;
  service: Service | null;
  slot: TimeSlot | null;
  provider: Provider | null;
  customer: Customer | null;
}

export interface AppointmentStatusHistory {
  id: string;
  appointment_id: string;
  old_status: string | null;
  new_status: string;
  changed_by_id: string | null;
  reason: string | null;
  reschedule_source: string | null;
  created_at: string;
}

export interface PaginatedAppointmentResponse {
  items: Appointment[];
  total: number;
  page: number;
  page_size: number;
}

export interface AppointmentFilters {
  date_from?: string;
  date_to?: string;
  status?: AppointmentStatus;
  service_id?: string;
  provider_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}
