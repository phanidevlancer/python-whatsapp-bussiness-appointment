'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ArrowLeft, Megaphone, PencilLine } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import CampaignBuilder from '@/components/campaigns/CampaignBuilder';
import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useCampaigns,
  useCreateCampaign,
  usePauseCampaign,
  useStartCampaign,
  useUpdateCampaign,
  useUploadCampaignImage,
} from '@/hooks/useCampaigns';
import { useServicesList } from '@/hooks/useServices';
import { cn } from '@/lib/utils';
import type {
  CampaignImageUploadResponse,
  CampaignMutationPayload,
} from '@/types/campaign';

function getErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data as { detail?: string } | undefined;
  return detail?.detail ?? error.message ?? fallback;
}

export default function CampaignEditorScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId');

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useCampaigns();
  const { data: services = [], isLoading: isLoadingServices } = useServicesList(true);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const uploadCampaignImage = useUploadCampaignImage();
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignId) ?? null,
    [campaignId, campaigns],
  );

  const persistCampaign = async (payload: CampaignMutationPayload) => {
    return selectedCampaign
      ? updateCampaign.mutateAsync({
          campaignId: selectedCampaign.id,
          data: payload,
        })
      : createCampaign.mutateAsync(payload);
  };

  const handleSave = async (payload: CampaignMutationPayload) => {
    try {
      const savedCampaign = await persistCampaign(payload);
      toast.success(selectedCampaign ? 'Campaign updated' : 'Campaign created');
      return savedCampaign;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save campaign');
      toast.error(message);
      throw error;
    }
  };

  const handleLaunch = async (payload: CampaignMutationPayload) => {
    try {
      const savedCampaign = await persistCampaign(payload);
      const launchedCampaign = await startCampaign.mutateAsync({
        campaignId: savedCampaign.id,
        mode: 'send-now',
      });
      toast.success('Campaign send started');
      return launchedCampaign;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to launch campaign');
      toast.error(message);
      throw error;
    }
  };

  const handlePause = async (targetCampaignId: string) => {
    try {
      const pausedCampaign = await pauseCampaign.mutateAsync(targetCampaignId);
      toast.success('Campaign paused');
      return pausedCampaign;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to pause campaign');
      toast.error(message);
      throw error;
    }
  };

  const handleUploadImage = async (file: File): Promise<CampaignImageUploadResponse> => {
    try {
      const uploadedImage = await uploadCampaignImage.mutateAsync(file);
      toast.success('Campaign image uploaded');
      return uploadedImage;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to upload campaign image');
      toast.error(message);
      throw error;
    }
  };

  if (campaignId && isLoadingCampaigns) {
    return (
      <div className="dashboard-page-shell space-y-6">
        <Skeleton variant="rounded" className="h-36 w-full rounded-[28px]" />
        <Skeleton variant="rounded" className="h-[56rem] w-full rounded-[28px]" />
      </div>
    );
  }

  if (campaignId && !selectedCampaign) {
    return (
      <div className="dashboard-page-shell">
        <Card className="rounded-[28px] p-8 text-center" variant="elevated">
          <h2 className="text-xl font-bold text-slate-900">Campaign not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            The selected campaign could not be loaded for editing.
          </p>
          <div className="mt-5">
            <Link
              href="/campaigns"
              className={cn(buttonVariants({ variant: 'outline', size: 'md' }))}
            >
              <ArrowLeft size={16} />
              Back to campaigns
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="dashboard-page-shell space-y-6">
      <div className="dashboard-page-header rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <ArrowLeft size={16} />
              Back to campaigns
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={selectedCampaign ? 'info' : 'teal'} size="sm" dot>
                {selectedCampaign ? 'Edit campaign' : 'New campaign'}
              </Badge>
            </div>
            <h1 className="mt-4 text-[2rem] font-black tracking-[-0.04em] text-slate-900">
              {selectedCampaign ? selectedCampaign.name : 'Create campaign'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              {selectedCampaign
                ? 'Update the offer, targeting, and rollout settings for this campaign.'
                : 'Set up one campaign at a time without list or analytics noise.'}
            </p>
          </div>

          {selectedCampaign ? (
            <Link
              href={`/campaigns/${selectedCampaign.id}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'md' }))}
            >
              <PencilLine size={16} />
              View insights
            </Link>
          ) : (
            <div className="rounded-[24px] bg-primary-50 p-4 text-primary-700">
              <Megaphone size={18} />
            </div>
          )}
        </div>
      </div>

      <CampaignBuilder
        key={selectedCampaign?.id ?? 'new'}
        campaign={selectedCampaign}
        services={services}
        isServicesLoading={isLoadingServices}
        isSaving={createCampaign.isPending || updateCampaign.isPending}
        isLaunching={startCampaign.isPending}
        isPausing={pauseCampaign.isPending}
        isUploadingImage={uploadCampaignImage.isPending}
        onSave={handleSave}
        onLaunch={(payload) => handleLaunch(payload)}
        onPause={handlePause}
        onUploadImage={handleUploadImage}
        onCreateNew={() => {
          router.push('/campaigns/new');
        }}
      />
    </div>
  );
}
