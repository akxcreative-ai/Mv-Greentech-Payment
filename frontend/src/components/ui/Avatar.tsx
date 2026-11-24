import React, { useState } from 'react';
import { cn } from '@/utils/cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'busy' | 'away' | 'offline';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  alt?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  square?: boolean;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', status: 'w-1.5 h-1.5 ring-1' },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2 h-2 ring-1.5' },
  md: { container: 'w-10 h-10', text: 'text-sm font-semibold', status: 'w-2.5 h-2.5 ring-2' },
  lg: { container: 'w-12 h-12', text: 'text-base font-bold', status: 'w-3 h-3 ring-2' },
  xl: { container: 'w-16 h-16', text: 'text-xl font-bold', status: 'w-3.5 h-3.5 ring-2' },
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500',
  busy: 'bg-rose-500',
  away: 'bg-amber-500',
  offline: 'bg-slate-400',
};

// Generates consistent background colors based on user's name
const getInitialsBg = (name?: string): string => {
  if (!name) return 'bg-navy-800 text-white';

  const colors = [
    'bg-navy-800 text-white',
    'bg-sky-700 text-white',
    'bg-indigo-700 text-white',
    'bg-teal-700 text-white',
    'bg-emerald-700 text-white',
    'bg-cyan-800 text-white',
    'bg-slate-700 text-white',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (name?: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  alt,
  size = 'md',
  status,
  square = false,
  className,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeConfig = sizeClasses[size];
  const initials = getInitials(name);
  const colorScheme = getInitialsBg(name);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center select-none shrink-0 overflow-hidden shadow-xs',
        square ? 'rounded-xl' : 'rounded-full',
        sizeConfig.container,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt || name || 'User avatar'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center font-medium uppercase tracking-wider',
            colorScheme,
            sizeConfig.text
          )}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-white dark:ring-dark-card',
            statusColors[status],
            sizeConfig.status
          )}
        />
      )}
    </div>
  );
};

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: AvatarSize;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  max = 4,
  size = 'md',
  children,
  className,
  ...props
}) => {
  const childrenArray = React.Children.toArray(children);
  const visibleAvatars = childrenArray.slice(0, max);
  const remainingCount = childrenArray.length - max;
  const sizeConfig = sizeClasses[size];

  return (
    <div className={cn('flex items-center -space-x-2 overflow-hidden', className)} {...props}>
      {visibleAvatars.map((child, idx) => (
        <div key={idx} className="ring-2 ring-white dark:ring-dark-card rounded-full">
          {child}
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            'relative inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold ring-2 ring-white dark:ring-dark-card',
            sizeConfig.container,
            sizeConfig.text
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export type AvatarComponent = typeof Avatar & {
  Group: typeof AvatarGroup;
};

const AvatarWithCompound = Avatar as AvatarComponent;
AvatarWithCompound.Group = AvatarGroup;

export default AvatarWithCompound;
