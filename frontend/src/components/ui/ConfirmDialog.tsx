import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  User as UserIcon,
  FileText,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Textarea } from './Textarea';
import { formatCurrency } from '@/utils/format';

export type ConfirmActionType = 'approve' | 'reject' | 'clarify' | 'delete' | 'warning';

export interface ConfirmDialogDetails {
  requestId?: string;
  vendorName?: string;
  amount?: number;
  currency?: string;
  requesterName?: string;
  departmentName?: string;
  companyName?: string;
  invoiceNumber?: string;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void> | void;
  actionType: ConfirmActionType;
  title?: string;
  message?: string;
  details?: ConfirmDialogDetails;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  title: customTitle,
  message: customMessage,
  details,
  requireReason = actionType === 'reject' || actionType === 'clarify',
  reasonLabel,
  reasonPlaceholder,
  confirmText: customConfirmText,
  cancelText = 'Cancel',
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Auto configure title & color scheme based on actionType
  const config = {
    approve: {
      defaultTitle: 'Approve Payment Request',
      defaultMessage: 'Are you sure you want to approve this payment request? It will advance to the next workflow stage.',
      defaultConfirmText: 'Approve Request',
      variant: 'success' as const,
      confirmButtonVariant: 'success' as const,
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      defaultReasonLabel: 'Approval Remarks (Optional)',
      defaultReasonPlaceholder: 'Enter any remarks or notes for accounting...',
    },
    reject: {
      defaultTitle: 'Reject Payment Request',
      defaultMessage: 'Are you sure you want to reject this payment request? This action will halt processing and notify the requester.',
      defaultConfirmText: 'Reject Request',
      variant: 'danger' as const,
      confirmButtonVariant: 'danger' as const,
      icon: <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
      defaultReasonLabel: 'Reason for Rejection *',
      defaultReasonPlaceholder: 'Provide a mandatory reason why this request is being rejected...',
    },
    clarify: {
      defaultTitle: 'Request Clarification',
      defaultMessage: 'Specify what additional documentation or clarification is needed from the requester.',
      defaultConfirmText: 'Send Clarification Request',
      variant: 'confirmation' as const,
      confirmButtonVariant: 'warning' as const,
      icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      defaultReasonLabel: 'Clarification Needed *',
      defaultReasonPlaceholder: 'State your questions or the missing details required...',
    },
    delete: {
      defaultTitle: 'Delete Record',
      defaultMessage: 'Are you sure you want to delete this record? This action cannot be undone.',
      defaultConfirmText: 'Delete',
      variant: 'danger' as const,
      confirmButtonVariant: 'danger' as const,
      icon: <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
      defaultReasonLabel: 'Reason for Deletion (Optional)',
      defaultReasonPlaceholder: 'State reason...',
    },
    warning: {
      defaultTitle: 'Confirm Action',
      defaultMessage: 'Please confirm that you want to proceed with this operation.',
      defaultConfirmText: 'Confirm',
      variant: 'confirmation' as const,
      confirmButtonVariant: 'primary' as const,
      icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      defaultReasonLabel: 'Remarks (Optional)',
      defaultReasonPlaceholder: 'Enter notes...',
    },
  }[actionType];

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setReasonError('Please provide a reason to continue.');
      return;
    }
    setReasonError('');
    await onConfirm(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    if (isLoading) return;
    setReason('');
    setReasonError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      showCloseButton={!isLoading}
      title={customTitle || config.defaultTitle}
      description={customMessage || config.defaultMessage}
    >
      <div className="space-y-4">
        {/* Details Card if provided */}
        {details && (
          <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50/80 dark:bg-dark-card/60 p-4 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              {details.requestId && (
                <div>
                  <span className="text-slate-400 block font-medium">Request Number</span>
                  <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-navy-600 dark:text-cyan-400" />
                    {details.requestId}
                  </span>
                </div>
              )}

              {details.amount !== undefined && (
                <div>
                  <span className="text-slate-400 block font-medium">Amount Payable</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    {formatCurrency(details.amount, true, details.currency || 'INR')}
                  </span>
                </div>
              )}

              {details.vendorName && (
                <div>
                  <span className="text-slate-400 block font-medium">Vendor</span>
                  <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {details.vendorName}
                  </span>
                </div>
              )}

              {details.requesterName && (
                <div>
                  <span className="text-slate-400 block font-medium">Requester</span>
                  <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5 truncate">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    {details.requesterName}
                  </span>
                </div>
              )}

              {details.departmentName && (
                <div>
                  <span className="text-slate-400 block font-medium">Department</span>
                  <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {details.departmentName}
                  </span>
                </div>
              )}

              {details.invoiceNumber && (
                <div>
                  <span className="text-slate-400 block font-medium">Invoice Ref</span>
                  <span className="font-semibold text-slate-800 dark:text-white mt-0.5 truncate block">
                    #{details.invoiceNumber}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reason / Remarks Field */}
        <div>
          <Textarea
            label={reasonLabel || config.defaultReasonLabel}
            placeholder={reasonPlaceholder || config.defaultReasonPlaceholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError('');
            }}
            error={reasonError}
            rows={3}
            disabled={isLoading}
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-dark-border">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>

          <Button
            variant={config.confirmButtonVariant}
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {customConfirmText || config.defaultConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
