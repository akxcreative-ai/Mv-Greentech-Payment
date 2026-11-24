import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  maxLength?: number;
  currentLength?: number;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      helperText,
      showCount = false,
      maxLength,
      currentLength,
      id,
      disabled,
      readOnly,
      required,
      rows = 3,
      value,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const count =
      currentLength !== undefined
        ? currentLength
        : typeof value === 'string'
        ? value.length
        : undefined;

    return (
      <div className={cn('w-full flex flex-col space-y-1.5', containerClassName)}>
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1 select-none"
            >
              {label}
              {required && <span className="text-rose-500 text-sm leading-none">*</span>}
            </label>
          )}

          {showCount && maxLength && count !== undefined && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              {count} / {maxLength}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          value={value}
          className={cn(
            'w-full p-3 text-sm rounded-lg border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-150 outline-none shadow-sm resize-y',
            'border-slate-300 dark:border-dark-border focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20 dark:focus:border-navy-500 dark:focus:ring-navy-500/30',
            error &&
              'border-rose-500 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 dark:text-rose-100 placeholder:text-rose-300',
            disabled && 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700 shadow-none',
            readOnly && 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 cursor-default',
            className
          )}
          {...props}
        />

        {error ? (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium mt-0.5">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
