import React from 'react';
import { cn } from '@/utils/cn';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'purple'
  | 'outline';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  dotColor?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400 dark:bg-slate-500',
  },
  secondary: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  primary: {
    badge: 'bg-navy-50 text-navy-800 border-navy-200 dark:bg-navy-900/60 dark:text-navy-200 dark:border-navy-700',
    dot: 'bg-navy-600 dark:bg-navy-400',
  },
  draft: {
    badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  pending: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  approved: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  rejected: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  success: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  danger: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  info: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    dot: 'bg-sky-500',
  },
  purple: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  outline: {
    badge: 'bg-transparent text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] font-medium px-2 py-0.5 gap-1.5 rounded-md',
  md: 'text-xs font-semibold px-2.5 py-1 gap-1.5 rounded-md',
  lg: 'text-sm font-semibold px-3 py-1.5 gap-2 rounded-lg',
};

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  dotColor,
  icon,
  children,
  ...props
}) => {
  const currentVariant = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={cn(
        'inline-flex items-center border select-none transition-colors duration-150 whitespace-nowrap',
        currentVariant.badge,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            dotColor || currentVariant.dot
          )}
        />
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
