import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'white' | 'slate' | 'success' | 'danger';

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
  fullscreen?: boolean;
}

const sizeStyles: Record<SpinnerSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const colorStyles: Record<SpinnerColor, string> = {
  primary: 'text-navy-700 dark:text-cyan-400',
  white: 'text-white',
  slate: 'text-slate-500 dark:text-slate-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-rose-600 dark:text-rose-400',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  label,
  fullscreen = false,
  className,
  ...props
}) => {
  const content = (
    <div
      className={cn('inline-flex flex-col items-center justify-center gap-3', className)}
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeStyles[size], colorStyles[color])} />
      {label && (
        <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  rounded = 'md',
  width,
  height,
  style,
  ...props
}) => {
  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200/80 dark:bg-slate-700/50',
        roundedClass,
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};

export default LoadingSpinner;
