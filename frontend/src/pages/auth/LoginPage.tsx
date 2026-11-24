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

// Quick demo login profiles
const DEMO_ACCOUNTS: Array<{
  role: Role;
  label: string;
  badgeColor: string;
  email: string;
  password?: string;
  name: string;
  designation: string;
  limit: number;
}> = [
  {
    role: Role.SUPER_ADMIN,
    label: 'Super Admin',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    email: 'admin@mvpayments.com',
    password: 'Admin@12345',
    name: 'Rajesh Sharma',
    designation: 'Chief Technology Officer',
    limit: 100000000,
  },
  {
    role: Role.APPROVER,
    label: 'Approver (L2/L3)',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    email: 'approver@mvpayments.com',
    password: 'Approver@12345',
    name: 'Vikram Malhotra',
    designation: 'Finance Controller',
    limit: 5000000,
  },
  {
    role: Role.ACCOUNTANT,
    label: 'Accountant',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    email: 'accountant@mvpayments.com',
    password: 'Accountant@12345',
    name: 'Priya Desai',
    designation: 'Senior Treasury Analyst',
    limit: 1000000,
  },
  {
    role: Role.REQUESTER,
    label: 'Requester',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    email: 'requester@mvpayments.com',
    password: 'Requester@12345',
    name: 'Amit Patel',
    designation: 'Operations Lead',
    limit: 0,
  },
];

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

  // Quick Demo Login bypass with authentic backend credentials or mock fallback
  const handleDemoLogin = async (profile: typeof DEMO_ACCOUNTS[0]) => {
    try {
      if (profile.password) {
        await login(profile.email, profile.password);
        const currentUser = useAuthStore.getState().user;
        toast.success(`Signed in as ${profile.name} (${profile.label})`);
        if (currentUser) {
          redirectByRole(currentUser);
        } else {
          redirectByRole({
            ...profile,
            id: `usr_demo_${profile.role.toLowerCase()}`,
            fullName: profile.name,
            companyId: 'comp_mv_global',
            departmentId: 'dept_finance',
            isActive: true,
            createdAt: '2026-01-15T08:00:00Z',
            updatedAt: new Date().toISOString(),
          } as User);
        }
        return;
      }
    } catch (err) {
      console.warn('Real login attempt for demo account failed, using mock session fallback:', err);
    }

    const mockUser: User = {
      id: `usr_demo_${profile.role.toLowerCase()}`,
      email: profile.email,
      fullName: profile.name,
      role: profile.role,
      companyId: 'comp_mv_global',
      departmentId: 'dept_finance',
      designation: profile.designation,
      approvalLimit: profile.limit,
      isActive: true,
      createdAt: '2026-01-15T08:00:00Z',
      updatedAt: new Date().toISOString(),
    };

    login(mockUser, `mv_demo_jwt_token_${profile.role.toLowerCase()}`);
    toast.success(`Signed in as ${profile.name} (${profile.label})`);
    redirectByRole(mockUser);
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Logo size="lg" to="/login" showSubtitle={false} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Sign In to MV Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enterprise Payment Approval & Financial Authorization System
          </p>
        </div>

        {/* Security / Throttling / Lockout Alerts */}
        {isLocked && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3 text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block mb-0.5">Account Suspended</span>
              {errorMessage}
            </div>
          </div>
        )}

        {lockoutRemaining > 0 && !isLocked && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-3 text-amber-800 dark:text-amber-200">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block mb-0.5">
                Sign-In Throttled ({lockoutRemaining}s remaining)
              </span>
              Too many consecutive failed attempts. To protect your organization, access is
              temporarily paused.
            </div>
          </div>
        )}

        {errorMessage && !isLocked && lockoutRemaining === 0 && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3 text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block mb-0.5">Authentication Error</span>
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
              placeholder="name@company.com"
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
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Password
              </span>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-navy-700 hover:text-navy-900 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                tabIndex={-1}
              >
                Forgot Password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••••••"
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
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-navy-800 focus:ring-navy-600 dark:border-dark-border dark:bg-dark-card dark:checked:bg-navy-700 transition"
                disabled={isSubmitting || lockoutRemaining > 0}
                {...register('rememberMe')}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Remember this device for 30 days
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Verifying credentials..."
            disabled={isSubmitting || lockoutRemaining > 0}
            rightIcon={lockoutRemaining === 0 ? <ArrowRight className="w-4 h-4" /> : undefined}
            className="mt-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white shadow-md shadow-emerald-700/20"
          >
            {lockoutRemaining > 0 ? `Locked for ${lockoutRemaining}s` : 'Sign In to Account'}
          </Button>
        </form>

        {/* Demo Fast Logins Section */}
        <div className="pt-4 border-t border-slate-100 dark:border-dark-border">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Quick Demo Access
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">1-click roles</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => handleDemoLogin(account)}
                className="flex flex-col items-start p-2 rounded-lg border border-slate-200 dark:border-dark-border hover:border-emerald-600 dark:hover:border-emerald-400/80 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-dark-card transition text-left group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    {account.label}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${account.badgeColor}`}
                  >
                    {account.role}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">
                  {account.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* System Setup Link (Initial Provisioning) */}
        <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          First-time deployment?{' '}
          <Link
            to="/setup"
            className="font-semibold text-navy-800 dark:text-cyan-400 hover:underline"
          >
            Initialize Root Administrator
          </Link>
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
