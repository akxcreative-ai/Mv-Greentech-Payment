import React from 'react';
import toastHelper, {
  Toaster as HotToaster,
  ToastBar,
  type ToastOptions,
} from 'react-hot-toast';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export interface CustomToastProps {
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
}

export const CustomToast: React.FC<CustomToastProps> = ({
  title,
  message,
  type = 'info',
  onClose,
}) => {
  const typeConfigs = {
    success: {
      border: 'border-l-4 border-l-emerald-500',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    },
    error: {
      border: 'border-l-4 border-l-rose-500',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
      bg: 'bg-rose-50/50 dark:bg-rose-950/20',
    },
    warning: {
      border: 'border-l-4 border-l-amber-500',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    },
    info: {
      border: 'border-l-4 border-l-navy-600 dark:border-l-cyan-400',
      icon: <Info className="w-5 h-5 text-navy-700 dark:text-cyan-400 shrink-0" />,
      bg: 'bg-navy-50/50 dark:bg-navy-950/20',
    },
  }[type];

  return (
    <div
      className={cn(
        'w-full max-w-md p-4 rounded-xl shadow-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card flex items-start gap-3 transition-all duration-200 pointer-events-auto',
        typeConfigs.border
      )}
    >
      <div className="mt-0.5">{typeConfigs.icon}</div>

      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h4>
        {message && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
            {message}
          </p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const showToast = {
  success: (title: string, message?: string, options?: ToastOptions) =>
    toastHelper.custom(
      (t) => (
        <CustomToast
          title={title}
          message={message}
          type="success"
          onClose={() => toastHelper.dismiss(t.id)}
        />
      ),
      { duration: 4000, ...options }
    ),

  error: (title: string, message?: string, options?: ToastOptions) =>
    toastHelper.custom(
      (t) => (
        <CustomToast
          title={title}
          message={message}
          type="error"
          onClose={() => toastHelper.dismiss(t.id)}
        />
      ),
      { duration: 5000, ...options }
    ),

  warning: (title: string, message?: string, options?: ToastOptions) =>
    toastHelper.custom(
      (t) => (
        <CustomToast
          title={title}
          message={message}
          type="warning"
          onClose={() => toastHelper.dismiss(t.id)}
        />
      ),
      { duration: 4500, ...options }
    ),

  info: (title: string, message?: string, options?: ToastOptions) =>
    toastHelper.custom(
      (t) => (
        <CustomToast
          title={title}
          message={message}
          type="info"
          onClose={() => toastHelper.dismiss(t.id)}
        />
      ),
      { duration: 4000, ...options }
    ),

  dismiss: (toastId?: string) => toastHelper.dismiss(toastId),
};

export const Toaster: React.FC = () => {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        className: 'border-0 p-0 shadow-none bg-transparent',
      }}
    >
      {(t) => (
        <ToastBar toast={t} style={{ padding: 0, background: 'transparent', boxShadow: 'none' }}>
          {({ message }) => message}
        </ToastBar>
      )}
    </HotToaster>
  );
};

export default showToast;
