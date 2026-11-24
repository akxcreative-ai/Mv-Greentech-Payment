import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  MessageSquare,
  Send,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Eye,
  ExternalLink,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  usePaymentRequests,
  useUploadDocument,
} from '@/hooks/usePaymentRequests';
import { useRespondToClarification } from '@/hooks/useApprovals';
import {
  RequestStatus,
  PaymentRequest,
  ClarificationMessage,
} from '@/types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPriorityColor,
  getExpenseCategoryLabel,
} from '@/utils/format';
import {
  Button,
  SearchInput,
  StatusBadge,
  EmptyState,
  Textarea,
  FileUpload,
  UploadedFileItem,
  LoadingSpinner,
} from '@/components/ui';
import toast from 'react-hot-toast';

export const PendingClarification: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [search, setSearch] = useState('');
  const [responseInputs, setResponseInputs] = useState<Record<string, string>>({});
  const [fileAttachments, setFileAttachments] = useState<Record<string, UploadedFileItem[]>>({});
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);

  // Fetch payment requests for the current user
  const {
    data: requestsData,
    isLoading,
    isFetching,
    refetch,
  } = usePaymentRequests({
    requesterId: user?.id,
  });

  const respondMutation = useRespondToClarification();
  const uploadDocMutation = useUploadDocument();

  // Filter requests that are in CLARIFICATION_REQUIRED or CLARIFICATION_REQUESTED status
  const pendingRequests = useMemo(() => {
    const list: PaymentRequest[] = requestsData?.data || [];
    return list.filter((r) => {
      const st = String(r.status);
      const isClarification =
        st === RequestStatus.CLARIFICATION_REQUESTED ||
        st === 'CLARIFICATION_REQUIRED' ||
        st === 'CLARIFICATION_REQUESTED';

      if (!isClarification) return false;

      if (!search.trim()) return true;

      const q = search.toLowerCase();
      const matchNumber = (r.requestNumber || r.id).toLowerCase().includes(q);
      const matchVendor = (r.vendor?.name || '').toLowerCase().includes(q);
      const matchInvoice = (r.invoiceNumber || '').toLowerCase().includes(q);
      const matchPurpose = (r.description || r.title || '').toLowerCase().includes(q);

      return matchNumber || matchVendor || matchInvoice || matchPurpose;
    });
  }, [requestsData?.data, search]);

  const handleInputChange = (requestId: string, value: string) => {
    setResponseInputs((prev) => ({
      ...prev,
      [requestId]: value,
    }));
  };

  const handleFilesChange = (requestId: string, files: UploadedFileItem[]) => {
    setFileAttachments((prev) => ({
      ...prev,
      [requestId]: files,
    }));
  };

  const handleSubmitResponse = async (requestId: string) => {
    const message = (responseInputs[requestId] || '').trim();
    if (!message || message.length < 5) {
      toast.error('Please enter a response of at least 5 characters');
      return;
    }

    setSubmittingRequestId(requestId);

    try {
      // 1. Submit the clarification message response
      await respondMutation.mutateAsync({
        requestId,
        message,
      });

      // 2. Upload any attached supporting documents
      const attachments = fileAttachments[requestId] || [];
      if (attachments.length > 0) {
        for (const item of attachments) {
          try {
            await uploadDocMutation.mutateAsync({
              requestId,
              file: item.file,
            });
          } catch {
            // Document error handled individually
          }
        }
      }

      toast.success(
        'Clarification response submitted! Requisition returned to Pending Approval status.'
      );

      // Reset form states for this request
      setResponseInputs((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setFileAttachments((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });

      refetch();
    } catch {
      toast.error('Failed to submit clarification response');
    } finally {
      setSubmittingRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Pending Clarifications
            </h1>
            {pendingRequests.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                {pendingRequests.length} Action Needed
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and respond to clarification requests raised by approvers to unblock your payment requisitions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching && !isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/payment-requests')}
          >
            All Requests
          </Button>
        </div>
      </div>

      {/* Information Banner */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold text-sm">
            Approver Inquiries Require Immediate Attention
          </p>
          <p className="text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
            Requisitions listed here are temporarily paused. Once you submit your response and any requested documents, the status will automatically return to <strong>Pending Approval</strong> and notify the reviewer to continue processing.
          </p>
        </div>
      </div>

      {/* Search Input */}
      {pendingRequests.length > 0 || search !== '' ? (
        <div className="max-w-md">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by Request #, vendor, invoice..."
            onClear={() => setSearch('')}
          />
        </div>
      ) : null}

      {/* Main Content: Pending Clarification Cards */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-500">Checking for clarification requests...</p>
        </div>
      ) : pendingRequests.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
          title="All Clarifications Resolved"
          description={
            search
              ? 'No pending clarifications matched your search query.'
              : 'You have answered all reviewer inquiries! None of your payment requests currently require clarification.'
          }
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/payment-requests')}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              View My Requests
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {pendingRequests.map((req) => {
            const reqNumber = req.requestNumber || req.id.slice(0, 8);
            const vendorName = req.vendor?.name || (req as any).vendor_name || 'Vendor N/A';
            const totalAmount =
              (req as any).total_amount ||
              (req as any).totalAmount ||
              Number(req.amount || 0);
            const priorityStyle = getPriorityColor(req.priority);

            // Get messages or latest message from approver
            const messages: ClarificationMessage[] = req.clarificationMessages || [];
            const latestInquiry =
              messages.length > 0 ? messages[messages.length - 1] : null;

            const currentResponse = responseInputs[req.id] || '';
            const isSubmittingThis = submittingRequestId === req.id;

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-xs overflow-hidden border-l-4 border-l-amber-500"
              >
                {/* Header Information Strip */}
                <div className="p-5 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Link
                        to={`/payment-requests/${req.id}`}
                        className="font-mono text-sm font-bold text-navy-800 dark:text-cyan-400 hover:underline"
                      >
                        {reqNumber}
                      </Link>
                      <StatusBadge status={req.status} size="sm" />
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityStyle.badge}`}
                      >
                        {req.priority}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {req.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Vendor: <strong className="text-slate-700 dark:text-slate-300">{vendorName}</strong></span>
                      {req.invoiceNumber && (
                        <>
                          <span>&bull;</span>
                          <span>Invoice: <strong className="font-mono text-slate-700 dark:text-slate-300">{req.invoiceNumber}</strong></span>
                        </>
                      )}
                      {req.expenseCategory && (
                        <>
                          <span>&bull;</span>
                          <span>Category: <strong className="text-slate-700 dark:text-slate-300">{getExpenseCategoryLabel(req.expenseCategory)}</strong></span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span>Due: <strong className="text-rose-600 dark:text-rose-400">{formatDate(req.dueDate)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200/60 dark:border-dark-border">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Disbursement Amount
                      </span>
                      <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/payment-requests/${req.id}`)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      View Details
                    </Button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Approver Clarification Question Box */}
                  <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-4 border border-amber-200 dark:border-amber-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="font-bold text-amber-900 dark:text-amber-200">
                          {latestInquiry?.sender?.fullName || 'Approving Official'}
                        </span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                          Reviewer Inquiry
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {latestInquiry ? formatDateTime(latestInquiry.createdAt) : formatDate(req.updatedAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-100 font-medium leading-relaxed pl-4 border-l-2 border-amber-400 dark:border-amber-600">
                      {latestInquiry?.message || (req as any).clarification_comment || (req as any).remarks || 'Please provide clarification regarding this requisition.'}
                    </p>
                  </div>

                  {/* Multi-message conversation thread if more than 1 message */}
                  {messages.length > 1 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Conversation History
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {messages.slice(0, messages.length - 1).map((m) => (
                          <div
                            key={m.id}
                            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-dark-border text-xs space-y-1"
                          >
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {m.sender?.fullName || 'Participant'}
                              </span>
                              <span>{formatDateTime(m.createdAt)}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300">{m.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response Form */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Your Clarification Response <span className="text-red-500">*</span>
                    </label>

                    <Textarea
                      rows={3}
                      placeholder="Type your explanation or provide the requested details to unblock approval..."
                      value={currentResponse}
                      onChange={(e) => handleInputChange(req.id, e.target.value)}
                      className="text-xs"
                    />

                    {/* Optional File Upload */}
                    <div>
                      <span className="block text-xs font-medium text-slate-500 mb-1.5">
                        Attach Supporting Evidence (Optional)
                      </span>
                      <FileUpload
                        files={fileAttachments[req.id] || []}
                        onFilesChange={(files) => handleFilesChange(req.id, files)}
                        maxFiles={3}
                        maxSizeMB={10}
                      />
                    </div>

                    {/* Submit Action */}
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSubmitResponse(req.id)}
                        isLoading={isSubmittingThis}
                        disabled={!currentResponse.trim() || currentResponse.trim().length < 5}
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Submit Response & Resume Approval
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PendingClarification;
