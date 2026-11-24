import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Download,
  Building2,
  User,
  CreditCard,
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  XCircle,
  HelpCircle,
  History,
  ShieldCheck,
  Edit3,
  Ban,
  Receipt,
  FileCheck,
  ChevronRight,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  usePaymentRequest,
  useSubmitPaymentRequest,
  useCancelPaymentRequest,
  useDownloadDocument,
} from '@/hooks/usePaymentRequests';
import {
  useApprovalHistory,
  useApproveRequest,
  useRejectRequest,
  useRequestClarification,
  useRespondToClarification,
} from '@/hooks/useApprovals';
import { useRecordPayment } from '@/hooks/usePayments';
import {
  RequestStatus,
  Role,
  ApprovalAction,
  PaymentMode,
  PaymentRequestDocument,
  ApprovalRecord,
  ClarificationMessage,
} from '@/types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  getPriorityColor,
  getStatusLabel,
  getExpenseCategoryLabel,
  numberToIndianWords,
} from '@/utils/format';
import {
  Button,
  StatusBadge,
  Badge,
  ConfirmDialog,
  Modal,
  Textarea,
  Input,
  Select,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui';
import toast from 'react-hot-toast';

export const PaymentRequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Queries
  const {
    data: request,
    isLoading: isLoadingRequest,
    refetch: refetchRequest,
  } = usePaymentRequest(id || '', { enabled: Boolean(id) });

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useApprovalHistory(id || '', { enabled: Boolean(id) });

  // Action Mutations
  const submitMutation = useSubmitPaymentRequest();
  const cancelMutation = useCancelPaymentRequest();
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const requestClarificationMutation = useRequestClarification();
  const respondClarificationMutation = useRespondToClarification();
  const downloadDocMutation = useDownloadDocument();
  const recordPaymentMutation = useRecordPayment();

  // Modals & Forms State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PaymentRequestDocument | null>(null);

  // Modal Inputs
  const [cancelReason, setCancelReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvedAmountInput, setApprovedAmountInput] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [clarificationQuery, setClarificationQuery] = useState('');
  const [clarificationResponse, setClarificationResponse] = useState('');

  // Payment Record Modal Inputs
  const [paymentUtr, setPaymentUtr] = useState('');
  const [paymentModeInput, setPaymentModeInput] = useState<PaymentMode>(PaymentMode.NEFT);
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentBankAccount, setPaymentBankAccount] = useState('');
  const [paymentRemarksInput, setPaymentRemarksInput] = useState('');

  if (isLoadingRequest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading payment request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <EmptyState
        icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
        title="Payment Request Not Found"
        description="The requested payment requisition does not exist or you do not have permission to view it."
        action={
          <Button variant="primary" size="sm" onClick={() => navigate('/payment-requests')}>
            Back to Requests
          </Button>
        }
      />
    );
  }

  // Determine user permissions and role
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;
  const isAdmin = user?.role === Role.ADMIN || isSuperAdmin;
  const isAccountant = user?.role === Role.ACCOUNTANT || isAdmin;
  const isApprover =
    user?.role === Role.APPROVER ||
    user?.role === Role.MANAGEMENT ||
    user?.role === Role.DIRECTOR ||
    isAdmin;

  const isCreator = user?.id === request.requesterId || (request as any).requested_by_id === user?.id;

  // Normalized values (supporting camelCase and snake_case)
  const reqNumber = request.requestNumber || (request as any).request_number || request.id.slice(0, 8);
  const title = request.title || 'Payment Requisition';
  const description = request.description || (request as any).payment_purpose || 'No description provided.';
  const amount = Number(request.amount || 0);
  const gstAmount = Number((request as any).gst_amount || (request as any).gstAmount || 0);
  const totalAmount = (request as any).total_amount || (request as any).totalAmount || (amount + gstAmount);
  const priority = request.priority;
  const status = request.status;
  const priorityStyle = getPriorityColor(priority);

  const vendorName = request.vendor?.name || (request as any).vendor_name || 'Vendor N/A';
  const vendorCode = request.vendor?.vendorCode || (request as any).vendor_code || '';
  const vendorBank = request.vendor?.bankName || (request as any).bank_account || '-';
  const vendorAccount = request.vendor?.accountNumber || (request as any).bank_account || '-';
  const vendorIfsc = request.vendor?.ifscCode || '-';
  const vendorPan = request.vendor?.panNumber || '-';
  const vendorGst = request.vendor?.gstNumber || '-';

  const companyName = request.company?.name || (request as any).company_name || 'Default Entity';
  const departmentName = request.department?.name || (request as any).department_name || 'Department N/A';
  const requesterName = request.requester?.fullName || (request as any).requester_name || 'System Requester';
  const requesterEmail = request.requester?.email || '';

  const invoiceNumber = request.invoiceNumber || (request as any).invoice_number || '-';
  const invoiceDate = request.invoiceDate || (request as any).invoice_date;
  const dueDate = request.dueDate || (request as any).due_date;
  const paymentMode = request.paymentMode || (request as any).payment_mode || 'NEFT';
  const expenseCategory = request.expenseCategory || (request as any).expense_category || 'OTHER';
  const expenseSubcategory = (request as any).expense_subcategory || '-';
  const remarks = request.remarks || (request as any).remarks || '-';

  // Documents
  const documents: PaymentRequestDocument[] = request.documents || (request as any).attachments || [];

  // Approval history & clarifications
  const approvalRecords: ApprovalRecord[] =
    (historyData as any)?.approval_records ||
    (Array.isArray(historyData) ? historyData : request.approvalRecords) ||
    [];

  const clarificationMessages: ClarificationMessage[] =
    (historyData as any)?.clarification_messages ||
    request.clarificationMessages ||
    [];

  // Payment Record
  const paymentRecord = request.paymentRecord || (request as any).payment_record;

  // Status checks
  const isDraft = status === RequestStatus.DRAFT;
  const isPendingApproval =
    status === RequestStatus.UNDER_REVIEW ||
    status === RequestStatus.SUBMITTED ||
    (status as string) === 'PENDING_APPROVAL';
  const isClarificationRequired =
    status === RequestStatus.CLARIFICATION_REQUESTED ||
    (status as string) === 'CLARIFICATION_REQUIRED';
  const isApproved =
    status === RequestStatus.APPROVED ||
    status === RequestStatus.PAYMENT_SCHEDULED ||
    status === RequestStatus.PAID;
  const isPaid = status === RequestStatus.PAID;

  // Handlers
  const handleDownload = async (docId: string, filename?: string) => {
    try {
      await downloadDocMutation.mutateAsync({
        requestId: request.id,
        docId,
        filename: filename || 'attachment.pdf',
      });
    } catch {
      toast.error('Failed to download document');
    }
  };

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync(request.id);
      setShowSubmitModal(false);
      refetchRequest();
    } catch {
      // Handled by mutation
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ id: request.id, reason: cancelReason });
      setShowCancelModal(false);
      refetchRequest();
    } catch {
      // Handled by mutation
    }
  };

  const handleApprove = async () => {
    try {
      const parsedAmount = approvedAmountInput ? parseFloat(approvedAmountInput) : undefined;
      await approveMutation.mutateAsync({
        requestId: request.id,
        comment: approvalComment,
        approvedAmount: parsedAmount,
      });
      setShowApproveModal(false);
      setApprovalComment('');
      setApprovedAmountInput('');
      refetchRequest();
      refetchHistory();
    } catch {
      // Handled by mutation
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        requestId: request.id,
        reason: rejectionReason.trim(),
      });
      setShowRejectModal(false);
      setRejectionReason('');
      refetchRequest();
      refetchHistory();
    } catch {
      // Handled by mutation
    }
  };

  const handleClarify = async () => {
    if (!clarificationQuery.trim()) {
      toast.error('Please enter a clarification question');
      return;
    }
    try {
      await requestClarificationMutation.mutateAsync({
        requestId: request.id,
        message: clarificationQuery.trim(),
      });
      setShowClarifyModal(false);
      setClarificationQuery('');
      refetchRequest();
      refetchHistory();
    } catch {
      // Handled by mutation
    }
  };

  const handleSendClarificationResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarificationResponse.trim()) {
      toast.error('Please enter your clarification response');
      return;
    }
    try {
      await respondClarificationMutation.mutateAsync({
        requestId: request.id,
        message: clarificationResponse.trim(),
      });
      setClarificationResponse('');
      refetchRequest();
      refetchHistory();
    } catch {
      // Handled by mutation
    }
  };

  const handleOpenRecordPayment = () => {
    setPaymentAmountInput(totalAmount.toString());
    setPaymentDateInput(new Date().toISOString().split('T')[0]);
    setPaymentModeInput((paymentMode as PaymentMode) || PaymentMode.NEFT);
    setPaymentBankAccount(vendorAccount !== '-' ? vendorAccount : '');
    setPaymentUtr('');
    setPaymentRemarksInput('');
    setShowRecordPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentUtr.trim()) {
      toast.error('UTR / Cheque / Transaction reference is required');
      return;
    }
    const parsedAmount = parseFloat(paymentAmountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid disbursement amount');
      return;
    }

    try {
      await recordPaymentMutation.mutateAsync({
        requestId: request.id,
        data: {
          actualAmount: parsedAmount,
          paymentDate: paymentDateInput ? new Date(paymentDateInput).toISOString() : new Date().toISOString(),
          paymentMode: paymentModeInput,
          utrNumber: paymentUtr.trim(),
          bankAccount: paymentBankAccount.trim() || undefined,
          paymentRemarks: paymentRemarksInput.trim() || undefined,
        },
      });
      setShowRecordPaymentModal(false);
      refetchRequest();
      refetchHistory();
    } catch {
      // Handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Back Navigation / Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <button
          type="button"
          onClick={() => navigate('/payment-requests')}
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to all payment requests
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchRequest();
              refetchHistory();
            }}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print Voucher
          </Button>
        </div>
      </div>

      {/* Main Request Title Banner */}
      <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-dark-border shadow-xs border-t-4 border-t-navy-800 dark:border-t-cyan-500">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-navy-800 dark:text-cyan-400 bg-navy-50 dark:bg-navy-950/80 px-2.5 py-1 rounded-md border border-navy-100 dark:border-navy-900">
                {reqNumber}
              </span>
              <StatusBadge status={status} size="sm" />
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityStyle.badge}`}
              >
                {priority} Priority
              </span>
              {invoiceNumber && invoiceNumber !== '-' && (
                <span className="text-xs text-slate-500 font-medium">
                  Invoice: <strong className="text-slate-800 dark:text-slate-200 font-mono">{invoiceNumber}</strong>
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              {description}
            </p>
          </div>

          {/* Amount Overview Pill */}
          <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-100 dark:border-dark-border min-w-[240px] text-left lg:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Disbursement Amount
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono block mt-0.5">
              {formatCurrency(totalAmount)}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 flex lg:justify-end gap-3">
              <span>Base: {formatCurrency(amount)}</span>
              {gstAmount > 0 && <span>GST: {formatCurrency(gstAmount)}</span>}
            </div>
            {totalAmount > 0 && (
              <div className="text-[10px] text-navy-800 dark:text-cyan-400 italic mt-1 font-semibold lg:text-right">
                {numberToIndianWords(totalAmount)}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Action Buttons Ribbon */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-dark-border flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            {/* Status explanation */}
            <span className="text-xs text-slate-500">
              Current Status:{' '}
              <strong className="text-slate-800 dark:text-slate-200">{getStatusLabel(status)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Creator / Accountant Actions */}
            {isDraft && (isCreator || isAccountant) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/payment-requests/edit/${request.id}`)}
                  leftIcon={<Edit3 className="w-4 h-4" />}
                >
                  Edit Requisition
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowSubmitModal(true)}
                  leftIcon={<Send className="w-4 h-4" />}
                  isLoading={submitMutation.isPending}
                >
                  Submit for Approval
                </Button>
              </>
            )}

            {/* Cancel Request (Requester or Admin before completion) */}
            {(isDraft || isPendingApproval) && (isCreator || isAdmin) && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                leftIcon={<Ban className="w-4 h-4" />}
              >
                Cancel Request
              </Button>
            )}

            {/* Approver Actions (when Pending Approval) */}
            {isPendingApproval && isApprover && (
              <>
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => setShowClarifyModal(true)}
                  leftIcon={<HelpCircle className="w-4 h-4" />}
                >
                  Request Clarification
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => setShowApproveModal(true)}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Approve Requisition
                </Button>
              </>
            )}

            {/* Accountant Record Payment Disbursement Button if Approved */}
            {isApproved && isAccountant && !isPaid && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenRecordPayment}
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                Record Payment Disbursement
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Clarification Alert Banner (if pending response) */}
      {isClarificationRequired && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Clarification Requested by Approver
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              The reviewer has requested additional information or supporting documentation before approving this requisition. Please post your response in the discussion ledger below.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Details (Left 2 cols) & Timeline (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Details & Documents & Ledger */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Entity Information Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendor Details */}
            <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Building2 className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                <span>Vendor Details</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {vendorName}
                </p>
                {vendorCode && (
                  <p className="text-xs font-mono text-slate-400">{vendorCode}</p>
                )}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-dark-border">
                <p className="flex justify-between">
                  <span className="text-slate-400">Bank Name:</span>
                  <span className="font-medium">{vendorBank}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Account No:</span>
                  <span className="font-mono font-medium">{vendorAccount}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">IFSC Code:</span>
                  <span className="font-mono font-medium">{vendorIfsc}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">PAN / GST:</span>
                  <span className="font-mono text-[11px]">{vendorPan} / {vendorGst}</span>
                </p>
              </div>
            </div>

            {/* Organization & Requester Details */}
            <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <User className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
                <span>Requester & Organization</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {requesterName}
                </p>
                <p className="text-xs text-slate-400">{requesterEmail}</p>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2 border-t border-slate-100 dark:border-dark-border">
                <p className="flex justify-between">
                  <span className="text-slate-400">Company Entity:</span>
                  <span className="font-medium">{companyName}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-medium">{departmentName}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Created Date:</span>
                  <span>{formatDate(request.createdAt)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Due Date:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {formatDate(dueDate)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Financial & Invoice Breakdown */}
          <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
              Financial & Invoicing Information
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Base Amount
                </span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {formatCurrency(amount)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  GST Amount
                </span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {formatCurrency(gstAmount)}
                </span>
              </div>

              <div className="p-3 bg-navy-50 dark:bg-navy-950/60 rounded-lg border border-navy-100 dark:border-navy-900">
                <span className="text-[10px] uppercase font-bold text-navy-800 dark:text-cyan-400 block">
                  Total Payable
                </span>
                <span className="text-base font-extrabold font-mono text-navy-900 dark:text-cyan-300">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Payment Mode
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {paymentMode}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-dark-border text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Expense Category</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {getExpenseCategoryLabel(expenseCategory)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Subcategory</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {expenseSubcategory}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Invoice Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(invoiceDate)}
                </span>
              </div>
            </div>

            {remarks && remarks !== '-' && (
              <div className="pt-2 border-t border-slate-100 dark:border-dark-border text-xs">
                <span className="text-slate-400 block text-[11px] mb-1">Additional Remarks</span>
                <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/60 dark:border-dark-border">
                  {remarks}
                </p>
              </div>
            )}
          </div>

          {/* Payment Record Section (if paid or scheduled) */}
          {paymentRecord && (
            <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-emerald-200 dark:border-emerald-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Disbursement Execution Record
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {paymentRecord.status || 'PAID'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">UTR / Ref #</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {paymentRecord.utrNumber || paymentRecord.transactionReference || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Paid Amount</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatCurrency(paymentRecord.amountPaid || totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Disbursed Date</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatDateTime(paymentRecord.paymentDate || paymentRecord.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Mode</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {paymentRecord.paymentMode || paymentMode}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Documents Section */}
          <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
              Attached Supporting Invoices & Files ({documents.length})
            </h3>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No supporting documents were attached to this requisition.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-dark-border">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                        {doc.fileType || 'PDF'}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {doc.originalName || doc.fileName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatFileSize(doc.fileSize)} &bull; Uploaded {formatDate(doc.uploadedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc.id, doc.originalName || doc.fileName)}
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clarification Chat Ledger */}
          <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
              <span>Clarification Discussion Thread</span>
            </div>

            {clarificationMessages.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No clarification queries have been initiated on this payment requisition.
              </p>
            ) : (
              <div className="space-y-3">
                {clarificationMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-dark-border"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {msg.sender?.fullName || 'Reviewer'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Post Clarification Response Form */}
            {(isClarificationRequired || isCreator || isApprover) && (
              <form onSubmit={handleSendClarificationResponse} className="flex gap-2 pt-2">
                <Input
                  type="text"
                  placeholder="Provide clarification response or additional explanation..."
                  value={clarificationResponse}
                  onChange={(e) => setClarificationResponse(e.target.value)}
                  className="flex-1 text-xs"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  isLoading={respondClarificationMutation.isPending}
                >
                  Reply
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Multi-level Approval Journey & Audit Log */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-navy-700 dark:text-cyan-400" />
              Approval Journey
            </h3>

            {isLoadingHistory ? (
              <div className="py-6 flex justify-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : approvalRecords.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Awaiting submission into the approval workflow.
              </p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {approvalRecords.map((rec, idx) => {
                  const isApprovedAction =
                    rec.status === ApprovalAction.APPROVED || (rec.status as string) === 'APPROVED';
                  const isRejectedAction =
                    rec.status === ApprovalAction.REJECTED || (rec.status as string) === 'REJECTED';
                  const isClarifyAction =
                    rec.status === ApprovalAction.CLARIFICATION_REQUESTED ||
                    (rec.status as string) === 'CLARIFICATION_REQUESTED';

                  return (
                    <div key={rec.id || idx} className="relative">
                      {/* Status Icon Marker */}
                      <div
                        className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isApprovedAction
                            ? 'bg-emerald-500 text-white'
                            : isRejectedAction
                            ? 'bg-rose-500 text-white'
                            : isClarifyAction
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-400 text-white'
                        }`}
                      >
                        {isApprovedAction ? '✓' : isRejectedAction ? '✕' : '?'}
                      </div>

                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900 dark:text-white">
                            Level {rec.level || idx + 1}: {rec.approver?.fullName || 'Approver'}
                          </p>
                          <span
                            className={`text-[10px] font-semibold uppercase ${
                              isApprovedAction
                                ? 'text-emerald-600'
                                : isRejectedAction
                                ? 'text-rose-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {formatDateTime(rec.actionDate || rec.createdAt)}
                        </p>
                        {rec.comments && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-dark-border italic mt-1.5">
                            "{rec.comments}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs & Action Modals */}

      {/* Submit Requisition Modal */}
      <ConfirmDialog
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        actionType="approve"
        title="Submit Payment Requisition"
        message="Are you sure you want to submit this payment requisition for review? It will advance to Level 1 approvers."
        confirmText="Submit Requisition"
        isLoading={submitMutation.isPending}
      />

      {/* Cancel Requisition Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Payment Request"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Cancelling this requisition will withdraw it from the approval pipeline permanently. Please provide a cancellation justification.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cancellation Reason (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="e.g., Duplicate order, invoice terms modified by vendor..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCancelModal(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              isLoading={cancelMutation.isPending}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Payment Requisition"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Confirm your formal sign-off for <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(totalAmount)}</strong> to <strong className="text-slate-800 dark:text-slate-200">{vendorName}</strong>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Adjusted Approved Amount (₹ - Optional)
            </label>
            <Input
              type="number"
              placeholder={totalAmount.toString()}
              value={approvedAmountInput}
              onChange={(e) => setApprovedAmountInput(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Approval Comments / Audit Notes (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="e.g., Verified against PO & stock delivery receipt. Approved for payment."
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleApprove}
              isLoading={approveMutation.isPending}
            >
              Confirm Approval
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Payment Requisition"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Please enter a mandatory audit justification explaining why this payment request is being rejected. The requester will be notified immediately.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="e.g., Pricing mismatch with vendor master agreement; duplicate billing detected."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              isLoading={rejectMutation.isPending}
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Clarification Modal */}
      <Modal
        isOpen={showClarifyModal}
        onClose={() => setShowClarifyModal(false)}
        title="Request Clarification"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Specify the information, invoice revisions, or supporting receipts you require from the requester. The requisition status will change to <span className="font-semibold text-amber-600">Clarification Required</span>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clarification Inquiry <span className="text-red-500">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="e.g., Please attach the signed Goods Receipt Note (GRN) and clarify the 5% tax deduction rate."
              value={clarificationQuery}
              onChange={(e) => setClarificationQuery(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowClarifyModal(false)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={handleClarify}
              isLoading={requestClarificationMutation.isPending}
              disabled={!clarificationQuery.trim()}
            >
              Submit Inquiry
            </Button>
          </div>
        </div>
      </Modal>

      {/* Record Payment Disbursement Modal (Accountant) */}
      <Modal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        title="Record Bank Payment Disbursement"
        size="md"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Record the bank transaction reference (UTR / Cheque) for <strong className="text-slate-800 dark:text-slate-200">{vendorName}</strong>. This will transition the requisition status to <strong className="text-emerald-600">PAID</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Disbursed Net Amount (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                required
                value={paymentAmountInput}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode <span className="text-red-500">*</span>
              </label>
              <Select
                value={paymentModeInput}
                onChange={(e) => setPaymentModeInput(e.target.value as PaymentMode)}
                className="text-xs"
              >
                <option value={PaymentMode.NEFT}>NEFT - National Electronic Funds Transfer</option>
                <option value={PaymentMode.RTGS}>RTGS - Real Time Gross Settlement</option>
                <option value={PaymentMode.IMPS}>IMPS - Immediate Payment Service</option>
                <option value={PaymentMode.UPI}>UPI - Unified Payments Interface</option>
                <option value={PaymentMode.CHEQUE}>CHEQUE - Physical Bank Cheque</option>
                <option value={PaymentMode.CASH}>CASH - Petty Cash</option>
                <option value={PaymentMode.OTHER}>OTHER - Other Payment Method</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bank UTR / Cheque / Transaction Ref # <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              placeholder="e.g., HDFC261123987654 or CHQ#440912"
              value={paymentUtr}
              onChange={(e) => setPaymentUtr(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Disbursement Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                required
                value={paymentDateInput}
                onChange={(e) => setPaymentDateInput(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Disbursed Bank Account
              </label>
              <Input
                type="text"
                placeholder="Disbursing Account No."
                value={paymentBankAccount}
                onChange={(e) => setPaymentBankAccount(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Disbursement Remarks (Optional)
            </label>
            <Textarea
              rows={2}
              placeholder="e.g., Debited from Corporate Current A/c. Receipt acknowledged."
              value={paymentRemarksInput}
              onChange={(e) => setPaymentRemarksInput(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-dark-border">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowRecordPaymentModal(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              isLoading={recordPaymentMutation.isPending}
              disabled={!paymentUtr.trim() || !paymentAmountInput}
            >
              Record & Mark Paid
            </Button>
          </div>
        </form>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.originalName || previewDoc?.fileName || 'Document Preview'}
        size="lg"
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-dark-border">
              <span>Type: <strong className="uppercase">{previewDoc.fileType || previewDoc.mimeType}</strong></span>
              <span>Size: <strong>{formatFileSize(previewDoc.fileSize)}</strong></span>
              <span>Uploaded: <strong>{formatDate(previewDoc.uploadedAt)}</strong></span>
            </div>

            <div className="min-h-[260px] max-h-[500px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-dark-border p-3">
              {previewDoc.mimeType?.startsWith('image/') || previewDoc.fileName?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img
                  src={previewDoc.fileUrl || `/api/payment-requests/${request.id}/documents/${previewDoc.id}/download`}
                  alt={previewDoc.originalName}
                  className="max-h-[460px] object-contain rounded-lg shadow-xs"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-16 h-16 text-navy-600 dark:text-cyan-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {previewDoc.originalName || previewDoc.fileName}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    This document format can be inspected using your default document viewer. Click below to download.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDownload(previewDoc.id, previewDoc.originalName || previewDoc.fileName)}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Download Attachment ({formatFileSize(previewDoc.fileSize)})
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownload(previewDoc.id, previewDoc.originalName || previewDoc.fileName)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download File
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentRequestDetail;
