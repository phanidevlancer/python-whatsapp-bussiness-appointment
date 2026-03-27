'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { MessageSquare, Lock, Mail } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { mutate: login, isPending } = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@clinic.com', password: 'admin1234' },
  });

  const onSubmit = (data: FormData) => {
    login(data, {
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail ?? 'Login failed. Please try again.');
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-300 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl shadow-lg mb-4">
            <MessageSquare size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Clinic CRM</h1>
          <p className="text-gray-500 mt-2">Sign in to your admin account</p>
        </div>

        {/* Login Form */}
        <Card className="p-6" variant="elevated">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              {...register('email')}
              type="email"
              label="Email Address"
              placeholder="you@company.com"
              autoComplete="off"
              error={errors.email?.message}
              leftIcon={<Mail size={18} />}
            />

            <div>
              <Input
                {...register('password')}
                type="password"
                label="Password"
                placeholder="Enter your password"
                autoComplete="off"
                error={errors.password?.message}
                leftIcon={<Lock size={18} />}
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isPending}
            >
              {isPending ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Demo Credentials</span>
            </div>
          </div>

          {/* Demo Credentials */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email:</span>
              <code className="text-gray-900 font-medium">admin@clinic.com</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Password:</span>
              <code className="text-gray-900 font-medium">admin1234</code>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to our{' '}
          <a href="#" className="text-primary-600 hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
