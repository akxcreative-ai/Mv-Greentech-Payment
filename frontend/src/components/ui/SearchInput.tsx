import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  debounceMs?: number;
  isLoading?: boolean;
  containerClassName?: string;
  showShortcut?: boolean;
  shortcutKey?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      containerClassName,
      value: controlledValue,
      defaultValue = '',
      onChange,
      onSearch,
      onClear,
      debounceMs = 300,
      isLoading = false,
      placeholder = 'Search by keyword, invoice, or vendor...',
      showShortcut = false,
      shortcutKey = '⌘K',
      ...props
    },
    ref
  ) => {
    const [searchTerm, setSearchTerm] = useState<string>(
      controlledValue !== undefined ? controlledValue : defaultValue
    );
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Sync with controlled value if supplied
    useEffect(() => {
      if (controlledValue !== undefined) {
        setSearchTerm(controlledValue);
      }
    }, [controlledValue]);

    // Debounce callback
    useEffect(() => {
      const timer = setTimeout(() => {
        if (onChange) onChange(searchTerm);
        if (onSearch) onSearch(searchTerm);
      }, debounceMs);

      return () => clearTimeout(timer);
    }, [searchTerm, debounceMs, onChange, onSearch]);

    const handleClear = () => {
      setSearchTerm('');
      if (onChange) onChange('');
      if (onSearch) onSearch('');
      if (onClear) onClear();
      inputRef.current?.focus();
    };

    return (
      <div className={cn('relative flex items-center w-full max-w-md', containerClassName)}>
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-navy-600 dark:text-cyan-400" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full h-10 pl-10 pr-10 text-sm rounded-lg border bg-white dark:bg-dark-card text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-150 outline-none shadow-sm',
            'border-slate-300 dark:border-dark-border focus:border-navy-700 focus:ring-2 focus:ring-navy-600/20 dark:focus:border-navy-500 dark:focus:ring-navy-500/30',
            className
          )}
          {...props}
        />

        {searchTerm ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : showShortcut ? (
          <div className="absolute right-3 pointer-events-none hidden sm:flex items-center">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm">
              {shortcutKey}
            </kbd>
          </div>
        ) : null}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
