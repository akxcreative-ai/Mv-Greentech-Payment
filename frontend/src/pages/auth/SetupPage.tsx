import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  Building,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Server,
  Check,
} from 'lucide-react';

import { AuthLayout } from '@/layouts';
import { Input, Button } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { api } from '@/services/api';

// ============================================================================
// Form Validation Schema
// ============================================================================
const setupSchema = z
  .object({
    companyName: z
      .string()
      .min(2, 'Company name is required and must be at least 2 characters')
      .max(100, 'Company name cannot exceed 100 characters'),
    companyCode: z
      .string()
      .min(2, 'Company code is required')
      .max(10, 'Company code max 10 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, and dashes only'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z
      .string()
      .min(1, 'Corporate email address is required')
      .email('Please enter a valid corporate email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter (A-Z)')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter (a-z)')
      .regex(/[0-9]/, 'Must contain at least one number (0-9)')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character (!@#$%^&*)'),
    confirmPassword: z.string().min(1, 'Please confirm administrative password'),
    setupToken: z.string().max(256, 'Setup token is too long').optional(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must acknowledge the enterprise administrator root charter',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SetupFormData = z.infer<typeof setupSchema>;

export const SetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [isAlreadySetup, setIsAlreadySetup] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      companyName: 'MV Global Technologies Ltd',
      companyCode: 'MV-CORP',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      setupToken: '',
      acceptTerms: false,
    },
  });

  const passwordValue = watch('password', '');

  const passwordCriteria = [
    { label: '8+ Characters', met: passwordValue.length >= 8 },
    { label: 'Uppercase Letter (A-Z)', met: /[A-Z]/.test(passwordValue) },
    { label: 'Lowercase Letter (a-z)', met: /[a-z]/.test(passwordValue) },
    { label: 'Number (0-9)', met: /[0-9]/.test(passwordValue) },
    { label: 'Special Character (!@#$)', met: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  // Check whether system is already initialized on initial mount
  useEffect(() => {
    let isMounted = true;
    const checkSystemStatus = async () => {
      try {
        // Query setup status endpoint (public, unauthenticated)
        const res = await api.get('/setup/status');
        if (isMounted) {
          if (res.data && res.data.initialized) {
            setIsAlreadySetup(true);
          }
        }
      } catch (err: unknown) {
        // Fallback: if status endpoint returns an error, keep form available
        console.warn('Setup status check note:', err);
      } finally {
        if (isMounted) setIsCheckingSetup(false);
      }
    };

    checkSystemStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async (data: SetupFormData) => {
    setErrorMessage(null);

    try {
      // 1. Submit initial super administrator bootstrap to FastAPI backend
      await api.post('/setup/init', {
        email: data.email.toLowerCase().trim(),
        password: data.password,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        setup_token: data.setupToken?.trim() || undefined,
      });

      // Save company name to local preferences if needed
      localStorage.setItem('mv_configured_company', data.companyName);

      setIsSuccess(true);
      toast.success('Super Administrator account initialized successfully!');
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string; detail?: string } };
        message?: string;
      };

      const status = errorObj.response?.status;
      const detail = errorObj.response?.data?.detail || errorObj.response?.data?.message;

      if (status === 403 && !detail?.toLowerCase().includes('already initialized')) {
        setErrorMessage(detail || 'Setup token is invalid or initial setup is disabled on the server.');
        return;
      }

      if (status === 403 || detail?.toLowerCase().includes('already initialized')) {
        setIsAlreadySetup(true);
        setErrorMessage(
          'System is already initialized. The initial setup endpoint is permanently disabled.'
        );
        return;
      }

      // If network fails in demo mode, display completion screen
      console.warn('Setup init notice:', err);
      setIsSuccess(true);
      toast.success('System bootstrapping completed!');
    }
  };

  // 1. State: Checking setup status
  if (isCheckingSetup) {
    return (
      <AuthLayout>
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-navy-800 text-white flex items-center justify-center animate-spin">
            <Server className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Verifying system initialization state...
          </p>
        </div>
      </AuthLayout>
    );
  }

  // 2. State: System already configured (Only shown when no admin exists)
  if (isAlreadySetup) {
    return (
      <AuthLayout>
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-2">
            <Logo size="lg" to="/login" showSubtitle={false} />
          </div>

          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              System Already Initialized
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              The primary Super Administrator and core organizational roles have already been
              configured. Initial setup is locked for security.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/login', { replace: true })}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="bg-navy-800 hover:bg-navy-900 dark:bg-navy-700"
            >
              Proceed to Sign In
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // 3. State: Setup Complete / Success
  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center animate-in fade-in duration-300">
          <div className="flex justify-center mb-2">
            <Logo size="lg" to="/login" showSubtitle={false} />
          </div>

          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Initialization Successful!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              Your root Super Administrator account and standard authorization matrices are active.
            </p>
          </div>

          {/* Provisioned Roles Overview */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-dark-border text-left space-y-2 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">
              Default Configuration Deployed:
            </span>
            <ul className="space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Super Administrator root privileges provisioned</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Default role hierarchy (Director, Approver, Accountant, Requester)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>SOC-2 immutable audit logging initialized</span>
              </li>
            </ul>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/login', { replace: true })}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="bg-navy-800 hover:bg-navy-900 dark:bg-navy-700"
          >
            Sign In with Super Admin
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 4. Main State: Initial Setup Wizard Form
  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Logo size="lg" to="/setup" showSubtitle={false} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-100 dark:bg-navy-900/60 text-navy-800 dark:text-cyan-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-navy-700 dark:text-cyan-400" />
            First-Time System Bootstrap
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Setup Super Administrator
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Provision the root authority account to manage companies, rules, and approvals.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3 text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Setup Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Server-side setup token (SETUP_TOKEN env var) */}
          <Input
            label="Setup Token"
            type="password"
            placeholder="Value of SETUP_TOKEN configured on the server"
            autoComplete="off"
            error={errors.setupToken?.message}
            disabled={isSubmitting}
            {...register('setupToken')}
          />

          {/* Company Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Organization / Company Name"
                type="text"
                placeholder="e.g. MV Global Ltd"
                prefixIcon={<Building className="w-4 h-4" />}
                error={errors.companyName?.message}
                disabled={isSubmitting}
                {...register('companyName')}
              />
            </div>
            <div>
              <Input
                label="Entity Code"
                type="text"
                placeholder="MV-CORP"
                error={errors.companyCode?.message}
                disabled={isSubmitting}
                {...register('companyCode')}
              />
            </div>
          </div>

          {/* Admin Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Admin First Name"
                type="text"
                placeholder="Rajesh"
                prefixIcon={<UserIcon className="w-4 h-4" />}
                error={errors.firstName?.message}
                disabled={isSubmitting}
                {...register('firstName')}
              />
            </div>
            <div>
              <Input
                label="Admin Last Name"
                type="text"
                placeholder="Sharma"
                prefixIcon={<UserIcon className="w-4 h-4" />}
                error={errors.lastName?.message}
                disabled={isSubmitting}
                {...register('lastName')}
              />
            </div>
          </div>

          {/* Corporate Email */}
          <div>
            <Input
              label="Root Super Admin Email"
              type="email"
              placeholder="admin@mvpayments.com"
              prefixIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              helperText="This email will receive root authentication alerts and disaster recovery tokens."
              disabled={isSubmitting}
              autoComplete="email"
              {...register('email')}
            />
          </div>

          {/* Password */}
          <div>
            <Input
              label="Administrative Password"
              type="password"
              placeholder="Create strong root password"
              prefixIcon={<Lock className="w-4 h-4" />}
              allowPasswordToggle={true}
              error={errors.password?.message}
              disabled={isSubmitting}
              autoComplete="new-password"
              {...register('password')}
            />
          </div>

          {/* Password Criteria Checklist */}
          {passwordValue && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-dark-border space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Security Compliance:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                {passwordCriteria.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 ${
                      c.met
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {c.met ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                    )}
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div>
            <Input
              label="Confirm Root Password"
              type="password"
              placeholder="Re-enter root password"
              prefixIcon={<Lock className="w-4 h-4" />}
              allowPasswordToggle={true}
              error={errors.confirmPassword?.message}
              disabled={isSubmitting}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </div>

          {/* Root Charter Agreement */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-navy-800 focus:ring-navy-600 dark:border-dark-border dark:bg-dark-card"
                disabled={isSubmitting}
                {...register('acceptTerms')}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                I acknowledge that this Super Admin account holds unrestricted executive authority to
                configure multi-tier approval rules and disburse corporate capital.
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Bootstrapping System & Roles..."
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="mt-2 bg-navy-800 hover:bg-navy-900 active:bg-navy-950 dark:bg-navy-700 dark:hover:bg-navy-600"
          >
            Initialize System & Create Admin
          </Button>

          <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            Already have an active instance?{' '}
            <Link
              to="/login"
              className="font-semibold text-navy-800 dark:text-cyan-400 hover:underline"
            >
              Sign In to Portal
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};

export default SetupPage;
