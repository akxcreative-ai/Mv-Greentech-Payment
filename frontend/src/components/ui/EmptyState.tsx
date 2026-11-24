import React from 'react';
import { FolderSearch, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button, ButtonProps } from './Button';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: ButtonProps['variant'];
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction | React.ReactNode;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-200 dark:border-dark-border bg-white/40 dark:bg-dark-card/30',
        compact ? 'p-6 sm:p-8' : 'p-8 sm:p-14',
        className
      )}
      {...props}
    >
      {/* Icon Wrapper */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 dark:bg-navy-950/60 border border-slate-200 dark:border-navy-800/80 flex items-center justify-center text-slate-400 dark:text-cyan-400 mb-4 shadow-inner">
        {icon || <FolderSearch className="w-7 h-7 sm:w-8 sm:h-8" />}
      </div>

      {/* Title & Description */}
      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5 max-w-md">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {/* Action Buttons */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action &&
            (React.isValidElement(action) ? (
              action
            ) : typeof action === 'object' && 'label' in action ? (
              <Button
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                leftIcon={action.icon || <Plus className="w-4 h-4" />}
              >
                {action.label}
              </Button>
            ) : null)}

          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'outline'}
              onClick={secondaryAction.onClick}
              leftIcon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
