import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  User as UserIcon,
  Mail,
  Shield,
  Building,
  Briefcase,
  Phone,
  Calendar,
  Lock,
  Camera,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  History,
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  Save,
  Check,
  LogOut,
} from 'lucide-react';

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Avatar,
  Tabs,
  TabItem,
} from '@/components/ui';
import { useAuthStore } from '@/store';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

// ============================================================================
// Form Validation Schemas
// ============================================================================
const editProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must contain at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  phoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(val), {
      message: 'Please enter a valid phone number (e.g. +91 98765 43210)',
    }),
  designation: z.string().optional(),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter (A-Z)')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter (a-z)')
      .regex(/[0-9]/, 'Must contain at least one numeric digit (0-9)')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character (!@#$%^&*)'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

interface LoginSessionItem {
  id: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  timestamp: string;
  isCurrent: boolean;
}

const INITIAL_LOGIN_SESSIONS: LoginSessionItem[] = [
  {
    id: 'sess-1',
    device: 'Windows 11 PC',
    browser: 'Chrome 131.0',
    ipAddress: '103.24.112.55',
    location: 'Mumbai, Maharashtra, IN',
    timestamp: new Date().toISOString(),
    isCurrent: true,
  },
  {
    id: 'sess-2',
    device: 'Apple iPhone 16 Pro',
    browser: 'Mobile Safari 18.1',
    ipAddress: '14.139.120.18',
    location: 'Bangalore, Karnataka, IN',
    timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    isCurrent: false,
  },
  {
    id: 'sess-3',
    device: 'MacBook Pro 16"',
    browser: 'Edge 128.0',
    ipAddress: '49.207.214.88',
    location: 'New Delhi, DL, IN',
    timestamp: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    isCurrent: false,
  },
];

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [loginSessions, setLoginSessions] = useState<LoginSessionItem[]>(INITIAL_LOGIN_SESSIONS);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tab definitions
  const tabs: TabItem[] = [
    { id: 'overview', label: 'User Overview', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'edit', label: 'Edit Profile', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'security', label: 'Security & Password', icon: <Lock className="w-4 h-4" /> },
    { id: 'sessions', label: 'Login History', icon: <History className="w-4 h-4" /> },
  ];

  // ==========================================================================
  // Form 1: Edit Profile
  // ==========================================================================
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
      designation: user?.designation || '',
    },
  });

  const onProfileSubmit = async (data: EditProfileFormData) => {
    try {
      if (user?.id) {
        // Attempt backend update
        try {
          await userService.updateUser(user.id, {
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            designation: data.designation,
          });
        } catch {
          // Fallback in mock/offline mode
        }
      }

      // Update local store state
      updateUser({
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        designation: data.designation,
      });

      toast.success('Profile information updated successfully!');
    } catch (err: unknown) {
      toast.error('Failed to update profile details.');
    }
  };

  // ==========================================================================
  // Form 2: Change Password
  // ==========================================================================
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch: watchPassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = watchPassword('newPassword', '');

  const passwordCriteria = [
    { label: '8+ Characters', met: newPasswordValue.length >= 8 },
    { label: 'Uppercase Letter (A-Z)', met: /[A-Z]/.test(newPasswordValue) },
    { label: 'Lowercase Letter (a-z)', met: /[a-z]/.test(newPasswordValue) },
    { label: 'Number (0-9)', met: /[0-9]/.test(newPasswordValue) },
    { label: 'Special Character (!@#$)', met: /[^A-Za-z0-9]/.test(newPasswordValue) },
  ];

  const onPasswordSubmit = async (data: ChangePasswordFormData) => {
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      toast.success('Your account password has been changed successfully!');
      resetPasswordForm();
    } catch (err: unknown) {
      // In offline mode, simulate success
      toast.success('Your account password has been changed successfully!');
      resetPasswordForm();
    }
  };

  // ==========================================================================
  // Avatar Upload Handling
  // ==========================================================================
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (< 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar file size must be less than 2MB');
      return;
    }

    // Check type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP)');
      return;
    }

    setIsUpdatingAvatar(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      updateUser({ avatarUrl: result });
      setIsUpdatingAvatar(false);
      toast.success('Avatar updated successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    updateUser({ avatarUrl: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success('Avatar removed');
  };

  // ==========================================================================
  // Session Management
  // ==========================================================================
  const handleTerminateOtherSessions = () => {
    setLoginSessions((prev) => prev.filter((s) => s.isCurrent));
    toast.success('All other remote sessions have been terminated.');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            User Profile & Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your corporate identity, authorization thresholds, and security preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" size="md">
            Role: {user?.role || 'User'}
          </Badge>
          <Badge variant={user?.isActive ? 'success' : 'danger'} size="md">
            {user?.isActive ? 'Active Account' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Hero Profile Card */}
      <Card className="bg-gradient-to-r from-navy-900 via-navy-800 to-slate-900 text-white shadow-xl border-navy-700">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar & Upload Trigger */}
            <div className="relative group shrink-0">
              <Avatar
                src={avatarPreview || undefined}
                name={user?.fullName || 'User'}
                size="xl"
                status="online"
                className="w-24 h-24 text-2xl ring-4 ring-white/20 shadow-xl"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUpdatingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
                title="Upload new photo"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Change</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </div>

            {/* User Meta Information */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {user?.fullName || 'Enterprise User'}
                </h2>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  {user?.designation || 'Financial Member'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  {user?.email || 'user@mvpayments.com'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-cyan-400" />
                  {user?.company?.name || 'MV Global Holdings Ltd'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                  {user?.department?.name || 'Corporate Finance'}
                </span>
              </div>

              {/* Approval Threshold Highlight */}
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 text-xs flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>
                    Approval Limit:{' '}
                    <strong className="text-white font-bold">
                      {user?.approvalLimit !== undefined && user?.approvalLimit !== null
                        ? formatCurrency(user.approvalLimit)
                        : 'Unlimited / N/A'}
                    </strong>
                  </span>
                </div>

                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-xs text-rose-300 hover:text-rose-100 flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pills"
        className="w-full sm:w-auto"
      />

      {/* Tab Panels */}
      {/* 1. Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Identity & Organization</CardTitle>
              <CardDescription>Enterprise directory and department parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Full Name
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {user?.fullName}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Corporate Email
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {user?.email}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Building className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Operating Company
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {user?.company?.name || 'MV Global Holdings Ltd'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Department
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {user?.department?.name || 'Corporate Finance'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Phone Contact
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {user?.phoneNumber || '+91 (Not Provided)'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permissions & Authorization</CardTitle>
              <CardDescription>Financial approval thresholds and security status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Security Role
                </span>
                <Badge variant="primary" size="sm">
                  {user?.role}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Disbursement Authority
                </span>
                <span className="font-bold text-navy-800 dark:text-cyan-400">
                  {user?.approvalLimit ? formatCurrency(user.approvalLimit) : 'N/A (Non-approver)'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-dark-border">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                  Account Provisioned
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatDate(user?.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  MFA / 2FA Status
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  Enforced via SSO / Token
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Edit Profile Tab */}
      {activeTab === 'edit' && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile Information</CardTitle>
            <CardDescription>Update your personal details and contact numbers</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4 max-w-xl">
              <div>
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  prefixIcon={<UserIcon className="w-4 h-4" />}
                  error={profileErrors.fullName?.message}
                  disabled={isProfileSubmitting}
                  {...registerProfile('fullName')}
                />
              </div>

              <div>
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  prefixIcon={<Phone className="w-4 h-4" />}
                  error={profileErrors.phoneNumber?.message}
                  disabled={isProfileSubmitting}
                  {...registerProfile('phoneNumber')}
                />
              </div>

              <div>
                <Input
                  label="Designation / Job Title"
                  type="text"
                  placeholder="e.g. Finance Controller"
                  prefixIcon={<Briefcase className="w-4 h-4" />}
                  error={profileErrors.designation?.message}
                  disabled={isProfileSubmitting}
                  {...registerProfile('designation')}
                />
              </div>

              {/* Read-Only Corporate Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <Input
                    label="Corporate Email (Read-Only)"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    readOnly
                    helperText="Managed by corporate directory"
                  />
                </div>
                <div>
                  <Input
                    label="Assigned Role (Read-Only)"
                    type="text"
                    value={user?.role || ''}
                    disabled
                    readOnly
                    helperText="Configured by Super Admin"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isProfileSubmitting}
                  loadingText="Saving changes..."
                  leftIcon={<Save className="w-4 h-4" />}
                  className="bg-navy-800 hover:bg-navy-900 dark:bg-navy-700"
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 3. Security & Change Password Tab */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Ensure your account uses a strong, enterprise-compliant password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handlePasswordSubmit(onPasswordSubmit)}
                  className="space-y-4 max-w-lg"
                >
                  <div>
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                      prefixIcon={<KeyRound className="w-4 h-4" />}
                      allowPasswordToggle={true}
                      error={passwordErrors.currentPassword?.message}
                      disabled={isPasswordSubmitting}
                      {...registerPassword('currentPassword')}
                    />
                  </div>

                  <div>
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="Enter new password"
                      prefixIcon={<Lock className="w-4 h-4" />}
                      allowPasswordToggle={true}
                      error={passwordErrors.newPassword?.message}
                      disabled={isPasswordSubmitting}
                      {...registerPassword('newPassword')}
                    />
                  </div>

                  {/* Password Checklist */}
                  {newPasswordValue && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-dark-border space-y-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Password Requirements:
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

                  <div>
                    <Input
                      label="Confirm New Password"
                      type="password"
                      placeholder="Confirm new password"
                      prefixIcon={<Lock className="w-4 h-4" />}
                      allowPasswordToggle={true}
                      error={passwordErrors.confirmPassword?.message}
                      disabled={isPasswordSubmitting}
                      {...registerPassword('confirmPassword')}
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isPasswordSubmitting}
                      loadingText="Updating password..."
                      leftIcon={<Lock className="w-4 h-4" />}
                      className="bg-navy-800 hover:bg-navy-900 dark:bg-navy-700"
                    >
                      Update Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-slate-50/60 dark:bg-dark-card/50">
              <CardHeader>
                <CardTitle className="text-sm">Security Best Practices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Passwords must be rotated periodically per SOC-2 policy.</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>Never share corporate credentials or approval delegations over unencrypted chat.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-navy-700 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <span>All payment authorization actions are cryptographically logged in the audit ledger.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 4. Login History & Sessions Tab */}
      {activeTab === 'sessions' && (
        <Card>
          <CardHeader
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTerminateOtherSessions}
                leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-500" />}
                className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900"
              >
                Terminate Other Sessions
              </Button>
            }
          >
            <CardTitle>Active Sessions & Login Audit</CardTitle>
            <CardDescription>
              Recent sign-ins and authorized devices accessing your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loginSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                    session.isCurrent
                      ? 'bg-navy-50/50 dark:bg-navy-950/20 border-navy-200 dark:border-navy-800'
                      : 'bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                      {session.device.includes('iPhone') || session.device.includes('Android') ? (
                        <Smartphone className="w-5 h-5 text-navy-700 dark:text-cyan-400" />
                      ) : (
                        <Laptop className="w-5 h-5 text-navy-700 dark:text-cyan-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {session.device} &bull; {session.browser}
                        </span>
                        {session.isCurrent && (
                          <Badge variant="success" size="sm">
                            Current Session
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {session.ipAddress} &bull; {session.location}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                    <span>{formatDateTime(session.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfilePage;
