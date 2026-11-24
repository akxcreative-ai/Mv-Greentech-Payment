import React from 'react';
import { cn } from '@/utils/cn';

export type CardVariant = 'default' | 'outlined' | 'elevated';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm',
  outlined:
    'bg-white dark:bg-dark-card border-2 border-slate-200 dark:border-dark-border shadow-none',
  elevated:
    'bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border shadow-md',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl text-slate-800 dark:text-slate-100 transition-all duration-200 overflow-hidden',
          variantStyles[variant],
          hover &&
            'hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-navy-600 cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'p-5 sm:p-6 border-b border-slate-100 dark:border-dark-border flex items-start justify-between gap-4',
          className
        )}
        {...props}
      >
        <div className="space-y-1 min-w-0 flex-1">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn(
        'text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight tracking-tight',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn('text-xs sm:text-sm text-slate-500 dark:text-slate-400', className)}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('p-5 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
});
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'p-5 sm:p-6 pt-0 border-t border-slate-100 dark:border-dark-border flex items-center justify-between gap-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = 'CardFooter';

// Compound Component Attachments
export type CardComponent = typeof Card & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Content: typeof CardContent;
  Footer: typeof CardFooter;
};

const CardWithCompound = Card as CardComponent;
CardWithCompound.Header = CardHeader;
CardWithCompound.Title = CardTitle;
CardWithCompound.Description = CardDescription;
CardWithCompound.Content = CardContent;
CardWithCompound.Footer = CardFooter;

export default CardWithCompound;
