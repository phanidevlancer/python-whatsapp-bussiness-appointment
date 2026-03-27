export type MessageLogStatus = 'pending' | 'sent' | 'failed';

export interface NotificationLog {
  id: string;
  appointment_id: string | null;
  customer_phone: string;
  message_type: string;
  status: MessageLogStatus;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface NotificationLogListResponse {
  items: NotificationLog[];
  total: number;
  page: number;
  page_size: number;
}
