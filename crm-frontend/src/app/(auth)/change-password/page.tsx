'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { TokenResponse } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle, CardSubtitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ChangePasswordPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [hydrated, setHydrated] = useState(() => {
    const persistApi = (useAuthStore as typeof useAuthStore & {
      persist?: {
        hasHydrated?: () => boolean;
      };
    }).persist;
    return persistApi?.hasHydrated?.() ?? true;
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const persistApi = (useAuthStore as typeof useAuthStore & {
      persist?: {
        onFinishHydration?: (callback: () => void) => () => void;
      };
    }).persist;

    if (!persistApi) {
      return;
    }

    const unsubscribe = persistApi.onFinishHydration?.(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [hydrated, token, mustChangePassword, router]);

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: async () => {
      const res = await api.post<TokenResponse>('/api/v1/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAuth(data.access_token, data.user, data.permissions, data.must_change_password);
      toast.success('Password updated');
      router.replace('/dashboard');
    },
    onError: (err: unknown) => {
      const message =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
          : 'Failed to change password';
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    if (!currentPassword || !newPassword) {
      setFormError('Fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match.');
      return;
    }
    setFormError(null);
    changePassword();
  };

  if (!hydrated || !token) return null;
  if (!mustChangePassword) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-3 sm:p-6">
      <Card className="w-full max-w-xl border-slate-200 shadow-2xl" variant="elevated">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardSubtitle>Set a new password before accessing the dashboard.</CardSubtitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            helperText="Use at least 8 characters with upper, lower, digit, and special character."
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
          />
          {formError ? <p className="text-sm font-medium text-error-600">{formError}</p> : null}
          <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
            <Button
              variant="outline"
              size="md"
              onClick={() => router.replace('/login')}
              disabled={isPending}
            >
              Back to Login
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              isLoading={isPending}
            >
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
