'use client';

import Image from 'next/image';
import { type ChangeEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { CampaignImageUploadResponse } from '@/types/campaign';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

function toPreviewUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl}/${path.replace(/^\/+/, '')}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data as { detail?: string } | undefined;
  return detail?.detail ?? error.message ?? fallback;
}

interface CampaignCreativeUploadProps {
  imagePath: string | null;
  isUploading: boolean;
  messageBody: string;
  messageFooter: string;
  buttonLabel: string;
  onImagePathChange: (value: string | null) => void;
  onMessageBodyChange: (value: string) => void;
  onMessageFooterChange: (value: string) => void;
  onButtonLabelChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<CampaignImageUploadResponse>;
}

export default function CampaignCreativeUpload({
  imagePath,
  isUploading,
  messageBody,
  messageFooter,
  buttonLabel,
  onImagePathChange,
  onMessageBodyChange,
  onMessageFooterChange,
  onButtonLabelChange,
  onUploadImage,
}: CampaignCreativeUploadProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    setLocalPreviewUrl(null);
    setUploadError(null);
    setUploadMeta(null);
  }, [imagePath]);

  const previewUrl = localPreviewUrl ?? toPreviewUrl(imagePath);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    setUploadError(null);
    setUploadMeta(null);
    setLocalPreviewUrl(URL.createObjectURL(file));

    try {
      const uploadedImage = await onUploadImage(file);
      onImagePathChange(uploadedImage.relative_path);
      setUploadMeta(
        `${uploadedImage.filename} · ${(uploadedImage.size_bytes / 1024).toFixed(1)} KB`,
      );
    } catch (error) {
      setUploadError(getErrorMessage(error, 'Failed to upload campaign image'));
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-3">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
            {previewUrl ? (
              <div className="space-y-3">
                <Image
                  src={previewUrl}
                  alt="Campaign creative preview"
                  width={1200}
                  height={600}
                  className="h-52 w-full rounded-2xl object-cover"
                  unoptimized
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={handleImageChange}
                      disabled={isUploading}
                    />
                    <span className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700">
                      <UploadCloud size={16} />
                      {isUploading ? 'Uploading...' : 'Replace image'}
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    leftIcon={<Trash2 size={16} />}
                    onClick={() => {
                      if (localPreviewUrl) {
                        URL.revokeObjectURL(localPreviewUrl);
                        setLocalPreviewUrl(null);
                      }
                      setUploadMeta(null);
                      setUploadError(null);
                      onImagePathChange(null);
                    }}
                  >
                    Remove image
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-2xl bg-white text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <ImagePlus size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Upload an offer image</p>
                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG, WebP, or GIF. The file is uploaded to the campaign media endpoint.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={handleImageChange}
                    disabled={isUploading}
                  />
                  <span className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm">
                    <UploadCloud size={16} />
                    {isUploading ? 'Uploading...' : 'Upload image'}
                  </span>
                </label>
              </div>
            )}
          </div>

          {uploadMeta ? <p className="text-xs font-medium text-slate-500">{uploadMeta}</p> : null}
          {uploadError ? <p className="text-xs font-medium text-red-600">{uploadError}</p> : null}
        </div>

        <div className="space-y-4">
          <Textarea
            label="Message Body"
            placeholder="Hydra Facial at 50% off this Sunday. Tap below to book."
            value={messageBody}
            onChange={(event) => onMessageBodyChange(event.target.value)}
            rows={5}
          />
          <Input
            label="Footer"
            placeholder="ORA Clinic"
            value={messageFooter}
            onChange={(event) => onMessageFooterChange(event.target.value)}
            maxLength={255}
          />
          <Input
            label="Button Label"
            placeholder="Book Now"
            value={buttonLabel}
            onChange={(event) => onButtonLabelChange(event.target.value)}
            maxLength={120}
            helperText="This label is sent as the WhatsApp call-to-action button text."
          />
        </div>
      </div>
    </div>
  );
}
