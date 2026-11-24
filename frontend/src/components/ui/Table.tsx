import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
  isLoading?: boolean;
  skeletonRows?: number;
  skeletonCols?: number;
  isEmpty?: boolean;
  emptyText?: string;
  emptyIcon?: React.ReactNode;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      containerClassName,
      isLoading = false,
      skeletonRows = 5,
      skeletonCols = 5,
      isEmpty = false,
      emptyText = 'No records found',
      emptyIcon,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        className={cn(
          'w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm',
          containerClassName
        )}
      >
        <table
          ref={ref}
          className={cn('w-full text-left text-sm text-slate-700 dark:text-slate-300 border-collapse', className)}
          {...props}
        >
          {isLoading ? (
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, rIdx) => (
                <tr
                  key={`skeleton-row-${rIdx}`}
                  className="border-b border-slate-100 dark:border-dark-border/60 animate-pulse"
                >
                  {Array.from({ length: skeletonCols }).map((_, cIdx) => (
                    <td key={`skeleton-cell-${rIdx}-${cIdx}`} className="p-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700/60 rounded w-full max-w-[85%]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : isEmpty ? (
            <tbody>
              <tr>
                <td
                  colSpan={skeletonCols}
                  className="py-12 px-4 text-center text-slate-500 dark:text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    {emptyIcon}
                    <p className="text-sm font-medium">{emptyText}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            children
          )}
        </table>
      </div>
    );
  }
);
Table.displayName = 'Table';

export const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-dark-border text-xs font-semibold uppercase tracking-wider',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-slate-100 dark:divide-dark-border/60', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  clickable?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected = false, clickable = false, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'transition-colors duration-150',
        'hover:bg-slate-50/90 dark:hover:bg-slate-800/40',
        clickable && 'cursor-pointer',
        selected && 'bg-navy-50/70 dark:bg-navy-950/40',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export interface TableHeaderCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export const TableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  TableHeaderCellProps
>(({ className, sortable = false, sortDirection = null, onSort, children, ...props }, ref) => {
  return (
    <th
      ref={ref}
      className={cn(
        'px-4 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 select-none whitespace-nowrap',
        sortable && 'cursor-pointer hover:text-navy-800 dark:hover:text-cyan-400 group',
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="inline-flex items-center gap-1.5">
        <span>{children}</span>
        {sortable && (
          <span className="shrink-0 text-slate-400 group-hover:text-navy-700 dark:group-hover:text-cyan-400">
            {sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-navy-800 dark:text-cyan-400" />
            ) : sortDirection === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-navy-800 dark:text-cyan-400" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
            )}
          </span>
        )}
      </div>
    </th>
  );
});
TableHeaderCell.displayName = 'TableHeaderCell';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3.5 align-middle text-sm whitespace-nowrap', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

// Alias exports matching Table/Head/Body/Row/Cell/HeaderCell
export const Head = TableHead;
export const Body = TableBody;
export const Row = TableRow;
export const Cell = TableCell;
export const HeaderCell = TableHeaderCell;

// Compound Component Attachments
export type TableComponent = typeof Table & {
  Head: typeof TableHead;
  Body: typeof TableBody;
  Row: typeof TableRow;
  Cell: typeof TableCell;
  HeaderCell: typeof TableHeaderCell;
};

const TableWithCompound = Table as TableComponent;
TableWithCompound.Head = TableHead;
TableWithCompound.Body = TableBody;
TableWithCompound.Row = TableRow;
TableWithCompound.Cell = TableCell;
TableWithCompound.HeaderCell = TableHeaderCell;

export default TableWithCompound;
