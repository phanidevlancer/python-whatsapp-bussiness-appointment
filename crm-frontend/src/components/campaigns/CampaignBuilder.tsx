'use client';

import { useState } from 'react';
import axios from 'axios';
import { CalendarRange, Check, Megaphone, Save, Send, SquarePause, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import CampaignCreativeUpload from '@/components/campaigns/CampaignCreativeUpload';
import CampaignAudienceFields from '@/components/campaigns/CampaignAudienceFields';
import type {
  Campaign,
  CampaignBuilderFormValues,
  CampaignDiscountType,
  CampaignImageUploadResponse,
  CampaignMutationPayload,
} from '@/types/campaign';
import type { Service } from '@/types/appointment';

const weekdayOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const discountOptions: Array<{
  value: CampaignDiscountType;
  label: string;
  helper: string;
}> = [
  { value: 'none', label: 'No Discount', helper: 'Message-only campaign' },
  { value: 'percent', label: 'Percent', helper: 'Ex: 20% or 50%' },
  { value: 'flat', label: 'Flat', helper: 'Ex: Rs 300 off' },
];

function getEmptyForm(): CampaignBuilderFormValues {
  return {
    name: '',
    code: '',
    description: '',
    booking_button_id: '',
    allowed_service_ids: [],
    allowed_weekdays: [],
    valid_from: '',
    valid_to: '',
    per_user_booking_limit: '',
    discount_type: 'none',
    discount_value: '',
    audience_type: 'all_customers',
    inactivity_days: '',
    uploaded_phones_text: '',
    message_body: '',
    message_footer: '',
    button_label: '',
    image_path: null,
    batch_size: '50',
    batch_delay_seconds: '60',
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatDateTimeInput(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePhoneList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((value) => value.replace(/\s+/g, '').trim())
        .filter(Boolean),
    ),
  );
}

function campaignToForm(campaign: Campaign | null): CampaignBuilderFormValues {
  if (!campaign) return getEmptyForm();

  const inactivityDays =
    typeof campaign.audience_filters.inactivity_days === 'number'
      ? campaign.audience_filters.inactivity_days
      : typeof campaign.audience_filters.inactive_days === 'number'
        ? campaign.audience_filters.inactive_days
        : null;

  return {
    name: campaign.name,
    code: campaign.code,
    description: campaign.description ?? '',
    booking_button_id: campaign.booking_button_id ?? '',
    allowed_service_ids: [...campaign.allowed_service_ids],
    allowed_weekdays: [...campaign.allowed_weekdays],
    valid_from: formatDateTimeInput(campaign.valid_from),
    valid_to: formatDateTimeInput(campaign.valid_to),
    per_user_booking_limit: campaign.per_user_booking_limit?.toString() ?? '',
    discount_type: campaign.discount_type,
    discount_value: campaign.discount_value?.toString() ?? '',
    audience_type: campaign.audience_type,
    inactivity_days: inactivityDays?.toString() ?? '',
    uploaded_phones_text: Array.isArray(campaign.audience_filters.phones)
      ? campaign.audience_filters.phones.join('\n')
      : '',
    message_body: campaign.message_body ?? '',
    message_footer: campaign.message_footer ?? '',
    button_label: campaign.button_label ?? '',
    image_path: campaign.image_path ?? null,
    batch_size: campaign.batch_size?.toString() ?? '50',
    batch_delay_seconds: campaign.batch_delay_seconds?.toString() ?? '60',
  };
}

function getRunStatusBadgeVariant(runStatus: Campaign['run_status']) {
  if (runStatus === 'running') return 'success';
  if (runStatus === 'failed') return 'error';
  if (runStatus === 'paused') return 'warning';
  return 'default';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data as { detail?: string } | undefined;
  return detail?.detail ?? error.message ?? fallback;
}

interface CampaignBuilderProps {
  campaign: Campaign | null;
  services: Service[];
  isServicesLoading: boolean;
  isSaving: boolean;
  isLaunching: boolean;
  isPausing: boolean;
  isUploadingImage: boolean;
  onSave: (payload: CampaignMutationPayload) => Promise<Campaign>;
  onLaunch: (payload: CampaignMutationPayload, mode: 'send-now') => Promise<Campaign>;
  onPause: (campaignId: string) => Promise<Campaign>;
  onUploadImage: (file: File) => Promise<CampaignImageUploadResponse>;
  onCreateNew: () => void;
}

export default function CampaignBuilder({
  campaign,
  services,
  isServicesLoading,
  isSaving,
  isLaunching,
  isPausing,
  isUploadingImage,
  onSave,
  onLaunch,
  onPause,
  onUploadImage,
  onCreateNew,
}: CampaignBuilderProps) {
  const [form, setForm] = useState<CampaignBuilderFormValues>(() => campaignToForm(campaign));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasManualCode, setHasManualCode] = useState(Boolean(campaign?.code));

  const handleFormChange = <Key extends keyof CampaignBuilderFormValues>(
    key: Key,
    value: CampaignBuilderFormValues[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
  };

  const toggleService = (serviceId: string) => {
    setForm((current) => ({
      ...current,
      allowed_service_ids: current.allowed_service_ids.includes(serviceId)
        ? current.allowed_service_ids.filter((id) => id !== serviceId)
        : [...current.allowed_service_ids, serviceId],
    }));
    setSubmitError(null);
  };

  const handleNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      name: value,
      code: hasManualCode ? current.code : slugify(value),
    }));
    setSubmitError(null);
  };

  const toggleWeekday = (weekday: number) => {
    setForm((current) => ({
      ...current,
      allowed_weekdays: current.allowed_weekdays.includes(weekday)
        ? current.allowed_weekdays.filter((value) => value !== weekday)
        : [...current.allowed_weekdays, weekday].sort((left, right) => left - right),
    }));
    setSubmitError(null);
  };

  const validateForm = () => {
    const normalizedCode = slugify(form.code || form.name);
    if (!form.name.trim()) return 'Campaign name is required.';
    if (!normalizedCode) return 'Campaign code is required.';
    if (!form.allowed_service_ids.length) return 'Select at least one eligible service.';
    if (!form.message_body.trim()) return 'Campaign message content is required.';
    if (!form.button_label.trim()) return 'Button label is required.';

    if (form.valid_from && form.valid_to && new Date(form.valid_from) > new Date(form.valid_to)) {
      return 'The valid start must be before the valid end.';
    }

    if (form.discount_type === 'percent') {
      const discountValue = parseOptionalNumber(form.discount_value);
      if (discountValue === null || discountValue < 0 || discountValue > 100) {
        return 'Percent discounts must be between 0 and 100.';
      }
    }

    if (form.discount_type === 'flat') {
      const discountValue = parseOptionalNumber(form.discount_value);
      if (discountValue === null || discountValue < 0) {
        return 'Flat discounts must be zero or greater.';
      }
    }

    if (form.audience_type === 'customers_inactive_for_days') {
      const inactiveDays = parseOptionalInteger(form.inactivity_days);
      if (inactiveDays === null || inactiveDays <= 0) {
        return 'Inactive audience needs a positive day count.';
      }
    }

    if (form.audience_type === 'uploaded_phone_list' && parsePhoneList(form.uploaded_phones_text).length === 0) {
      return 'Upload or paste at least one phone number for this audience.';
    }

    const batchSize = parseOptionalInteger(form.batch_size);
    if (batchSize === null || batchSize <= 0) {
      return 'Batch size must be a positive number.';
    }

    const batchDelaySeconds = parseOptionalInteger(form.batch_delay_seconds);
    if (batchDelaySeconds === null || batchDelaySeconds < 0) {
      return 'Batch delay must be zero or greater.';
    }

    return null;
  };

  const buildPayload = () => {
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return null;
    }

    const normalizedCode = slugify(form.code || form.name);
    const uploadedPhones = parsePhoneList(form.uploaded_phones_text);

    return {
      code: normalizedCode,
      name: form.name.trim(),
      description: form.description.trim() || null,
      booking_button_id: form.booking_button_id.trim() || `campaign_book:${normalizedCode}`,
      allowed_service_ids: form.allowed_service_ids,
      allowed_weekdays: form.allowed_weekdays,
      valid_from: toIsoOrNull(form.valid_from),
      valid_to: toIsoOrNull(form.valid_to),
      per_user_booking_limit: parseOptionalInteger(form.per_user_booking_limit),
      discount_type: form.discount_type,
      discount_value: form.discount_type === 'none' ? null : parseOptionalNumber(form.discount_value),
      audience_type: form.audience_type,
      audience_filters:
        form.audience_type === 'customers_inactive_for_days'
          ? { inactivity_days: parseOptionalInteger(form.inactivity_days) ?? undefined }
          : form.audience_type === 'uploaded_phone_list'
            ? { phones: uploadedPhones }
            : {},
      message_body: form.message_body.trim(),
      message_footer: form.message_footer.trim() || null,
      button_label: form.button_label.trim(),
      image_path: form.image_path,
      batch_size: parseOptionalInteger(form.batch_size) ?? 50,
      batch_delay_seconds: parseOptionalInteger(form.batch_delay_seconds) ?? 60,
    } satisfies CampaignMutationPayload;
  };

  const saveCampaign = async () => {
    const payload = buildPayload();
    if (!payload) return;

    try {
      setSubmitError(null);
      await onSave(payload);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Failed to save campaign'));
    }
  };

  const launchCampaign = async () => {
    const payload = buildPayload();
    if (!payload) return;

    try {
      setSubmitError(null);
      await onLaunch(payload, 'send-now');
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Failed to launch campaign'));
    }
  };

  const pauseCampaign = async () => {
    if (!campaign?.id) return;

    try {
      setSubmitError(null);
      await onPause(campaign.id);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Failed to pause campaign'));
    }
  };

  const selectedPhoneCount = parsePhoneList(form.uploaded_phones_text).length;

  return (
    <Card className="dashboard-page-panel rounded-[28px] p-6" variant="elevated">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={campaign ? 'info' : 'teal'} size="sm" dot>
              {campaign ? 'Editing campaign' : 'New draft'}
            </Badge>
            <Badge variant={getRunStatusBadgeVariant(campaign?.run_status ?? null)} size="sm" dot>
              {campaign?.run_status ?? 'draft'}
            </Badge>
          </div>
          <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-slate-900">
            Campaign Builder
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Build the offer rules, creative, audience, and rollout from one page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="md"
          leftIcon={<WandSparkles size={16} />}
          onClick={onCreateNew}
        >
          New Draft
        </Button>
      </div>

      <div className="mt-6 space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Megaphone size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Basics</h4>
              <p className="text-xs text-slate-500">Name, campaign code, and internal notes.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Campaign Name"
              placeholder="Hydra Winback Sunday"
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
            />
            <Input
              label="Campaign Code"
              placeholder="hydra-winback-sunday"
              value={form.code}
              onChange={(event) => {
                setHasManualCode(true);
                handleFormChange('code', event.target.value);
              }}
              helperText="Used in attribution and booking button IDs."
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
            <Textarea
              label="Description"
              placeholder="Internal summary for the clinic team."
              value={form.description}
              onChange={(event) => handleFormChange('description', event.target.value)}
              rows={3}
            />
            <Input
              label="Booking Button ID"
              placeholder="campaign_book:hydra-winback-sunday"
              value={form.booking_button_id}
              onChange={(event) => handleFormChange('booking_button_id', event.target.value)}
              helperText="Leave blank to auto-generate from the campaign code."
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <CalendarRange size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Offer Rules</h4>
              <p className="text-xs text-slate-500">
                Eligible services, weekdays, validity window, limits, and discount behavior.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {isServicesLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 md:col-span-2">
                Loading services...
              </div>
            ) : (
              services.map((service) => {
                const isSelected = form.allowed_service_ids.includes(service.id);

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-primary-300 bg-primary-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {service.duration_minutes} min · Rs {Number(service.cost).toFixed(0)}
                        </p>
                        {!service.is_active ? (
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">
                            Inactive service
                          </p>
                        ) : null}
                        {service.description ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">{service.description}</p>
                        ) : null}
                      </div>
                      <span
                        className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                          isSelected
                            ? 'border-primary-600 bg-primary-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        <Check size={14} />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-900">Allowed Weekdays</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {weekdayOptions.map((weekday) => {
                const isSelected = form.allowed_weekdays.includes(weekday.value);

                return (
                  <button
                    key={weekday.value}
                    type="button"
                    onClick={() => toggleWeekday(weekday.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {weekday.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Valid From"
              type="datetime-local"
              value={form.valid_from}
              onChange={(event) => handleFormChange('valid_from', event.target.value)}
            />
            <Input
              label="Valid To"
              type="datetime-local"
              value={form.valid_to}
              onChange={(event) => handleFormChange('valid_to', event.target.value)}
            />
            <Input
              label="Per-User Booking Cap"
              type="number"
              min={1}
              step={1}
              value={form.per_user_booking_limit}
              onChange={(event) => handleFormChange('per_user_booking_limit', event.target.value)}
              placeholder="1"
            />
            <Input
              label="Batch Size"
              type="number"
              min={1}
              step={1}
              value={form.batch_size}
              onChange={(event) => handleFormChange('batch_size', event.target.value)}
              placeholder="50"
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Discount Type</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {discountOptions.map((option) => {
                  const isSelected = form.discount_type === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleFormChange('discount_type', option.value)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-primary-300 bg-primary-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{option.helper}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4">
              <Input
                label="Discount Value"
                type="number"
                min={0}
                max={form.discount_type === 'percent' ? 100 : undefined}
                step="0.01"
                disabled={form.discount_type === 'none'}
                value={form.discount_value}
                onChange={(event) => handleFormChange('discount_value', event.target.value)}
                placeholder={form.discount_type === 'percent' ? '25' : '300'}
                helperText={
                  form.discount_type === 'percent'
                    ? 'Enter a percentage from 0 to 100.'
                    : form.discount_type === 'flat'
                      ? 'Flat rupee amount to subtract.'
                      : 'Disabled for message-only campaigns.'
                }
              />
              <Input
                label="Batch Delay Seconds"
                type="number"
                min={0}
                step={1}
                value={form.batch_delay_seconds}
                onChange={(event) => handleFormChange('batch_delay_seconds', event.target.value)}
                placeholder="0"
                helperText="Optional pause between message batches."
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-slate-900">Creative</h4>
          <p className="mt-1 text-xs text-slate-500">
            Upload the campaign image and define the WhatsApp message payload.
          </p>
          <div className="mt-4">
            <CampaignCreativeUpload
              imagePath={form.image_path}
              isUploading={isUploadingImage}
              messageBody={form.message_body}
              messageFooter={form.message_footer}
              buttonLabel={form.button_label}
              onImagePathChange={(value) => handleFormChange('image_path', value)}
              onMessageBodyChange={(value) => handleFormChange('message_body', value)}
              onMessageFooterChange={(value) => handleFormChange('message_footer', value)}
              onButtonLabelChange={(value) => handleFormChange('button_label', value)}
              onUploadImage={onUploadImage}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-slate-900">Audience</h4>
          <p className="mt-1 text-xs text-slate-500">
            Choose between all customers, previous bookings, inactivity windows, or uploaded phone lists.
          </p>
          <div className="mt-4">
            <CampaignAudienceFields
              audienceType={form.audience_type}
              inactiveDays={form.inactivity_days}
              uploadedPhonesText={form.uploaded_phones_text}
              onAudienceTypeChange={(value) => handleFormChange('audience_type', value)}
              onInactiveDaysChange={(value) => handleFormChange('inactivity_days', value)}
              onUploadedPhonesTextChange={(value) => handleFormChange('uploaded_phones_text', value)}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Launch</h4>
              <p className="mt-1 text-xs text-slate-300">
                Save the draft, then send immediately through the current runner in batches.
              </p>
            </div>
            {campaign?.status ? (
              <Badge variant={campaign.status === 'active' ? 'success' : 'warning'} size="sm" dot>
                {campaign.status}
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Services</p>
              <p className="mt-2 text-2xl font-bold">{form.allowed_service_ids.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Audience Mode</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {form.audience_type.replaceAll('_', ' ')}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Uploaded Phones</p>
              <p className="mt-2 text-2xl font-bold">{selectedPhoneCount}</p>
            </div>
          </div>

          {campaign?.last_error ? (
            <div className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              Last runner error: {campaign.last_error}
            </div>
          ) : null}

          {submitError ? (
            <div className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              leftIcon={<Save size={16} />}
              onClick={saveCampaign}
              isLoading={isSaving}
              className="h-11 rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
            >
              {campaign ? 'Save Changes' : 'Create Draft'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Send size={16} />}
              onClick={launchCampaign}
              isLoading={isLaunching}
              disabled={isSaving || isPausing}
              className="h-11 rounded-2xl border border-white/20 bg-emerald-500 px-5 hover:bg-emerald-400"
            >
              Send Now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              leftIcon={<SquarePause size={16} />}
              onClick={pauseCampaign}
              disabled={!campaign?.id || campaign.run_status !== 'running' || isSaving || isLaunching}
              isLoading={isPausing}
              className="h-11 rounded-2xl border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
            >
              Pause Campaign
            </Button>
          </div>
        </section>
      </div>
    </Card>
  );
}
