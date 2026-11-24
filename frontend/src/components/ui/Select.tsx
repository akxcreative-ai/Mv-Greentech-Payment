import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      containerClassName,
      label,
      options,
      error,
      helperText,
      placeholder,
      id,
      disabled,
      required,
      children,
      defaultValue,
      value,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('w-full flex flex-col space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1 select-none"
          >
            {label}
            {required && <span className="text-rose-500 text-sm leading-none">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            defaultValue={defaultValue}
            value={value}
            className={cn(
              'w-full h-10 pl-3.5 pr-10 text-sm rounded-lg border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 appearance-none transition-all duration-150 outline-none shadow-sm cursor-pointer',
              'border-slate-300 dark:border-dark-border focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20 dark:focus:border-navy-500 dark:focus:ring-navy-500/30',
              error && 'border-rose-500 dark:border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
              disabled && 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700 shadow-none',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="text-slate-400 dark:text-slate-500">
                {placeholder}
              </option>
            )}

            {options
              ? options.map((opt) => (
                  <option
                    key={String(opt.value)}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 py-1"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

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

Select.displayName = 'Select';

export default Select;
