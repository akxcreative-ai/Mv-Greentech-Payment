import { format, isValid, parseISO } from 'date-fns';
import { Priority, RequestStatus } from '@/types';

/**
 * Format amount as Indian Currency (e.g., ₹12,34,567.89)
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  showDecimals = true,
  currency = 'INR'
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0.00';
  }

  const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(numericValue);
  } catch {
    // Fallback Indian numbering formatting
    const isNegative = numericValue < 0;
    const absValue = Math.abs(numericValue);
    const [intPart, decPart] = absValue.toFixed(showDecimals ? 2 : 0).split('.');
    
    let lastThree = intPart.substring(intPart.length - 3);
    const otherNumbers = intPart.substring(0, intPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    const formatted = showDecimals && decPart ? `${formattedInt}.${decPart}` : formattedInt;

    return `${isNegative ? '-' : ''}₹${formatted}`;
  }
}

/**
 * Format a date string, timestamp, or Date object into human-readable format
 * Default: "23 Nov 2026"
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  pattern = 'dd MMM yyyy'
): string {
  if (!date) return '-';

  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(d)) return '-';
    return format(d, pattern);
  } catch {
    return '-';
  }
}

/**
 * Format a date string into human-readable date & time
 * Default: "23 Nov 2026, 07:30 PM"
 */
export function formatDateTime(
  date: string | number | Date | null | undefined,
  pattern = 'dd MMM yyyy, hh:mm a'
): string {
  if (!date) return '-';

  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(d)) return '-';
    return format(d, pattern);
  } catch {
    return '-';
  }
}

/**
 * Format raw bytes into readable file size (e.g., 2.45 MB)
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  if (bytes < 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get visual styling colors and classes for Request Status
 */
export function getStatusColor(status: RequestStatus | string): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  dot: string;
} {
  switch (status) {
    case RequestStatus.DRAFT:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
        badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
    case RequestStatus.SUBMITTED:
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
        badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        dot: 'bg-blue-500',
      };
    case RequestStatus.UNDER_REVIEW:
    case RequestStatus.PENDING_APPROVAL:
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200 dark:border-indigo-800',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
        dot: 'bg-indigo-500',
      };
    case RequestStatus.CLARIFICATION_REQUESTED:
    case RequestStatus.CLARIFICATION_REQUIRED:
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-800 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    case RequestStatus.APPROVED:
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      };
    case RequestStatus.REJECTED:
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800',
        badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
        dot: 'bg-rose-500',
      };
    case RequestStatus.PAYMENT_SCHEDULED:
    case RequestStatus.PAYMENT_PROCESSING:
      return {
        bg: 'bg-cyan-50 dark:bg-cyan-950/40',
        text: 'text-cyan-700 dark:text-cyan-300',
        border: 'border-cyan-200 dark:border-cyan-800',
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
        dot: 'bg-cyan-500',
      };
    case RequestStatus.PAID:
    case RequestStatus.COMPLETED:
      return {
        bg: 'bg-green-50 dark:bg-green-950/40',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
        badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
        dot: 'bg-green-500',
      };
    case RequestStatus.CANCELLED:
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-600 dark:text-gray-400',
        border: 'border-gray-200 dark:border-gray-700',
        badge: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
        dot: 'bg-gray-400',
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700',
        badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
  }
}

/**
 * Get human-friendly label for Request Status
 */
export function getStatusLabel(status: RequestStatus | string): string {
  switch (status) {
    case RequestStatus.DRAFT:
      return 'Draft';
    case RequestStatus.SUBMITTED:
      return 'Submitted';
    case RequestStatus.UNDER_REVIEW:
    case RequestStatus.PENDING_APPROVAL:
      return 'Pending Approval';
    case RequestStatus.CLARIFICATION_REQUESTED:
    case RequestStatus.CLARIFICATION_REQUIRED:
      return 'Clarification Required';
    case RequestStatus.APPROVED:
      return 'Approved';
    case RequestStatus.REJECTED:
      return 'Rejected';
    case RequestStatus.PAYMENT_SCHEDULED:
      return 'Payment Scheduled';
    case RequestStatus.PAYMENT_PROCESSING:
      return 'Payment Processing';
    case RequestStatus.PAID:
    case RequestStatus.COMPLETED:
      return 'Paid';
    case RequestStatus.CANCELLED:
      return 'Cancelled';
    case RequestStatus.ON_HOLD:
      return 'On Hold';
    default:
      return status ? status.replace(/_/g, ' ') : '-';
  }
}

/**
 * Get visual styling colors and classes for Priority levels
 */
