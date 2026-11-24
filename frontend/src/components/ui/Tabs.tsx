import React, { createContext, useContext } from 'react';
import { cn } from '@/utils/cn';

export type TabsVariant = 'underline' | 'pills' | 'bordered';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface SimpleTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: TabsVariant;
  fullWidth?: boolean;
  className?: string;
}

export const Tabs: React.FC<SimpleTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  fullWidth = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center overflow-x-auto scrollbar-none',
        variant === 'underline' && 'border-b border-slate-200 dark:border-dark-border gap-6',
        variant === 'pills' &&
          'bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-slate-200/60 dark:border-dark-border',
        variant === 'bordered' &&
          'border-b border-slate-200 dark:border-dark-border gap-1',
        fullWidth && 'w-full',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        if (variant === 'pills') {
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer select-none',
                isActive
                  ? 'bg-white dark:bg-dark-card text-navy-900 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
                tab.disabled && 'opacity-40 cursor-not-allowed',
                fullWidth && 'flex-1'
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    isActive
                      ? 'bg-navy-100 dark:bg-navy-900 text-navy-800 dark:text-cyan-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        }

        if (variant === 'bordered') {
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg border-t border-l border-r transition-all duration-150 whitespace-nowrap -mb-px cursor-pointer select-none',
                isActive
                  ? 'bg-white dark:bg-dark-card border-slate-200 dark:border-dark-border text-navy-900 dark:text-cyan-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                tab.disabled && 'opacity-40 cursor-not-allowed',
                fullWidth && 'flex-1'
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        }

        // Default 'underline' variant
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 py-3 px-1 text-sm font-semibold transition-all duration-150 whitespace-nowrap border-b-2 -mb-px cursor-pointer select-none',
              isActive
                ? 'border-navy-800 dark:border-cyan-400 text-navy-900 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300',
              tab.disabled && 'opacity-40 cursor-not-allowed',
              fullWidth && 'flex-1 justify-center'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  isActive
                    ? 'bg-navy-50 text-navy-800 dark:bg-navy-950/60 dark:text-cyan-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Compound Component Context Support
interface CompoundTabsContextType {
  activeTab: string;
  setActiveTab: (val: string) => void;
  variant?: TabsVariant;
}

const CompoundTabsContext = createContext<CompoundTabsContextType | undefined>(undefined);

export interface CompoundTabsProps {
  value: string;
  onValueChange: (val: string) => void;
  variant?: TabsVariant;
  children: React.ReactNode;
  className?: string;
}

export const TabsRoot: React.FC<CompoundTabsProps> = ({
  value,
  onValueChange,
  variant = 'underline',
  children,
  className,
}) => {
  return (
    <CompoundTabsContext.Provider
      value={{ activeTab: value, setActiveTab: onValueChange, variant }}
    >
      <div className={cn('w-full', className)}>{children}</div>
    </CompoundTabsContext.Provider>
  );
};

export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  const context = useContext(CompoundTabsContext);
  const variant = context?.variant || 'underline';

  return (
    <div
      className={cn(
        'flex items-center overflow-x-auto scrollbar-none',
        variant === 'underline' && 'border-b border-slate-200 dark:border-dark-border gap-6',
        variant === 'pills' &&
          'bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-slate-200/60 dark:border-dark-border',
        variant === 'bordered' &&
          'border-b border-slate-200 dark:border-dark-border gap-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
}

export const TabTrigger: React.FC<TabTriggerProps> = ({
  value,
  icon,
  className,
  children,
  ...props
}) => {
  const context = useContext(CompoundTabsContext);
  if (!context) throw new Error('TabTrigger must be used within TabsRoot');

  const isActive = context.activeTab === value;
  const variant = context.variant || 'underline';

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer select-none font-semibold text-xs',
        variant === 'pills' &&
          (isActive
            ? 'px-3.5 py-1.5 rounded-lg bg-white dark:bg-dark-card text-navy-900 dark:text-cyan-400 shadow-xs'
            : 'px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'),
        variant === 'underline' &&
          (isActive
            ? 'py-3 px-1 text-sm border-b-2 border-navy-800 dark:border-cyan-400 text-navy-900 dark:text-cyan-400 -mb-px'
            : 'py-3 px-1 text-sm border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 hover:border-slate-300 -mb-px'),
        className
      )}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

export interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabContent: React.FC<TabContentProps> = ({
  value,
  className,
  children,
  ...props
}) => {
  const context = useContext(CompoundTabsContext);
  if (!context) throw new Error('TabContent must be used within TabsRoot');

  if (context.activeTab !== value) return null;

  return (
    <div className={cn('pt-4 animate-fade-in', className)} {...props}>
      {children}
    </div>
  );
};

// Aliases
export const TabsTrigger = TabTrigger;
export const TabsContent = TabContent;

// Compound Component Attachments
export type TabsComponent = typeof Tabs & {
  List: typeof TabsList;
  Trigger: typeof TabTrigger;
  Content: typeof TabContent;
  Root: typeof TabsRoot;
};

const TabsWithCompound = Tabs as TabsComponent;
TabsWithCompound.List = TabsList;
TabsWithCompound.Trigger = TabTrigger;
TabsWithCompound.Content = TabContent;
TabsWithCompound.Root = TabsRoot;

export default TabsWithCompound;
