export type CampaignStatus = 'active' | 'paused' | 'expired';
export type CampaignRunStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed';
export type CampaignDiscountType = 'none' | 'percent' | 'flat';
export type CampaignAudienceType =
  | 'all_customers'
  | 'customers_with_previous_bookings'
  | 'customers_inactive_for_days'
  | 'uploaded_phone_list';

export interface CampaignAudienceFilters {
  inactivity_days?: number;
  inactive_days?: number;
  phones?: string[];
  [key: string]: unknown;
}

export interface CampaignPerformanceSourceComparison {
  source: string;
  targeted: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  skipped?: number;
  bookings: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  no_show: number;
  total_service_value: number | string;
  total_final_value: number | string;
}

export interface CampaignMetrics {
  targeted: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  skipped?: number;
  bookings: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  no_show: number;
  total_service_value: number | string;
  total_final_value: number | string;
}

export interface Campaign extends CampaignMetrics {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  audience_type: CampaignAudienceType;
  audience_filters: CampaignAudienceFilters;
  run_status: CampaignRunStatus | null;
  message_body: string | null;
  message_footer: string | null;
  button_label: string | null;
  image_path: string | null;
  image_media_id: string | null;
  batch_size: number | null;
  batch_delay_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  booking_button_id: string | null;
  allowed_service_ids: string[];
  allowed_weekdays: number[];
  valid_from: string | null;
  valid_to: string | null;
  per_user_booking_limit: number | null;
  discount_type: CampaignDiscountType;
  discount_value: number | string | null;
  source_comparison: CampaignPerformanceSourceComparison[];
  created_at: string;
  updated_at: string;
}

export interface CampaignPerformance extends CampaignMetrics {
  campaign_id: string | null;
  campaign_code: string;
  campaign_name: string;
  run_status: CampaignRunStatus | null;
  source_comparison: CampaignPerformanceSourceComparison[];
}

export interface CampaignImageUploadResponse {
  relative_path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
}

export interface CampaignMutationPayload {
  code: string;
  name: string;
  description: string | null;
  booking_button_id: string | null;
  allowed_service_ids: string[];
  allowed_weekdays: number[];
  valid_from: string | null;
  valid_to: string | null;
  per_user_booking_limit: number | null;
  discount_type: CampaignDiscountType;
  discount_value: number | null;
  audience_type: CampaignAudienceType;
  audience_filters: CampaignAudienceFilters;
  message_body: string;
  message_footer: string | null;
  button_label: string;
  image_path: string | null;
  batch_size: number;
  batch_delay_seconds: number;
}

export interface CampaignBuilderFormValues {
  name: string;
  code: string;
  description: string;
  booking_button_id: string;
  allowed_service_ids: string[];
  allowed_weekdays: number[];
  valid_from: string;
  valid_to: string;
  per_user_booking_limit: string;
  discount_type: CampaignDiscountType;
  discount_value: string;
  audience_type: CampaignAudienceType;
  inactivity_days: string;
  uploaded_phones_text: string;
  message_body: string;
  message_footer: string;
  button_label: string;
  image_path: string | null;
  batch_size: string;
  batch_delay_seconds: string;
}

export interface CampaignMessageDetail {
  body: string | null;
  footer: string | null;
  button_label: string | null;
  booking_button_id: string | null;
  image_path: string | null;
  image_media_id: string | null;
}

export interface CampaignBatchDetail {
  size: number | null;
  delay_seconds: number | null;
}

export interface CampaignLifecycleDetail {
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  last_error: string | null;
}

export interface CampaignBookingMetrics {
  bookings: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  no_show: number;
}

export interface CampaignSendLog {
  id: string;
  campaign_id: string;
  recipient_id: string;
  provider_message_id: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  customer_id: string | null;
  phone: string;
  customer_name: string | null;
  delivery_status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  failed_at: string | null;
  skipped_at: string | null;
  last_error: string | null;
  booking_metrics: CampaignBookingMetrics;
  send_logs: CampaignSendLog[];
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipientsResponse {
  campaign_id: string;
  run_status: CampaignRunStatus | null;
  metrics: CampaignMetrics;
  items: CampaignRecipient[];
}

export interface CampaignDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  run_status: CampaignRunStatus | null;
  audience: {
    type: CampaignAudienceType;
    filters: CampaignAudienceFilters;
  };
  message: CampaignMessageDetail;
  batch: CampaignBatchDetail;
  lifecycle: CampaignLifecycleDetail;
  metrics: CampaignMetrics;
  source_comparison: CampaignPerformanceSourceComparison[];
  recipients: CampaignRecipient[];
  created_at: string;
  updated_at: string;
}
