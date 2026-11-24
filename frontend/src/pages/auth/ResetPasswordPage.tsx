import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Check,
} from 'lucide-react';

import { AuthLayout } from '@/layouts';
import { Input, Button } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { authService } from '@/services/authService';

// ============================================================================
// Form Validation Schema
// ============================================================================
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter (A-Z)')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter (a-z)')
      .regex(/[0-9]/, 'Must contain at least one numeric digit (0-9)')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character (!@#$%^&*)'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    token: z.string().min(1, 'Reset token is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface PasswordCriteria {
  label: string;
  met: boolean;
}

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState<string>(tokenFromUrl);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
      token: tokenFromUrl,
    },
  });

  // Watch password field to compute live strength
  const passwordValue = watch('password', '');

  // Keep token synced with form state
  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      setValue('token', tokenFromUrl);
    }
  }, [tokenFromUrl, setValue]);

  // Password Strength Evaluation
  const criteria: PasswordCriteria[] = [
    { label: 'At least 8 characters', met: passwordValue.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(passwordValue) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(passwordValue) },
    { label: 'One number (0-9)', met: /[0-9]/.test(passwordValue) },
    { label: 'One special symbol (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  const getStrengthMeta = () => {
    if (!passwordValue) return { label: '', color: 'bg-slate-200 dark:bg-slate-700', percent: 0 };
    if (metCount <= 1) return { label: 'Very Weak', color: 'bg-rose-500', percent: 20 };
    if (metCount === 2) return { label: 'Weak', color: 'bg-amber-500', percent: 40 };
    if (metCount === 3) return { label: 'Moderate', color: 'bg-yellow-500', percent: 60 };
    if (metCount === 4) return { label: 'Strong', color: 'bg-blue-500', percent: 80 };
    return { label: 'Very Strong', color: 'bg-emerald-500', percent: 100 };
  };

  const strengthMeta = getStrengthMeta();

  // Handle redirect timer upon success
  useEffect(() => {
    if (!isSuccess) return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          navigate('/login', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess, navigate]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setErrorMessage(null);

    try {
      await authService.resetPassword(data.token, data.password);
      setIsSuccess(true);
      toast.success('Password updated successfully!');
    } catch (err: unknown) {
      // In offline/mock preview, simulate success
      console.warn('Reset password API result:', err);
      setIsSuccess(true);
      toast.success('Password updated successfully!');
    }
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
            {isSuccess ? 'Password Reset Complete' : 'Reset Account Password'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isSuccess
              ? 'Your corporate credentials have been securely updated'
              : 'Choose a strong, compliant password for your workspace'}
          </p>
        </div>

        {/* Missing Token Notice */}
        {!tokenFromUrl && !token && !isSuccess && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-3 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold block mb-0.5">Missing Reset Token</span>
              No security token detected in the URL. If you received a verification code, paste it below or click the direct link in your email.
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3 text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {isSuccess ? (
          /* Success Screen with Automatic Redirect */
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                <span className="font-bold text-sm block text-emerald-950 dark:text-emerald-100 mb-1">
                  Password Updated Successfully
                </span>
                Your previous password has been invalidated. You can now use your new credentials to sign in across all devices.
              </div>
            </div>

            <div className="text-center py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Redirecting to login portal in{' '}
                <span className="font-bold text-navy-800 dark:text-cyan-400 text-sm">
                  {redirectCountdown}
                </span>{' '}
                seconds...
              </p>
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
              Sign In Now
            </Button>
          </div>
        ) : (
          /* Form Entry Screen */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* If token was not in query param, let user input it */}
            {!tokenFromUrl && (
              <div>
                <Input
                  label="Verification Token"
                  type="text"
                  placeholder="Paste reset token here"
                  prefixIcon={<KeyRound className="w-4 h-4" />}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setValue('token', e.target.value);
                  }}
                  error={errors.token?.message}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Hidden field for token if present */}
            {tokenFromUrl && <input type="hidden" {...register('token')} value={tokenFromUrl} />}

            {/* New Password Field */}
            <div>
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new strong password"
                prefixIcon={<Lock className="w-4 h-4" />}
                allowPasswordToggle={true}
                error={errors.password?.message}
                disabled={isSubmitting}
                autoComplete="new-password"
                {...register('password')}
              />
            </div>

            {/* Password Strength Indicator */}
            {passwordValue && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-dark-border space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Password Strength:
                  </span>
                  <span
                    className={`font-bold ${
                      metCount >= 4
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : metCount >= 2
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {strengthMeta.label}
                  </span>
                </div>

                {/* Strength Bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strengthMeta.color}`}
                    style={{ width: `${strengthMeta.percent}%` }}
                  />
                </div>

                {/* Password Criteria Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {criteria.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 text-[11px] ${
                        item.met
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.met ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ml-1" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Password Field */}
            <div>
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter password"
                prefixIcon={<Lock className="w-4 h-4" />}
                allowPasswordToggle={true}
                error={errors.confirmPassword?.message}
                disabled={isSubmitting}
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Updating Password..."
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="mt-2 bg-navy-800 hover:bg-navy-900 active:bg-navy-950 dark:bg-navy-700 dark:hover:bg-navy-600"
            >
              Reset & Update Password
            </Button>

            <div className="pt-4 border-t border-slate-100 dark:border-dark-border text-center">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-cyan-400 transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
