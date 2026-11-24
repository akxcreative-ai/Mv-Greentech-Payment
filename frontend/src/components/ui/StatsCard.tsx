import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from './LoadingSpinner';

export type StatsCardColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'neutral';

export interface StatsTrend {
  value: string | number;
  isUp?: boolean;
  isNeutral?: boolean;
  label?: string; // e.g. "vs last month"
}

export interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  label?: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: StatsTrend;
  color?: StatsCardColor;
  subtitle?: string;
  isLoading?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

const colorVariants: Record<
  StatsCardColor,
  {
    iconBg: string;
    iconText: string;
    borderTop?: string;
  }
> = {
  primary: {
    iconBg: 'bg-navy-50 dark:bg-navy-950/60 border border-navy-200 dark:border-navy-800',
    iconText: 'text-navy-800 dark:text-cyan-400',
    borderTop: 'border-t-4 border-t-navy-800 dark:border-t-cyan-500',
  },
  success: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    borderTop: 'border-t-4 border-t-emerald-600 dark:border-t-emerald-500',
  },
  warning: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800',
    iconText: 'text-amber-600 dark:text-amber-400',
    borderTop: 'border-t-4 border-t-amber-500',
  },
  danger: {
    iconBg: 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800',
    iconText: 'text-rose-600 dark:text-rose-400',
    borderTop: 'border-t-4 border-t-rose-600 dark:border-t-rose-500',
  },
  info: {
    iconBg: 'bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800',
    iconText: 'text-sky-600 dark:text-sky-400',
    borderTop: 'border-t-4 border-t-sky-600 dark:border-t-sky-500',
  },
  purple: {
    iconBg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800',
    iconText: 'text-purple-600 dark:text-purple-400',
    borderTop: 'border-t-4 border-t-purple-600',
  },
  neutral: {
    iconBg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
    iconText: 'text-slate-600 dark:text-slate-300',
    borderTop: 'border-t-4 border-t-slate-400',
  },
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  label,
  value,
  icon,
  trend,
  color = 'primary',
  subtitle,
  isLoading = false,
  clickable = false,
  onClick,
  className,
  ...props
}) => {
  const displayLabel = label || title || '';
  const styles = colorVariants[color] || colorVariants.primary;
  const isInteractive = Boolean(onClick || clickable);

  if (isLoading) {
    return (
      <div
        className={cn(
          'p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm space-y-4',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <Skeleton width="40%" height={16} />
          <Skeleton width={40} height={40} rounded="lg" />
        </div>
        <Skeleton width="60%" height={32} />
        <Skeleton width="50%" height={14} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm transition-all duration-200 flex flex-col justify-between',
        isInteractive &&
          'hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-navy-600 cursor-pointer',
        className
      )}
      {...props}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {displayLabel}
          </p>

          {icon && (
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-150',
                styles.iconBg,
                styles.iconText,
                isInteractive && 'group-hover:scale-105'
              )}
            >
              {icon}
            </div>
          )}
        </div>

        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-2">
          {value}
        </div>
      </div>

      {(trend || subtitle) && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-dark-border/60 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded',
                trend.isNeutral
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  : trend.isUp
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
              )}
            >
              {trend.isNeutral ? (
                <Minus className="w-3 h-3" />
              ) : trend.isUp ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.value}</span>
            </span>
          )}

          {trend?.label ? (
            <span className="text-slate-400 dark:text-slate-500 truncate">{trend.label}</span>
          ) : subtitle ? (
            <span className="text-slate-400 dark:text-slate-500 truncate">{subtitle}</span>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
