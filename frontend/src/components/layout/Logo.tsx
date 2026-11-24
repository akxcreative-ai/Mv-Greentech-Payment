import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export interface LogoProps {
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
  to?: string;
  className?: string;
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  compact = false,
  size = 'md',
  to = '/',
  className,
  showSubtitle = true,
}) => {
  const imgSizes = {
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-14 w-auto',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
  };

  const content = (
    <div className={cn('inline-flex items-center gap-3 select-none group', className)}>
      {/* Official MV GREENTECH Logo Image */}
      <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200 shrink-0 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="MV Greentech"
          className={cn('object-contain', imgSizes[size])}
        />
      </div>

      {/* Brand Typography */}
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              'font-extrabold tracking-wider text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors uppercase font-sans',
              textSizes[size]
            )}
          >
            MV GREENTECH
          </span>
          {showSubtitle && (
            <span
              className={cn(
                'text-emerald-700 dark:text-emerald-400 font-bold tracking-widest uppercase mt-0.5',
                subtitleSizes[size]
              )}
            >
              Payment Approval
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
