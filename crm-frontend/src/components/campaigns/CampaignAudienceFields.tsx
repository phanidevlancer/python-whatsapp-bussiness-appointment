'use client';

import { type ChangeEvent, useState } from 'react';
import { FileUp, Users, UsersRound, Clock3, PhoneForwarded } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { CampaignAudienceType } from '@/types/campaign';

const audienceOptions: Array<{
  value: CampaignAudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    value: 'all_customers',
    label: 'All Customers',
    description: 'Broadcast to every customer profile already in the CRM.',
    icon: Users,
  },
  {
    value: 'customers_with_previous_bookings',
    label: 'Previous Bookings',
    description: 'Focus only on customers who have already converted at least once.',
    icon: UsersRound,
  },
  {
    value: 'customers_inactive_for_days',
    label: 'Inactive Customers',
    description: 'Target customers who have not booked again for a configured number of days.',
    icon: Clock3,
  },
  {
    value: 'uploaded_phone_list',
    label: 'Uploaded Phone List',
    description: 'Import an external list of phone numbers for one-off winback or promo pushes.',
    icon: PhoneForwarded,
  },
];

function normalizePhoneList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((value) => value.replace(/\s+/g, '').trim())
        .filter(Boolean),
    ),
  ).join('\n');
}

function extractPhonesFromImportedText(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .flatMap((line) => line.split(','))
        .map((value) => value.trim())
        .map((value) => value.replace(/^"(.*)"$/, '$1'))
        .map((value) => value.replace(/\s+/g, ''))
        .filter((value) => /^\+?\d{8,15}$/.test(value)),
    ),
  ).join('\n');
}

interface CampaignAudienceFieldsProps {
  audienceType: CampaignAudienceType;
  inactiveDays: string;
  uploadedPhonesText: string;
  onAudienceTypeChange: (value: CampaignAudienceType) => void;
  onInactiveDaysChange: (value: string) => void;
  onUploadedPhonesTextChange: (value: string) => void;
}

export default function CampaignAudienceFields({
  audienceType,
  inactiveDays,
  uploadedPhonesText,
  onAudienceTypeChange,
  onInactiveDaysChange,
  onUploadedPhonesTextChange,
}: CampaignAudienceFieldsProps) {
  const [fileError, setFileError] = useState<string | null>(null);

  const uploadedPhoneCount = normalizePhoneList(uploadedPhonesText)
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean).length;

  const handlePhoneFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const normalized = extractPhonesFromImportedText(text);
      if (!normalized) {
        setFileError('No valid phone numbers were found. Use a single-column CSV or plain text list.');
        return;
      }
      onUploadedPhonesTextChange(normalized);
      setFileError(null);
    } catch {
      setFileError('Unable to read the uploaded list. Try a plain text or CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {audienceOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = audienceType === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onAudienceTypeChange(option.value)}
              className={`rounded-3xl border p-4 text-left transition ${
                isSelected
                  ? 'border-primary-300 bg-primary-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {audienceType === 'customers_inactive_for_days' ? (
        <Input
          label="Inactive For Days"
          type="number"
          min={1}
          step={1}
          value={inactiveDays}
          onChange={(event) => onInactiveDaysChange(event.target.value)}
          placeholder="90"
          helperText="Customers with no bookings in this period will be targeted."
        />
      ) : null}

      {audienceType === 'uploaded_phone_list' ? (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Phone List Import</p>
              <p className="mt-1 text-xs text-slate-500">
                Paste one phone per line or upload a single-column `.txt` / `.csv` file.
              </p>
            </div>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="sr-only"
                onChange={handlePhoneFileImport}
              />
              <span className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700">
                <FileUp size={16} />
                Import file
              </span>
            </label>
          </div>

          <Textarea
            label="Uploaded Phones"
            placeholder={'+919999999999\n+918888888888'}
            value={uploadedPhonesText}
            onChange={(event) => onUploadedPhonesTextChange(event.target.value)}
            rows={6}
            helperText={`${uploadedPhoneCount} phone${uploadedPhoneCount === 1 ? '' : 's'} ready for targeting`}
          />
          {fileError ? <p className="text-xs font-medium text-red-600">{fileError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
