"use client";

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, MessageSquare, Sparkles } from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = '#1f2937',
  forceLookX,
  forceLookY,
}: PupilProps) => {
  const [pupilPosition, setPupilPosition] = useState({ x: 0, y: 0 });
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!pupilRef.current) return;

      const pupil = pupilRef.current.getBoundingClientRect();
      const pupilCenterX = pupil.left + pupil.width / 2;
      const pupilCenterY = pupil.top + pupil.height / 2;
      const deltaX = e.clientX - pupilCenterX;
      const deltaY = e.clientY - pupilCenterY;
      const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
      const angle = Math.atan2(deltaY, deltaX);

      setPupilPosition({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [forceLookX, forceLookY, maxDistance]);

  const activePosition =
    forceLookX !== undefined && forceLookY !== undefined
      ? { x: forceLookX, y: forceLookY }
      : pupilPosition;

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${activePosition.x}px, ${activePosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
};

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = '#1f2937',
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [pupilPosition, setPupilPosition] = useState({ x: 0, y: 0 });
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!eyeRef.current) return;

      const eye = eyeRef.current.getBoundingClientRect();
      const eyeCenterX = eye.left + eye.width / 2;
      const eyeCenterY = eye.top + eye.height / 2;
      const deltaX = e.clientX - eyeCenterX;
      const deltaY = e.clientY - eyeCenterY;
      const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
      const angle = Math.atan2(deltaY, deltaX);

      setPupilPosition({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [forceLookX, forceLookY, maxDistance]);

  const activePosition =
    forceLookX !== undefined && forceLookY !== undefined
      ? { x: forceLookX, y: forceLookY }
      : pupilPosition;

  return (
    <div
      ref={eyeRef}
      className="flex items-center justify-center overflow-hidden rounded-full transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${activePosition.x}px, ${activePosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
};

export default function AnimatedCharactersLoginPage() {
  const { mutate: login, isPending } = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('admin@clinic.com');
  const [password, setPassword] = useState('admin1234');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'password' | null>(null);
  const [purplePos, setPurplePos] = useState({ faceX: 0, faceY: 0, bodySkew: 0 });
  const [blackPos, setBlackPos] = useState({ faceX: 0, faceY: 0, bodySkew: 0 });
  const [yellowPos, setYellowPos] = useState({ faceX: 0, faceY: 0, bodySkew: 0 });
  const [orangePos, setOrangePos] = useState({ faceX: 0, faceY: 0, bodySkew: 0 });
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsPurpleBlinking(true);
        setTimeout(() => {
          setIsPurpleBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;

    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsBlackBlinking(true);
        setTimeout(() => {
          setIsBlackBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());

      return blinkTimeout;
    };

    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  const calculatePositionFromPoint = (ref: React.RefObject<HTMLDivElement | null>, clientX: number, clientY: number) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    return {
      faceX: Math.max(-15, Math.min(15, deltaX / 20)),
      faceY: Math.max(-10, Math.min(10, deltaY / 30)),
      bodySkew: Math.max(-6, Math.min(6, -deltaX / 120)),
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPurplePos(calculatePositionFromPoint(purpleRef, e.clientX, e.clientY));
      setBlackPos(calculatePositionFromPoint(blackRef, e.clientX, e.clientY));
      setYellowPos(calculatePositionFromPoint(yellowRef, e.clientX, e.clientY));
      setOrangePos(calculatePositionFromPoint(orangeRef, e.clientX, e.clientY));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const isTypingEmail = activeField === 'email';
  const isTypingPassword = activeField === 'password' && password.length > 0;
  const isLookingAtEachOther = false;
  const isPurplePeeking = password.length > 0 && showPassword && isTypingPassword;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    login(
      { email, password },
      {
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof err.response === 'object' &&
            err.response !== null &&
            'data' in err.response &&
            typeof err.response.data === 'object' &&
            err.response.data !== null &&
            'detail' in err.response.data &&
            typeof err.response.data.detail === 'string'
              ? err.response.data.detail
              : 'Login failed. Please try again.';

          setError(message);
          toast.error(message);
        },
      }
    );
  };

  return (
    <div className="min-h-screen grid overflow-hidden bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_35%,#e2e8f0_100%)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,148,136,0.98),rgba(37,99,235,0.94))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.12),transparent_28%),radial-gradient(circle_at_35%_75%,rgba(255,255,255,0.1),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />

        <div className="relative z-20 p-12">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/14 backdrop-blur-sm">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-wide">ORA Clinic</p>
              <p className="text-sm text-white/75">Admin console</p>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-end justify-center px-10">
          <div className="relative h-[420px] w-[560px] max-w-full">
            <div
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '74px',
                width: '182px',
                height: isTypingEmail || isTypingPassword ? '436px' : '398px',
                backgroundColor: '#1d4ed8',
                borderRadius: '18px 18px 0 0',
                zIndex: 1,
                transform:
                  password.length > 0 && showPassword
                    ? 'skewX(0deg)'
                    : isTypingEmail || isTypingPassword
                      ? `skewX(${purplePos.bodySkew - 10}deg) translateX(36px)`
                      : `skewX(${purplePos.bodySkew}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left: password.length > 0 && showPassword ? '24px' : isLookingAtEachOther ? '58px' : `${48 + purplePos.faceX}px`,
                  top: password.length > 0 && showPassword ? '34px' : isLookingAtEachOther ? '64px' : `${40 + purplePos.faceY}px`,
                }}
              >
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={8}
                  eyeColor="white"
                  pupilColor="#1f2937"
                  isBlinking={isPurpleBlinking}
                  forceLookX={password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                />
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={8}
                  eyeColor="white"
                  pupilColor="#1f2937"
                  isBlinking={isPurpleBlinking}
                  forceLookX={password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                />
              </div>
            </div>

            <div
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '244px',
                width: '124px',
                height: '314px',
                backgroundColor: '#0f172a',
                borderRadius: '12px 12px 0 0',
                zIndex: 2,
                transform:
                  password.length > 0 && showPassword
                    ? 'skewX(0deg)'
                    : isLookingAtEachOther
                      ? `skewX(${blackPos.bodySkew * 1.5 + 10}deg) translateX(18px)`
                      : isTypingEmail || isTypingPassword
                        ? `skewX(${blackPos.bodySkew * 1.5}deg)`
                        : `skewX(${blackPos.bodySkew}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left: password.length > 0 && showPassword ? '10px' : isLookingAtEachOther ? '34px' : `${28 + blackPos.faceX}px`,
                  top: password.length > 0 && showPassword ? '28px' : isLookingAtEachOther ? '12px' : `${32 + blackPos.faceY}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#0f172a"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#0f172a"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
              </div>
            </div>

            <div
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '4px',
                width: '238px',
                height: '198px',
                zIndex: 3,
                backgroundColor: '#f59e0b',
                borderRadius: '120px 120px 0 0',
                transform: password.length > 0 && showPassword ? 'skewX(0deg)' : `skewX(${orangePos.bodySkew}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? '52px' : `${84 + orangePos.faceX}px`,
                  top: password.length > 0 && showPassword ? '84px' : `${90 + orangePos.faceY}px`,
                }}
              >
                <Pupil size={12} maxDistance={5} pupilColor="#0f172a" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#0f172a" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
              </div>
            </div>

            <div
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '314px',
                width: '144px',
                height: '232px',
                backgroundColor: '#2dd4bf',
                borderRadius: '72px 72px 0 0',
                zIndex: 4,
                transform: password.length > 0 && showPassword ? 'skewX(0deg)' : `skewX(${yellowPos.bodySkew}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? '20px' : `${52 + yellowPos.faceX}px`,
                  top: password.length > 0 && showPassword ? '35px' : `${40 + yellowPos.faceY}px`,
                }}
              >
                <Pupil size={12} maxDistance={5} pupilColor="#0f172a" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#0f172a" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
              </div>
              <div
                className="absolute h-1 w-20 rounded-full bg-slate-900 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? '10px' : `${40 + yellowPos.faceX}px`,
                  top: password.length > 0 && showPassword ? '88px' : `${88 + yellowPos.faceY}px`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 p-12 pt-6 text-sm text-white/70">
          <p className="mb-2 flex items-center gap-2 font-medium text-white">
            <Sparkles className="size-4" />
            Built for high-clarity appointment operations
          </p>
          <p className="max-w-md leading-6">
            Manage bookings, leads, and customer activity from one focused admin workspace designed around your current teal-blue ORA palette.
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_30%)]" />
        <div className="relative w-full max-w-[460px]">
          <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">ORA Clinic</p>
              <p className="text-sm text-slate-500">Admin console</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(240,253,250,0.95),rgba(239,246,255,0.95))] px-8 py-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary-700">
                <Sparkles className="size-3.5" />
                Welcome Back
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sign in to ORA</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use your clinic admin credentials to access appointments, contacts, leads, and live updates.
              </p>
            </div>

            <div className="px-8 py-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@clinic.com"
                      value={email}
                      autoComplete="username"
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setActiveField('email')}
                      onBlur={() => setActiveField(null)}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 focus-visible:bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      autoComplete="current-password"
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setActiveField('password')}
                      onBlur={() => setActiveField(null)}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 pr-12 focus-visible:bg-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex items-center gap-2 text-slate-600">
                    <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(Boolean(checked))} id="remember" />
                    <span>Remember for 30 days</span>
                  </label>
                  <button type="button" className="font-medium text-primary-700 transition-colors hover:text-primary-800">
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div className="rounded-2xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                    {error}
                  </div>
                )}

                <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={isPending}>
                  {isPending ? 'Signing in...' : 'Log in'}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Demo access</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Email</p>
                  <p className="mt-1 font-semibold text-slate-900">admin@clinic.com</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Password</p>
                  <p className="mt-1 font-semibold text-slate-900">admin1234</p>
                </div>
              </div>

              <div className="mt-6">
                <Button type="button" variant="outline" className="h-12 w-full rounded-2xl">
                  <Mail className="mr-2 size-4" />
                  Continue with Google
                </Button>
              </div>

              <p className="mt-8 text-center text-sm text-slate-500">
                Need access for a new team member?{' '}
                <button type="button" className="font-medium text-secondary-700 transition-colors hover:text-secondary-800">
                  Request onboarding
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Component = AnimatedCharactersLoginPage;
