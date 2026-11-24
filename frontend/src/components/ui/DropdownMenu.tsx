import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '@/utils/cn';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeDropdown: () => void;
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

export interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, closeDropdown }}>
      <div ref={dropdownRef} className={cn('relative inline-block text-left', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

export interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  className,
}) => {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  return (
    <div
      onClick={() => context.setIsOpen((prev) => !prev)}
      className={cn('cursor-pointer inline-flex', className)}
    >
      {children}
    </div>
  );
};

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'left' | 'right';
  width?: string | number;
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  align = 'right',
  width = 'w-56',
  className,
  children,
  ...props
}) => {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuContent must be inside DropdownMenu');

  if (!context.isOpen) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-xl animate-fade-in focus:outline-none',
        align === 'right' ? 'right-0' : 'left-0',
        typeof width === 'string' && width.startsWith('w-') ? width : '',
        className
      )}
      style={typeof width === 'number' ? { width } : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  icon,
  danger = false,
  disabled = false,
  onClick,
  className,
  children,
  ...props
}) => {
  const context = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (onClick) onClick(e);
    context?.closeDropdown();
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none',
        danger
          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
      role="menuitem"
      {...props}
    >
      {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </div>
  );
};

export const DropdownMenuSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('my-1 border-t border-slate-100 dark:border-dark-border', className)}
    {...props}
  />
);

export const DropdownMenuLabel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      'px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// Compound Component Attachments
export type DropdownMenuComponent = typeof DropdownMenu & {
  Trigger: typeof DropdownMenuTrigger;
  Content: typeof DropdownMenuContent;
  Item: typeof DropdownMenuItem;
  Separator: typeof DropdownMenuSeparator;
  Label: typeof DropdownMenuLabel;
};

const DropdownMenuWithCompound = DropdownMenu as DropdownMenuComponent;
DropdownMenuWithCompound.Trigger = DropdownMenuTrigger;
DropdownMenuWithCompound.Content = DropdownMenuContent;
DropdownMenuWithCompound.Item = DropdownMenuItem;
DropdownMenuWithCompound.Separator = DropdownMenuSeparator;
DropdownMenuWithCompound.Label = DropdownMenuLabel;

export default DropdownMenuWithCompound;