export function getPriorityColor(priority: Priority | string): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  dot: string;
} {
  switch (priority) {
    case Priority.LOW:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700',
        badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
    case Priority.NORMAL:
      return {
        bg: 'bg-sky-50 dark:bg-sky-950/40',
        text: 'text-sky-700 dark:text-sky-300',
        border: 'border-sky-200 dark:border-sky-800',
        badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        dot: 'bg-sky-500',
      };
    case Priority.HIGH:
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    case Priority.URGENT:
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-300 dark:border-rose-800',
        badge: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-semibold',
        dot: 'bg-rose-600 animate-ping',
      };
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700',
        badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
  }
}

/**
 * Get human-friendly label for Priority
 */
export function getPriorityLabel(priority: Priority | string): string {
  switch (priority) {
    case Priority.LOW:
      return 'Low';
    case Priority.NORMAL:
      return 'Normal';
    case Priority.HIGH:
      return 'High';
    case Priority.URGENT:
      return 'Urgent';
    default:
      return priority ? String(priority) : '-';
  }
}

/**
 * Get human-friendly label for Expense Category (all 14 categories supported)
 */
export function getExpenseCategoryLabel(category: string | undefined | null): string {
  if (!category) return '-';
  switch (category) {
    case 'VENDOR_PAYMENT':
      return 'Vendor Payment';
    case 'PURCHASE':
      return 'Purchase Requisition';
    case 'RAW_MATERIAL':
    case 'RAW_MATERIALS':
      return 'Raw Materials & Components';
    case 'OFFICE_EXPENSES':
    case 'OFFICE_SUPPLIES':
      return 'Office Expenses & Supplies';
    case 'EMPLOYEE_REIMBURSEMENT':
      return 'Employee Reimbursement';
    case 'TRAVEL':
    case 'TRAVEL_ENTERTAINMENT':
      return 'Travel & Conveyance';
    case 'TRANSPORT':
    case 'LOGISTICS':
      return 'Transport, Freight & Shipping';
    case 'UTILITY_BILLS':
    case 'UTILITIES':
      return 'Utility Bills (Power, Water, Gas)';
    case 'MAINTENANCE':
      return 'Repairs & Maintenance';
    case 'SALARY_WAGES':
      return 'Salary, Wages & Labor';
    case 'PROFESSIONAL_FEES':
    case 'CONSULTING':
      return 'Professional Fees & Legal';
    case 'GOVERNMENT_FEES':
      return 'Government Fees & Taxes';
    case 'CAPEX':
    case 'CAPITAL_EXPENDITURE':
      return 'Capital Expenditure (CapEx)';
    case 'RENT':
      return 'Commercial Rent & Lease';
    case 'IT_SOFTWARE':
      return 'IT Software & Cloud';
    case 'MARKETING':
      return 'Marketing & Branding';
    case 'OTHER':
      return 'Other Miscellaneous';
    default:
      return category.replace(/_/g, ' ');
  }
}

/**
 * Convert number into Indian currency words representation (Crores, Lakhs, Thousands)
 */
export function numberToIndianWords(num: number | string | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '';
  const n = Math.floor(Math.abs(Number(num)));
  if (n === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensMultiple = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(val: number): string {
    if (val < 10) return singleDigits[val];
    if (val >= 10 && val < 20) return twoDigits[val - 10];
    const tens = Math.floor(val / 10);
    const units = val % 10;
    return `${tensMultiple[tens]}${units > 0 ? ' ' + singleDigits[units] : ''}`;
  }

  function convertThreeDigits(val: number): string {
    const hundred = Math.floor(val / 100);
    const rem = val % 100;
    let res = '';
    if (hundred > 0) {
      res += `${singleDigits[hundred]} Hundred`;
      if (rem > 0) res += ' ';
    }
    if (rem > 0) {
      res += convertTwoDigits(rem);
    }
    return res;
  }

  let crore = Math.floor(n / 10000000);
  let remAfterCrore = n % 10000000;
  let lakh = Math.floor(remAfterCrore / 100000);
  let remAfterLakh = remAfterCrore % 100000;
  let thousand = Math.floor(remAfterLakh / 1000);
  let remAfterThousand = remAfterLakh % 1000;

  const parts: string[] = [];
  if (crore > 0) {
    parts.push(`${convertTwoDigits(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertTwoDigits(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertTwoDigits(thousand)} Thousand`);
  }
  if (remAfterThousand > 0) {
    parts.push(convertThreeDigits(remAfterThousand));
  }

  return parts.length > 0 ? `${parts.join(' ')} Rupees Only` : 'Zero Rupees Only';
}

