import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Mail,
  Lock,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';

import { AuthLayout } from '@/layouts';
import { Input, Button } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { Role, User } from '@/types';
import { useAuthStore } from '@/store';

// ============================================================================
// Form Validation Schema
// ============================================================================
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Corporate email address is required')
    .email('Please enter a valid corporate email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

const REMEMBER_ME_KEY = 'mv_payment_remembered_email';
const THROTTLE_STORAGE_KEY = 'mv_payment_login_lockout_until';
const MAX_ATTEMPTS = 5;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Retrieve previous redirect target if any
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  // React Hook Form with Zod
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Load remembered email and restore lockout state on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBER_ME_KEY);
    if (rememberedEmail) {
      setValue('email', rememberedEmail);
      setValue('rememberMe', true);
    }

    const lockoutUntil = localStorage.getItem(THROTTLE_STORAGE_KEY);
    if (lockoutUntil) {
      const remainingSeconds = Math.max(0, Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000));
      if (remainingSeconds > 0) {
        setLockoutRemaining(remainingSeconds);
      } else {
        localStorage.removeItem(THROTTLE_STORAGE_KEY);
      }
    }
  }, [setValue]);

  // Handle countdown timer for throttled state
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(THROTTLE_STORAGE_KEY);
          setFailedAttempts(0);
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Determine redirection route based on Role
  const redirectByRole = (user: User) => {
    if (from && from !== '/login') {
      navigate(from, { replace: true });
      return;
    }

    switch (user.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN:
        navigate('/', { replace: true });
        break;
      case Role.APPROVER:
      case Role.MANAGEMENT:
      case Role.DIRECTOR:
        navigate('/approvals', { replace: true });
        break;
      case Role.ACCOUNTANT:
        navigate('/payments', { replace: true });
        break;
      case Role.REQUESTER:
        navigate('/payment-requests', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
        break;
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    if (lockoutRemaining > 0) {
      toast.error(`Login throttled. Please wait ${lockoutRemaining}s before retrying.`);
      return;
    }

    setErrorMessage(null);
    setIsLocked(false);

    try {
      // Remember me handling
      if (data.rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, data.email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      // Perform real or fallback login
      await login(data.email, data.password);

      // Successfully authenticated
      setFailedAttempts(0);
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        toast.success(`Welcome back, ${currentUser.fullName}!`);
        redirectByRole(currentUser);
      } else {
        navigate(from || '/', { replace: true });
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: {
          status?: number;
          data?: { message?: string; detail?: string; is_locked?: boolean };
        };
        message?: string;
      };

      const status = errorObj.response?.status;
      const responseData = errorObj.response?.data;
      const apiMessage = responseData?.message || responseData?.detail || errorObj.message;

      // Handle Account Lockout (HTTP 423 or backend locked flag)
      if (status === 423 || responseData?.is_locked || apiMessage?.toLowerCase().includes('locked')) {
        setIsLocked(true);
        setErrorMessage(
          'Your account has been locked due to consecutive security violations. Please contact your IT Security Administrator to unlock it.'
        );
        return;
      }

      // Handle Rate Limiting / Throttling (HTTP 429)
      if (status === 429) {
        const lockoutSeconds = 60;
        setLockoutRemaining(lockoutSeconds);
        localStorage.setItem(
          THROTTLE_STORAGE_KEY,
          (Date.now() + lockoutSeconds * 1000).toString()
        );
        setErrorMessage(
          'Security Throttling: Too many requests from this network. Sign-in has been temporarily suspended for 60 seconds.'
        );
        return;
      }

      // Track failed attempt count client-side
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      if (nextFailures >= MAX_ATTEMPTS) {
        const cooldownSeconds = 45;
        setLockoutRemaining(cooldownSeconds);
        localStorage.setItem(
          THROTTLE_STORAGE_KEY,
          (Date.now() + cooldownSeconds * 1000).toString()
        );
        setErrorMessage(
          `Security Alert: Maximum failed attempts (${MAX_ATTEMPTS}) reached. Authentication temporarily blocked for ${cooldownSeconds} seconds.`
        );
      } else if (nextFailures >= 3) {
        setErrorMessage(
          `Invalid email or password. Warning: Attempt ${nextFailures} of ${MAX_ATTEMPTS}. Your account will be temporarily locked after ${MAX_ATTEMPTS} failures.`
        );
      } else {
        setErrorMessage(
          apiMessage || 'Invalid corporate credentials. Please check your email and password.'
        );
      }
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <Logo compact size="lg" to="/login" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 mt-2">
            MV GREENTECH
          </h1>
          <p className="text-sm font-semibold text-emerald-700 tracking-wider uppercase mt-1">
            PAYMENT APPROVAL
          </p>
        </div>

        {/* Security / Throttling / Lockout Alerts */}
        {isLocked && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed font-normal">
              <span className="font-semibold block mb-0.5 text-rose-950 text-sm">Account Suspended</span>
              {errorMessage}
            </div>
          </div>
        )}

        {lockoutRemaining > 0 && !isLocked && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-950">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs leading-relaxed font-normal">
              <span className="font-semibold block mb-0.5 text-sm">
                Sign-In Throttled ({lockoutRemaining}s remaining)
              </span>
              Too many consecutive failed attempts. To protect your organization, access is
              temporarily paused.
            </div>
          </div>
        )}

        {errorMessage && !isLocked && lockoutRemaining === 0 && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed font-normal">
              <span className="font-semibold block mb-0.5 text-rose-950 text-sm">Authentication Error</span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email Field */}
          <div>
            <Input
              label="Corporate Email"
              type="email"
              placeholder="e.g. admin@mvgreentech.com"
              prefixIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              disabled={isSubmitting || lockoutRemaining > 0}
              autoComplete="email"
              {...register('email')}
            />
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700">
                Password
              </span>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline transition-colors"
                tabIndex={-1}
              >
                Forgot Password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="Enter your corporate password"
              prefixIcon={<Lock className="w-4 h-4" />}
              allowPasswordToggle={true}
              error={errors.password?.message}
              disabled={isSubmitting || lockoutRemaining > 0}
              autoComplete="current-password"
              {...register('password')}
            />
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border border-slate-300 text-emerald-700 focus:ring-emerald-600 transition"
                disabled={isSubmitting || lockoutRemaining > 0}
                {...register('rememberMe')}
              />
              <span className="text-xs sm:text-sm font-normal text-slate-600">
                Remember this device for 30 days
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Verifying credentials..."
            disabled={isSubmitting || lockoutRemaining > 0}
            rightIcon={lockoutRemaining === 0 ? <ArrowRight className="w-4 h-4" /> : undefined}
            className="mt-3 h-11 text-sm font-medium bg-[#0D5C3A] hover:bg-[#0A482E] active:bg-[#073622] text-white shadow-xs transition-all"
          >
            {lockoutRemaining > 0 ? `Locked for ${lockoutRemaining}s` : 'Sign In to Account'}
          </Button>
        </form>

        {/* Corporate Support / Help Info */}
        <div className="pt-4 border-t border-slate-200 text-center">
          <p className="text-xs sm:text-sm font-normal text-slate-500">
            Need access or forgot password?{' '}
            <a
              href="mailto:it-support@mvgreentech.com"
              className="font-medium text-emerald-700 hover:text-emerald-800 underline"
            >
              Contact IT Support
            </a>
          </p>
        </div>

        {/* PWA Install Prompt */}
        <div className="pt-2">
          <PWAInstallPrompt />
        </div>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
