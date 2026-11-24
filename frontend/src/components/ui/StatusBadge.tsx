import React from 'react';
import {
  FileEdit,
  Send,
  Clock,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  CheckCheck,
  Ban,
  AlertCircle,
  RefreshCw,
  MinusCircle,
} from 'lucide-react';
import { RequestStatus, PaymentStatus, ApprovalAction } from '@/types';
import { cn } from '@/utils/cn';

export type StatusValue =
  | RequestStatus
  | PaymentStatus
  | ApprovalAction
  | string;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusValue;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  showDot?: boolean;
  label?: string;
}

interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const statusConfigMap: Record<string, StatusConfig> = {
  // Request Statuses
  [RequestStatus.DRAFT]: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
    icon: FileEdit,
  },
  [RequestStatus.SUBMITTED]: {
    label: 'Submitted',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    dotClass: 'bg-blue-500',
    icon: Send,
  },
  [RequestStatus.UNDER_REVIEW]: {
    label: 'Under Review',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    dotClass: 'bg-indigo-500',
    icon: Clock,
  },
  [RequestStatus.PENDING_APPROVAL]: {
    label: 'Pending Approval',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    dotClass: 'bg-indigo-500',
    icon: Clock,
  },
  [RequestStatus.CLARIFICATION_REQUESTED]: {
    label: 'Clarification Needed',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: HelpCircle,
  },
  [RequestStatus.CLARIFICATION_REQUIRED]: {
    label: 'Clarification Needed',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: HelpCircle,
  },
  [RequestStatus.APPROVED]: {
    label: 'Approved',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  [RequestStatus.REJECTED]: {
    label: 'Rejected',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-500',
    icon: XCircle,
  },
  [RequestStatus.PAYMENT_SCHEDULED]: {
    label: 'Payment Scheduled',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
    dotClass: 'bg-cyan-500',
    icon: Calendar,
  },
  [RequestStatus.PAYMENT_PROCESSING]: {
    label: 'Payment Processing',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: RefreshCw,
  },
  [RequestStatus.PAID]: {
    label: 'Paid',
    badgeClass: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
    dotClass: 'bg-green-500',
    icon: CheckCheck,
  },
  [RequestStatus.COMPLETED]: {
    label: 'Completed',
    badgeClass: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
    dotClass: 'bg-green-500',
    icon: CheckCheck,
  },
  [RequestStatus.CANCELLED]: {
    label: 'Cancelled',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dotClass: 'bg-gray-400',
    icon: Ban,
  },
  [RequestStatus.ON_HOLD]: {
    label: 'On Hold',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: Clock,
  },

  // Payment Record Statuses
  [PaymentStatus.INITIATED]: {
    label: 'Initiated',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    dotClass: 'bg-blue-500',
    icon: Clock,
  },
  [PaymentStatus.PROCESSING]: {
    label: 'Processing',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: RefreshCw,
  },
  [PaymentStatus.SUCCESS]: {
    label: 'Success',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  [PaymentStatus.FAILED]: {
    label: 'Failed',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-500',
    icon: AlertCircle,
  },

  // Approval Actions
  [ApprovalAction.PENDING]: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: Clock,
  },
  [ApprovalAction.SKIPPED]: {
    label: 'Skipped',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dotClass: 'bg-slate-400',
    icon: MinusCircle,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  showDot = false,
  label: customLabel,
  className,
  ...props
}) => {
  const normalizedKey = String(status).toUpperCase();
  const config = statusConfigMap[normalizedKey] || {
    label: customLabel || normalizedKey.replace(/_/g, ' '),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    dotClass: 'bg-slate-400',
    icon: Clock,
  };

  const Icon = config.icon;
  const displayLabel = customLabel || config.label;

  const sizeClasses = {
    sm: 'text-[11px] font-medium px-2 py-0.5 gap-1.5 rounded-md',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5 rounded-md',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center border select-none transition-colors duration-150 whitespace-nowrap shadow-xs',
        config.badgeClass,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dotClass)} />}
      {showIcon && <Icon className={cn('shrink-0', iconSizes[size])} />}
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusBadge;
