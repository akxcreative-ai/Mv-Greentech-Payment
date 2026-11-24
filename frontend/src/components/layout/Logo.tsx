import React from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
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
  const badgeSizes = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-11 h-11 rounded-2xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
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
      {/* MV Greentech Gradient Badge matching CRM */}
      <div
        className={cn(
          'bg-gradient-to-tr from-blue-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 transition-transform duration-200 group-hover:scale-105',
          badgeSizes[size]
        )}
      >
        <Layers className={cn('text-white drop-shadow-sm', iconSizes[size])} />
      </div>

      {/* Brand Typography matching MV Greentech CRM */}
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              'font-extrabold tracking-wider text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors uppercase',
              textSizes[size]
            )}
          >
            MV GREENTECH
          </span>
          {showSubtitle && (
            <span
              className={cn(
                'text-teal-600 dark:text-teal-400 font-bold tracking-widest uppercase mt-0.5',
                subtitleSizes[size]
              )}
            >
              Payment Approval Portal
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
