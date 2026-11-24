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
    sm: 'h-9 w-auto',
    md: 'h-11 w-auto',
    lg: 'h-16 w-auto',
  };

  const textSizes = {
    sm: 'text-sm font-black',
    md: 'text-base font-black',
    lg: 'text-lg font-black',
  };

  const subtitleSizes = {
    sm: 'text-[10px] font-extrabold',
    md: 'text-[11px] font-extrabold',
    lg: 'text-xs font-extrabold',
  };

  const content = (
    <div className={cn('inline-flex items-center gap-3.5 select-none group', className)}>
      {/* Official MV GREENTECH Logo Image */}
      <div className="bg-white p-1.5 rounded-xl shadow-xs border border-slate-200 shrink-0 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="MV Greentech"
          className={cn('object-contain', imgSizes[size])}
        />
      </div>

      {/* Brand Typography - Bold, crisp and readable on every monitor */}
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              'tracking-wider text-slate-900 group-hover:text-emerald-800 transition-colors uppercase font-sans',
              textSizes[size]
            )}
          >
            MV GREENTECH
          </span>
          {showSubtitle && (
            <span
              className={cn(
                'text-emerald-700 tracking-widest uppercase mt-0.5',
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
