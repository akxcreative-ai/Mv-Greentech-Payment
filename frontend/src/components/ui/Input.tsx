import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  allowPasswordToggle?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      helperText,
      prefixIcon,
      suffixIcon,
      icon,
      leftIcon,
      rightIcon,
      type = 'text',
      id,
      disabled,
      readOnly,
      required,
      allowPasswordToggle = true,
      ...props
    },
    ref
  ) => {
    const effectivePrefixIcon = prefixIcon || leftIcon || icon;
    const effectiveSuffixIcon = suffixIcon || rightIcon;
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const isPassword = type === 'password';
    const computedType = isPassword && showPassword ? 'text' : type;

    return (
      <div className={cn('w-full flex flex-col space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 select-none"
          >
            {label}
            {required && <span className="text-rose-600 text-xs leading-none font-semibold">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {effectivePrefixIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-400">
              {effectivePrefixIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={computedType}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            className={cn(
              'w-full h-10 px-3.5 text-sm font-normal rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-normal transition-all duration-150 outline-none shadow-xs',
              'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20',
              effectivePrefixIcon && 'pl-10',
              (effectiveSuffixIcon || (isPassword && allowPasswordToggle)) && 'pr-10',
              error &&
                'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 placeholder:text-rose-300',
              disabled && 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 shadow-none',
              readOnly && 'bg-slate-50 text-slate-700 cursor-default',
              className
            )}
            {...props}
          />

          {isPassword && allowPasswordToggle ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : effectiveSuffixIcon ? (
            <div className="absolute right-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {effectiveSuffixIcon}
            </div>
          ) : null}
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

Input.displayName = 'Input';

export default Input;
