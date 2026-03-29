export type LeadStatus = 'new_lead' | 'contacted' | 'follow_up' | 'converted' | 'lost';
export type CustomerType = 'prospect' | 'returning' | 're_engaged';
export type LeadActivityType = 
  | 'status_changed'
  | 'call_logged'
  | 'assigned'
  | 'unassigned'
  | 'converted'
  | 'note_added'
  | 'created'
  | 'follow_up_scheduled'
  | 'sla_breached'
  | 'reassigned';

export interface LeadServiceInfo {
  id: string;
  name: string;
}

export interface LeadCustomerInfo {
  id: string;
  name: string | null;
  phone: string;
}

export interface LeadAssignedTo {
  id: string;
  name: string;
}

export interface Lead {
  id: string;
  phone: string;
  customer_id: string | null;
  customer: LeadCustomerInfo | null;
  dropped_at_step: string;
  selected_service_id: string | null;
  service: LeadServiceInfo | null;
  selected_slot_id: string | null;
  session_started_at: string | null;
  dropped_at: string;
  status: LeadStatus;
  customer_type: CustomerType;
  assigned_to_id: string | null;
  assigned_to: LeadAssignedTo | null;
  crm_notes: string | null;
  converted_appointment_id: string | null;
  
  // SLA tracking
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  follow_up_at: string | null;
  
  // Lead scoring
  priority_score: number | null;
  
  created_at: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  page_size: number;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: LeadActivityType;
  previous_value: string | null;
  new_value: string | null;
  notes: string | null;
  performed_by_id: string | null;
  performed_by: LeadAssignedTo | null;
  performed_at: string;
  metadata_json: string | null;
}

export interface LeadActivityListResponse {
  items: LeadActivity[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActivityEvent {
  type: 'appointment_event' | 'profile_change' | 'message_sent';
  event: string;
  detail: string | null;
  source: string | null;
  changed_by_name: string | null;
  changed_by_email: string | null;
  appointment_id: string | null;
  created_at: string;
}
