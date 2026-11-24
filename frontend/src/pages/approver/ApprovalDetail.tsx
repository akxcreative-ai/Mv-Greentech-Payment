import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Building2,
  FileText,
  CreditCard,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  Download,
  Eye,
  MessageSquare,
  Send,
  Paperclip,
  Check,
  ChevronRight,
  TrendingDown,
  Info,
  DollarSign,
  Briefcase,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  Modal,
  Input,
  Textarea,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui';
import {
  usePaymentRequest,
  useDownloadDocument,
} from '@/hooks/usePaymentRequests';
import {
  useApprovalHistory,
  useApproveRequest,
  useRejectRequest,
  useRequestClarification,
  useRespondToClarification,
} from '@/hooks/useApprovals';
import {
  PaymentRequest,
  Priority,
  ExpenseCategory,
  PaymentMode,
  RequestStatus,
  ApprovalAction,
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
  getStatusColor,
} from '@/utils/format';
import { useAuthStore } from '@/store/authStore';

export const ApprovalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Queries
  const { data: apiRequest, isLoading: isRequestLoading } = usePaymentRequest(id || '', {
    enabled: Boolean(id),
  });
  const { data: historyData } = useApprovalHistory(id || '', {
    enabled: Boolean(id),
  });
  const downloadMutation = useDownloadDocument();

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const clarifyMutation = useRequestClarification();
  const respondClarifyMutation = useRespondToClarification();

  // Dialog States
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState('');

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const [isClarifyOpen, setIsClarifyOpen] = useState(false);
  const [clarifyMessage, setClarifyMessage] = useState('');
  const [clarifyError, setClarifyError] = useState('');

  // Clarification Thread Reply input
  const [replyMessage, setReplyMessage] = useState('');

  // Selected Document for preview modal
  const [previewDoc, setPreviewDoc] = useState<PaymentRequestDocument | null>(null);

  // Normalize Request Data
  const request: PaymentRequest | null = useMemo(() => {
    if (apiRequest) return apiRequest;
    return null;
  }, [apiRequest]);

  const approvalHistory: ApprovalRecord[] = useMemo(() => {
    if (historyData && historyData.length > 0) return historyData;
    if (request?.approvalRecords && request.approvalRecords.length > 0) return request.approvalRecords;
    return [];
  }, [historyData, request]);

  const clarificationList: ClarificationMessage[] = useMemo(() => {
    if (request?.clarificationMessages && request.clarificationMessages.length > 0) {
      return request.clarificationMessages;
    }
    return [];
  }, [request]);

  const priorityStyle = getPriorityColor((request?.priority || Priority.NORMAL) as Priority);
  const amount = Number(request?.amount ?? (request as any)?.total_amount ?? 0);
  const remainingBudget =
    request?.department?.budget && request?.department?.currentSpend
      ? request.department.budget - request.department.currentSpend - amount
      : null;

  // Handlers
  const handleOpenApprove = () => {
    setApproveComment('');
    setAdjustedAmount(String(amount));
    setIsApproveOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!request) return;
    try {
      const finalAdjAmount = adjustedAmount ? parseFloat(adjustedAmount) : undefined;
      await approveMutation.mutateAsync({
        requestId: request.id,
        comment: approveComment.trim() || undefined,
        approvedAmount: finalAdjAmount,
      });
      setIsApproveOpen(false);
      navigate('/approvals');
    } catch {
      // toast shown by hook
    }
  };

  const handleOpenReject = () => {
    setRejectReason('');
    setRejectError('');
    setIsRejectOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!request) return;
    if (!rejectReason.trim()) {
      setRejectError('Rejection justification is mandatory for compliance audit trail.');
      return;
    }
    if (rejectReason.trim().length < 5) {
      setRejectError('Please provide a substantive justification (minimum 5 characters).');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        requestId: request.id,
        reason: rejectReason.trim(),
      });
      setIsRejectOpen(false);
      navigate('/approvals');
    } catch {
      // toast shown by hook
    }
  };

  const handleOpenClarify = () => {
    setClarifyMessage('');
    setClarifyError('');
    setIsClarifyOpen(true);
  };

  const handleConfirmClarify = async () => {
    if (!request) return;
    if (!clarifyMessage.trim()) {
      setClarifyError('Please enter your question or request for information.');
      return;
    }

    try {
      await clarifyMutation.mutateAsync({
        requestId: request.id,
        message: clarifyMessage.trim(),
      });
      setIsClarifyOpen(false);
      navigate('/approvals');
    } catch {
      // toast shown by hook
    }
  };

  const handleSendReply = async () => {
    if (!request) return;
    if (!replyMessage.trim()) return;
    try {
      await respondClarifyMutation.mutateAsync({
        requestId: request.id,
        message: replyMessage.trim(),
      });
      setReplyMessage('');
    } catch {
      // handled
    }
  };

  const handleDownloadDoc = (doc: PaymentRequestDocument) => {
    if (!request) return;
    downloadMutation.mutate({
      requestId: request.id,
      docId: doc.id,
      filename: doc.fileName || doc.originalName,
    });
  };

  if (!request && !isRequestLoading) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 shadow-sm">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Payment Request Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">The requested voucher does not exist or has been removed.</p>
        <Link to="/approvals" className="mt-4 inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Approvals
        </Link>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 max-w-6xl mx-auto">
      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/approvals"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-navy-700 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Pending Approvals Queue
        </Link>
        <span className="text-xs text-slate-400">
          Requisition ID: <strong className="font-mono text-slate-700 dark:text-slate-200">{request.requestNumber || request.id}</strong>
        </span>
      </div>

      {/* Hero Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-navy-800 dark:text-navy-300 bg-navy-50 dark:bg-navy-950/60 px-2.5 py-1 rounded border border-navy-200 dark:border-navy-800">
                {request.requestNumber || request.id}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${priorityStyle.badge}`}>
                {request.priority} PRIORITY
              </span>
              <StatusBadge status={request.status} />
              <span className="text-xs text-slate-400">
                Level {request.currentApprovalLevel || 1} of {request.totalApprovalLevels || 2} Sign-off
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {request.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              {request.description || 'No detailed memo provided for this requisition.'}
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end justify-center bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700 min-w-[240px]">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Requisition Gross Amount
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {formatCurrency(amount)}
            </div>
            <span className="text-2xs text-slate-500 mt-1 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-slate-400" />
              Disbursement Mode: <strong className="text-slate-700 dark:text-slate-200">{request.paymentMode}</strong>
            </span>

            {/* Desktop Action Buttons in Header */}
            <div className="hidden lg:flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 w-full justify-end">
              <Button
                type="button"
                variant="warning"
                size="md"
                leftIcon={<HelpCircle className="w-4 h-4" />}
                onClick={handleOpenClarify}
                className="font-bold text-xs shadow-sm"
              >
                CLARIFY
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                leftIcon={<XCircle className="w-4 h-4" />}
                onClick={handleOpenReject}
                className="font-bold text-xs shadow-sm"
              >
                REJECT
              </Button>
              <Button
                type="button"
                variant="success"
                size="md"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleOpenApprove}
                className="font-black text-xs px-4 shadow-md"
              >
                APPROVE
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">Submitted By</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {request.requester?.fullName || (request as any).requested_by_name || 'Requester'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Submitted On</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDateTime(request.createdAt || (request as any).created_at)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Payment Due Date</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {request.dueDate ? formatDate(request.dueDate) : 'Immediate'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Expense Category</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {String(request.expenseCategory || 'GENERAL').replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns for Requisition Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Vendor, Bank & Organization Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vendor & Banking Information */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-navy-700 dark:text-navy-300" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Vendor & Remittance Banking
                </h3>
              </div>
              {request.vendor?.vendorCode && (
                <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                  {request.vendor.vendorCode}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Vendor Legal Entity</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {request.vendor?.name || (request as any).vendor_name}
                </span>
                {request.vendor?.address && (
                  <p className="text-2xs text-slate-500 mt-0.5">{request.vendor.address}</p>
                )}
              </div>
              <div>
                <span className="text-slate-400 block">GSTIN & PAN</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  GST: {request.vendor?.gstNumber || 'Not Provided'}
                </span>
                <div className="font-mono text-2xs text-slate-500">
                  PAN: {request.vendor?.panNumber || 'Not Provided'}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-2xs uppercase tracking-wider font-bold text-slate-500">
                Beneficiary Bank Account Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Bank Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {request.vendor?.bankName || 'SBI'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Account Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tracking-wider">
                    {request.vendor?.accountNumber || '•••• •••• ••••'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">IFSC Code</span>
                  <span className="font-mono font-bold text-navy-700 dark:text-navy-300">
                    {request.vendor?.ifscCode || 'SBIN0001234'}
                  </span>
                </div>
              </div>
              {request.vendor?.branchName && (
                <div className="text-2xs text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  Branch: {request.vendor.branchName}
                </div>
              )}
            </div>
          </Card>

          {/* Invoice & Billing Context */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <FileText className="w-4 h-4 text-navy-700 dark:text-navy-300" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Invoice & Billing Information
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {request.invoiceNumber || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Invoice Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {request.invoiceDate ? formatDate(request.invoiceDate) : '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Due Date</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {request.dueDate ? formatDate(request.dueDate) : '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Mode</span>
                <span className="font-bold text-navy-700 dark:text-navy-300">
                  {request.paymentMode}
                </span>
              </div>
            </div>

            {request.remarks && (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-lg border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold block mb-0.5">Requester Special Remarks:</span>
                {request.remarks}
              </div>
            )}
          </Card>

          {/* Supporting Documents Dossier */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-navy-700 dark:text-navy-300" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Supporting Documents ({request.documents?.length || 0})
                </h3>
              </div>
              <span className="text-2xs text-slate-400">Mandatory for statutory verification</span>
            </div>

            {request.documents && request.documents.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {request.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {doc.fileName || doc.originalName}
                        </div>
                        <div className="text-2xs text-slate-400">
                          {formatFileSize(doc.fileSize)} • Uploaded {formatDate(doc.uploadedAt)} by {doc.uploadedBy || 'Requester'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                        className="text-xs"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadDoc(doc)}
                        className="text-xs"
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                No supporting documents attached to this requisition.
              </p>
            )}
          </Card>

          {/* Interactive Clarification Dialogue Thread */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Clarification Messages Thread ({clarificationList.length})
                </h3>
              </div>
              <span className="text-2xs text-slate-400">Audited dialogue between approver & requester</span>
            </div>

            <div className="space-y-3">
              {clarificationList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No clarification queries raised yet. If information is missing, click "Request Clarification" below.
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {clarificationList.map((msg) => {
                    const isCurrentUser = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          isCurrentUser
                            ? 'bg-navy-50/70 dark:bg-navy-950/40 border-navy-200 dark:border-navy-800 ml-6'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 mr-6'
                        }`}
                      >
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {msg.sender?.fullName || 'Participant'}{' '}
                            <span className="font-normal text-slate-400">
                              ({msg.sender?.designation || msg.sender?.role || 'Team Member'})
                            </span>
                          </span>
                          <span className="text-slate-400">{formatDateTime(msg.createdAt)}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Reply Form inside the thread */}
              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a clarification message or query for the requester..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || respondClarifyMutation.isPending}
                  isLoading={respondClarifyMutation.isPending}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  className="text-xs px-4"
                >
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Budget Impact & Approval History Timeline */}
        <div className="space-y-6">
          {/* Department Budget Health Widget */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Briefcase className="w-4 h-4 text-navy-700 dark:text-navy-300" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Department & Budget Impact
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Company & Department</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {request.company?.name || 'MV Group'}
                </span>
                <div className="text-slate-600 dark:text-slate-300">
                  {request.department?.name || 'Procurement'} ({request.department?.code || 'DEPT'})
                </div>
              </div>

              {request.department?.budget && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Annual Budget:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(request.department.budget)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Spend:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(request.department.currentSpend || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">This Requisition:</span>
                    <span className="font-bold text-navy-700 dark:text-navy-300">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  {remainingBudget !== null && (
                    <div className="flex justify-between pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Remaining Post-Approval:
                      </span>
                      <span
                        className={`font-black ${
                          remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(remainingBudget)}
                      </span>
                    </div>
                  )}

                  {/* Visual Progress Bar */}
                  {request.department.budget > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-navy-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (((request.department.currentSpend || 0) + amount) /
                                  request.department.budget) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-2xs text-slate-400 block text-right">
                        {Math.round(
                          (((request.department.currentSpend || 0) + amount) /
                            request.department.budget) *
                            100
                        )}
                        % Budget Allocated
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Multi-Level Approval History Timeline */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Approval Sign-off Chain
              </h3>
            </div>

            <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {approvalHistory.map((step, idx) => {
                const isApproved = step.status === ApprovalAction.APPROVED;
                const isRejected = step.status === ApprovalAction.REJECTED;
                const isCurrent = step.level === (request.currentApprovalLevel || 1);

                return (
                  <div key={step.id || idx} className="relative flex items-start gap-3 pl-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold border-2 ${
                        isApproved
                          ? 'bg-emerald-600 text-white border-emerald-200 dark:border-emerald-900'
                          : isRejected
                          ? 'bg-rose-600 text-white border-rose-200 dark:border-rose-900'
                          : isCurrent
                          ? 'bg-amber-500 text-white border-amber-200 dark:border-amber-900 animate-pulse'
                          : 'bg-slate-100 text-slate-400 border-slate-300 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      {isApproved ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isRejected ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : (
                        step.level
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Level {step.level}: {step.approver?.fullName || `Approver Level ${step.level}`}
                        </span>
                        <span
                          className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                              : isCurrent
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-slate-400">
                        {step.approver?.designation || step.approver?.role || 'Designated Approver'}
                      </p>
                      {step.actionDate && (
                        <p className="text-2xs text-slate-400">
                          {formatDateTime(step.actionDate)}
                        </p>
                      )}
                      {step.comments && (
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700 text-2xs text-slate-600 dark:text-slate-300 italic">
                          "{step.comments}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* MOBILE-OPTIMIZED STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs text-slate-500">Requisition:</span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              {request.requestNumber || request.id}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              • {formatCurrency(amount)}
            </span>
          </div>

          {/* LARGE TOUCH-FRIENDLY ACTION BUTTONS */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="warning"
              size="lg"
              leftIcon={<HelpCircle className="w-5 h-5" />}
              onClick={handleOpenClarify}
              className="flex-1 sm:flex-none font-bold text-sm min-h-[48px] px-5 shadow-sm active:scale-95 transition-transform"
            >
              CLARIFY
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              leftIcon={<XCircle className="w-5 h-5" />}
              onClick={handleOpenReject}
              className="flex-1 sm:flex-none font-bold text-sm min-h-[48px] px-6 shadow-sm active:scale-95 transition-transform"
            >
              REJECT
            </Button>
            <Button
              type="button"
              variant="success"
              size="lg"
              leftIcon={<CheckCircle2 className="w-5 h-5" />}
              onClick={handleOpenApprove}
              className="flex-1 sm:flex-none font-black text-base min-h-[48px] px-8 shadow-lg shadow-emerald-600/25 active:scale-95 transition-transform"
            >
              APPROVE
            </Button>
          </div>
        </div>
      </div>

      {/* CRITICAL: APPROVE CONFIRMATION MODAL */}
      <Modal
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        title={
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Confirm Formal Payment Approval</span>
          </div>
        }
        description="Are you sure you want to approve this payment? This action executes statutory governance sign-off."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsApproveOpen(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="success"
              size="md"
              isLoading={approveMutation.isPending}
              loadingText="Authorizing..."
              onClick={handleConfirmApprove}
              className="font-bold px-6 shadow-md"
            >
              Confirm Approval
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-2">
            <div className="text-xs uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-300">
              Requisition Sign-off Summary
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Request ID:</span>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {request.requestNumber || request.id}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Vendor:</span>
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {request.vendor?.name || (request as any).vendor_name}
                </div>
              </div>
              <div className="col-span-2 pt-1">
                <span className="text-slate-500 dark:text-slate-400">Gross Requisition Amount:</span>
                <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(amount)}
                </div>
              </div>
            </div>
          </div>

          {/* Optional Adjusted Amount */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adjusted Approved Amount (₹) <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={adjustedAmount}
              onChange={(e) => setAdjustedAmount(e.target.value)}
              placeholder="Leave unchanged to authorize full ₹ amount"
            />
            <p className="text-2xs text-slate-400">
              Modify only if statutory deductions (TDS, GST withholds) or negotiated credits apply.
            </p>
          </div>

          {/* Optional Comment */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Approval Remarks / Audit Notes <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <Textarea
              rows={3}
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="e.g., Reviewed delivery challan and invoice. Authorized for immediate disbursement."
            />
          </div>
        </div>
      </Modal>

      {/* CRITICAL: REJECT CONFIRMATION MODAL */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title={
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <XCircle className="w-5 h-5 text-rose-600" />
            <span>Reject Payment Requisition</span>
          </div>
        }
        description="Formal rejection cancels this requisition. A mandatory reason is required for statutory audit compliance."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsRejectOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              isLoading={rejectMutation.isPending}
              loadingText="Rejecting..."
              onClick={handleConfirmReject}
              className="font-bold px-6 shadow-md"
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs">
            <span className="font-semibold text-rose-900 dark:text-rose-200">Target Request:</span>{' '}
            <strong className="font-mono">{request.requestNumber || request.id}</strong> ({formatCurrency(amount)})
            to <strong>{request.vendor?.name || (request as any).vendor_name}</strong>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
              <span>Rejection Reason *</span>
              <span className="font-normal text-2xs text-slate-400">Required (min 5 characters)</span>
            </label>
            <Textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError('');
              }}
              placeholder="State the non-compliance, missing invoice, billing mismatch, or budgetary grounds..."
              className={rejectError ? 'border-rose-500 focus:ring-rose-500' : ''}
            />
            {rejectError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {rejectError}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* CLARIFICATION MODAL */}
      <Modal
        isOpen={isClarifyOpen}
        onClose={() => setIsClarifyOpen(false)}
        title={
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <HelpCircle className="w-5 h-5 text-amber-600" />
            <span>Request Clarification</span>
          </div>
        }
        description="Notify the requester to provide additional documents or clarification before sign-off."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsClarifyOpen(false)}
              disabled={clarifyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="warning"
              size="md"
              isLoading={clarifyMutation.isPending}
              loadingText="Sending..."
              onClick={handleConfirmClarify}
              className="font-bold px-6 shadow-md"
            >
              Send Request
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Clarification Message *</span>
              <span className="font-normal text-2xs text-slate-400">Will be emailed to {request.requester?.fullName || 'Requester'}</span>
            </label>
            <Textarea
              rows={4}
              value={clarifyMessage}
              onChange={(e) => {
                setClarifyMessage(e.target.value);
                if (clarifyError) setClarifyError('');
              }}
              placeholder="Explain the specific clarification or supporting document required to authorize this disbursement..."
              className={clarifyError ? 'border-amber-500 focus:ring-amber-500' : ''}
            />
            {clarifyError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {clarifyError}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* DOCUMENT PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-navy-700 dark:text-navy-300" />
            <span className="truncate max-w-md">{previewDoc?.fileName || previewDoc?.originalName}</span>
          </div>
        }
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            {previewDoc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadDoc(previewDoc)}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download Document
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setPreviewDoc(null)}>
              Close
            </Button>
          </div>
        }
      >
        {previewDoc && (
          <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-xl flex flex-col items-center justify-center min-h-[360px] border border-slate-200 dark:border-slate-800 space-y-3">
            <FileText className="w-16 h-16 text-slate-400" />
            <div className="text-center">
              <h4 className="font-bold text-slate-900 dark:text-white">
                {previewDoc.fileName || previewDoc.originalName}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                File Size: {formatFileSize(previewDoc.fileSize)} • Type: {previewDoc.mimeType || 'Document'}
              </p>
            </div>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Direct in-browser PDF/image rendering available in production environment. Click below to download original file.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownloadDoc(previewDoc)}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Download & Inspect
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalDetail;
