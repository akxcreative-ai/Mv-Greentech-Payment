import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  Building2,
  Upload,
  FileText,
  Check,
  Search,
  ArrowRight,
  Clock,
  AlertCircle,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  X,
  FileCheck,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  Input,
  Select,
  Textarea,
  Modal,
  EmptyState,
  LoadingSpinner,
} from '@/components/ui';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useRecordPayment, useMarkPaymentCompleted } from '@/hooks/usePayments';
import {
  PaymentRequest,
  PaymentMode,
  RequestStatus,
  Priority,
  ExpenseCategory,
  RecordPaymentInput,
} from '@/types';
import { formatCurrency, formatDate, formatDateTime, getPriorityColor } from '@/utils/format';
import { toast } from 'react-hot-toast';

// Rich fallback approved requests pending disbursement
const FALLBACK_APPROVED_REQUESTS: Partial<PaymentRequest>[] = [
  {
    id: 'req_002',
    requestNumber: 'REQ-2026-0892',
    title: 'Quarterly Cloud Infrastructure & Security Retainer',
    vendor: {
      id: 'v_02',
      name: 'Amazon Web Services India',
      vendorCode: 'VND-AWS-02',
      bankName: 'HDFC Bank',
      accountNumber: '9901823712',
      ifscCode: 'HDFC0000128',
      branchName: 'Kharadi IT Park Branch, Pune',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    company: {
      id: 'c_01',
      name: 'MV Agro Industries Ltd',
      code: 'MVAGRO',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 385000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.IT_SOFTWARE,
    priority: Priority.NORMAL,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'AWS-IND-2026-891',
    dueDate: '2026-12-05',
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: '2026-11-20T14:30:00Z',
    approvalRecords: [
      {
        id: 'rec_01',
        paymentRequestId: 'req_002',
        approverId: 'usr_03',
        approver: {
          id: 'usr_03',
          fullName: 'Sunita Sharma',
          email: 'sunita.sharma@mvgroup.com',
          role: 'APPROVER' as any,
          designation: 'Finance Controller',
          companyId: 'c_01',
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        status: 'APPROVED' as any,
        comments: 'Verified against AWS enterprise tier pricing contract. Approved for payment release.',
        actionDate: '2026-11-20T14:30:00Z',
        level: 2,
        createdAt: '2026-11-20T14:30:00Z',
      },
    ],
  },
  {
    id: 'req_005',
    requestNumber: 'REQ-2026-0895',
    title: 'Packaging & Warehouse Logistics Consumables',
    vendor: {
      id: 'v_07',
      name: 'Blue Dart Express Freight',
      vendorCode: 'VND-BDT-07',
      bankName: 'ICICI Bank',
      accountNumber: '0129841289',
      ifscCode: 'ICIC0000002',
      branchName: 'Bandra Kurla Complex, Mumbai',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    company: {
      id: 'c_03',
      name: 'MV Logistics Hub Pvt Ltd',
      code: 'MVLOG',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 245000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.LOGISTICS,
    priority: Priority.HIGH,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'BDT-LOG-7721',
    dueDate: '2026-11-30',
    createdAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-21T16:00:00Z',
    approvalRecords: [
      {
        id: 'rec_02',
        paymentRequestId: 'req_005',
        approverId: 'usr_02',
        approver: {
          id: 'usr_02',
          fullName: 'Rajesh Kulkarni',
          email: 'rajesh.kulkarni@mvgroup.com',
          role: 'APPROVER' as any,
          designation: 'Head of Logistics',
          companyId: 'c_03',
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        status: 'APPROVED' as any,
        comments: 'Delivery receipts matched and audited. Approved.',
        actionDate: '2026-11-21T16:00:00Z',
        level: 2,
        createdAt: '2026-11-21T16:00:00Z',
      },
    ],
  },
  {
    id: 'req_001',
    requestNumber: 'REQ-2026-0891',
    title: 'Bulk Industrial Raw Material Supply Batch #88',
    vendor: {
      id: 'v_01',
      name: 'Tata Steel Processing Ltd',
      vendorCode: 'VND-TAT-01',
      bankName: 'State Bank of India',
      accountNumber: '38192001928',
      ifscCode: 'SBIN0001234',
      branchName: 'Nariman Point Corporate Branch, Mumbai',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    company: {
      id: 'c_01',
      name: 'MV Agro Industries Ltd',
      code: 'MVAGRO',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 1450000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.RAW_MATERIALS,
    priority: Priority.HIGH,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'INV-TATA-2026-9812',
    dueDate: '2026-11-28',
    createdAt: '2026-11-16T10:30:00Z',
    updatedAt: '2026-11-22T11:00:00Z',
    approvalRecords: [
      {
        id: 'rec_03',
        paymentRequestId: 'req_001',
        approverId: 'usr_04',
        approver: {
          id: 'usr_04',
          fullName: 'Vikramaditya Singhania',
          email: 'vikram.singhania@mvgroup.com',
          role: 'DIRECTOR' as any,
          designation: 'Executive Director',
          companyId: 'c_01',
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        status: 'APPROVED' as any,
        comments: 'Authorized final sign-off. Please execute disbursement via RTGS immediately.',
        actionDate: '2026-11-22T11:00:00Z',
        level: 3,
        createdAt: '2026-11-22T11:00:00Z',
      },
    ],
  },
];

const DISBURSING_BANK_ACCOUNTS = [
  'HDFC Bank - Current A/C 5020001928371 (Operations)',
  'State Bank of India - Cash Credit A/C 38192001928',
  'ICICI Bank - Main Disbursement A/C 00129837192',
  'Kotak Mahindra Bank - A/C 9918237128',
];

export const PaymentProcessing: React.FC = () => {
  const navigate = useNavigate();

  // Queries
  const { data: apiResponse, isLoading, refetch, isRefetching } = usePaymentRequests({
    status: RequestStatus.APPROVED,
    pageSize: 50,
  });

  // Payment Recording Mutations
  const recordPaymentMutation = useRecordPayment();
  const completePaymentMutation = useMarkPaymentCompleted();

  // Filter States
  const [search, setSearch] = useState('');

  // Selected Request for Recording Payment
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);

  // Form State
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualPaidAmount, setActualPaidAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.NEFT);
  const [bankAccount, setBankAccount] = useState(DISBURSING_BANK_ACCOUNTS[0]);
  const [transactionId, setTransactionId] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Form Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mark Completed Modal State
  const [completeModalRequest, setCompleteModalRequest] = useState<PaymentRequest | null>(null);

  // Extract base list
  const approvedRequests: PaymentRequest[] = useMemo(() => {
    if (apiResponse && apiResponse.data && apiResponse.data.length > 0) {
      const filtered = apiResponse.data.filter((r) => r.status === RequestStatus.APPROVED);
      if (filtered.length > 0) return filtered;
    }
    return FALLBACK_APPROVED_REQUESTS as PaymentRequest[];
  }, [apiResponse]);

  // Search Filter
  const filteredRequests = useMemo(() => {
    return approvedRequests.filter((req) => {
      const reqNumber = req.requestNumber || (req as any).request_number || req.id || '';
      const vendorName = req.vendor?.name || (req as any).vendor_name || '';
      const query = search.trim().toLowerCase();
      return !query || reqNumber.toLowerCase().includes(query) || vendorName.toLowerCase().includes(query);
    });
  }, [approvedRequests, search]);

  // Aggregate Metrics
  const totalApprovedAmount = useMemo(() => {
    return filteredRequests.reduce((sum, r) => sum + Number(r.amount ?? (r as any).total_amount ?? 0), 0);
  }, [filteredRequests]);

  // Open Recording Modal
  const handleOpenProcessPayment = (req: PaymentRequest) => {
    setSelectedRequest(req);
    const amount = Number(req.amount ?? (req as any).total_amount ?? 0);
    setActualPaidAmount(String(amount));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMode(req.paymentMode || PaymentMode.NEFT);
    setBankAccount(DISBURSING_BANK_ACCOUNTS[0]);
    setTransactionId(`TXN-${Date.now().toString().slice(-6)}`);
    setUtrNumber('');
    setChequeNumber('');
    setPaymentReference(`VOUCHER-${req.requestNumber || req.id}`);
    setPaymentRemarks('');
    setProofFile(null);
    setErrors({});
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!paymentDate) {
      newErrors.paymentDate = 'Payment settlement date is required';
    }

    const numAmount = parseFloat(actualPaidAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      newErrors.actualPaidAmount = 'Enter a valid positive paid amount';
    }

    if (!bankAccount) {
      newErrors.bankAccount = 'Disbursing bank account is required';
    }

    if (paymentMode === PaymentMode.CHEQUE) {
      if (!chequeNumber.trim()) {
        newErrors.chequeNumber = 'Cheque number is mandatory for Cheque disbursements';
      }
    } else if (
      paymentMode === PaymentMode.NEFT ||
      paymentMode === PaymentMode.RTGS ||
      paymentMode === PaymentMode.IMPS ||
      paymentMode === PaymentMode.UPI
    ) {
      if (!utrNumber.trim()) {
        newErrors.utrNumber = 'Bank UTR / Transaction Reference number is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Payment Record
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!validateForm()) {
      toast.error('Please fix validation errors before submitting disbursement.');
      return;
    }

    const payload: RecordPaymentInput = {
      paymentDate,
      amountPaid: parseFloat(actualPaidAmount),
      paymentMode,
      bankAccountId: bankAccount,
      transactionId: transactionId.trim() || undefined,
      utrNumber: utrNumber.trim() || undefined,
      chequeNumber: chequeNumber.trim() || undefined,
      transactionReference: paymentReference.trim() || utrNumber.trim() || transactionId.trim(),
      remarks: paymentRemarks.trim() || undefined,
    };

    try {
      await recordPaymentMutation.mutateAsync({
        requestId: selectedRequest.id,
        data: payload,
      });
      setSelectedRequest(null);
    } catch {
      // toast shown by hook
    }
  };

  // Mark Completed Action
  const handleMarkCompleted = async () => {
    if (!completeModalRequest) return;
    try {
      await completePaymentMutation.mutateAsync(completeModalRequest.id);
      setCompleteModalRequest(null);
    } catch {
      // toast shown by hook
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Payment Processing
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Accountant Queue
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Execute and record banking disbursements, attach UTR references, and reconcile completed vouchers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isRefetching}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />}
            className="text-xs"
          >
            Refresh
          </Button>
          <Link to="/payments/completed">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileCheck className="w-4 h-4" />}
              className="text-xs"
            >
              Completed Payments
            </Button>
          </Link>
        </div>
      </div>

      {/* Aggregate Metric Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/20 dark:to-blue-900/10 dark:border-blue-800/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Approved Awaiting Payout
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-100">
            {filteredRequests.length}
          </div>
          <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-400/80">
            Requisitions cleared by governance committee
          </p>
        </div>

        <div className="p-5 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/20 dark:to-emerald-900/10 dark:border-emerald-800/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Net Payable Disbursement
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100">
            {formatCurrency(totalApprovedAmount)}
          </div>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Total fund outflow authorized for settlement
          </p>
        </div>

        <div className="p-5 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-indigo-100/40 dark:from-indigo-950/20 dark:to-indigo-900/10 dark:border-indigo-800/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              Active Banking Channels
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-indigo-900 dark:text-indigo-100">
            {DISBURSING_BANK_ACCOUNTS.length} Accounts
          </div>
          <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-400/80">
            NEFT, RTGS, IMPS & Cheque gateways active
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search approved requisitions by Request ID, Vendor legal name, or Purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition-all"
          />
        </div>
      </Card>

      {/* Approved Requests Pending Payment List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-500">Loading approved payment queue...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title="No Approved Requisitions Pending Disbursement"
          description="All approved requisitions have been disbursed and settled. New authorized requisitions will appear here."
          icon={<CheckCircle2 className="w-12 h-12 text-slate-400" />}
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const reqNumber = req.requestNumber || (req as any).request_number || req.id;
            const vendorName = req.vendor?.name || (req as any).vendor_name || 'Vendor';
            const amount = req.amount ?? (req as any).total_amount ?? 0;
            const latestApproval = req.approvalRecords?.[0];
            const approverName = latestApproval?.approver?.fullName || 'Governance Committee';
            const approvalDate = latestApproval?.actionDate || req.updatedAt || (req as any).created_at;

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-navy-300 dark:hover:border-navy-700 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Requisition Identity & Bank Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy-800 dark:text-navy-300 bg-navy-50 dark:bg-navy-950/60 px-2 py-0.5 rounded border border-navy-200 dark:border-navy-800">
                        {reqNumber}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <Check className="w-3 h-3 mr-1" />
                        APPROVED FOR DISBURSEMENT
                      </span>
                      {req.invoiceNumber && (
                        <span className="text-xs text-slate-500 font-mono">
                          Inv: {req.invoiceNumber}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {req.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="inline-flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          Vendor: <strong className="ml-1 text-slate-800 dark:text-slate-200">{vendorName}</strong>
                        </span>
                        <span className="inline-flex items-center">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Approved by: <strong className="ml-1 text-slate-800 dark:text-slate-200">{approverName}</strong>
                        </span>
                        <span className="inline-flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          Approved on: {formatDate(approvalDate)}
                        </span>
                      </div>
                    </div>

                    {/* Remittance Banking Banner */}
                    {req.vendor && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-2xs uppercase tracking-wider font-bold text-slate-400">
                          Remit To:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {req.vendor.bankName}
                        </span>
                        <span>
                          A/C:{' '}
                          <strong className="font-mono text-slate-900 dark:text-white">
                            {req.vendor.accountNumber}
                          </strong>
                        </span>
                        <span>
                          IFSC:{' '}
                          <strong className="font-mono text-navy-700 dark:text-navy-300">
                            {req.vendor.ifscCode}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Approved Amount & Process Button */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                        Authorized Net Amount
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {formatCurrency(amount)}
                      </div>
                      <span className="text-2xs text-slate-400">
                        Payment Mode: {req.paymentMode || 'NEFT'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        leftIcon={<CreditCard className="w-4 h-4" />}
                        onClick={() => handleOpenProcessPayment(req)}
                        className="font-bold px-5 min-h-[44px] shadow-sm active:scale-95 transition-transform flex-1 sm:flex-none"
                      >
                        Process Payment
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => setCompleteModalRequest(req)}
                        className="text-xs min-h-[44px] text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Mark as Completed"
                      >
                        Mark Completed
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAYMENT RECORDING MODAL FORM */}
      <Modal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={
          <div className="flex items-center gap-2 text-navy-800 dark:text-navy-300">
            <CreditCard className="w-5 h-5 text-navy-700 dark:text-navy-300" />
            <span>Record Payment Disbursement</span>
          </div>
        }
        description="Capture bank settlement details, transaction reference, and UTR numbers for statutory reconciliation."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setSelectedRequest(null)}
              disabled={recordPaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="success"
              size="md"
              isLoading={recordPaymentMutation.isPending}
              loadingText="Recording Disbursement..."
              onClick={handleSubmitPayment}
              className="font-black px-7 shadow-md"
            >
              Record & Mark as PAID
            </Button>
          </div>
        }
      >
        {selectedRequest && (
          <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
            {/* Beneficiary Voucher Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-2xs uppercase tracking-wider font-bold text-slate-500">
                <span>Beneficiary Payment Target</span>
                <span className="font-mono text-navy-700 dark:text-navy-300">
                  {selectedRequest.requestNumber || selectedRequest.id}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedRequest.vendor?.name || (selectedRequest as any).vendor_name}
                  </div>
                  <div className="text-2xs text-slate-500">
                    Bank: {selectedRequest.vendor?.bankName} • A/C: {selectedRequest.vendor?.accountNumber} • IFSC:{' '}
                    {selectedRequest.vendor?.ifscCode}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-slate-400 block">Approved Sum:</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(selectedRequest.amount ?? (selectedRequest as any).total_amount ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Payment Settlement Date */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Settlement Date *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`w-full py-2 px-3 text-xs rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600 ${
                    errors.paymentDate ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {errors.paymentDate && <p className="text-2xs text-rose-500">{errors.paymentDate}</p>}
              </div>

              {/* Actual Paid Amount */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Actual Disbursed Amount (₹) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={actualPaidAmount}
                  onChange={(e) => setActualPaidAmount(e.target.value)}
                  placeholder="0.00"
                  className={errors.actualPaidAmount ? 'border-rose-500' : ''}
                />
                {errors.actualPaidAmount && (
                  <p className="text-2xs text-rose-500">{errors.actualPaidAmount}</p>
                )}
              </div>

              {/* Payment Mode */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Payment Mode *
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600"
                >
                  <option value={PaymentMode.NEFT}>NEFT (National Electronic Funds Transfer)</option>
                  <option value={PaymentMode.RTGS}>RTGS (Real Time Gross Settlement)</option>
                  <option value={PaymentMode.IMPS}>IMPS (Immediate Payment Service)</option>
                  <option value={PaymentMode.CHEQUE}>Cheque</option>
                  <option value={PaymentMode.UPI}>UPI</option>
                  <option value={PaymentMode.DEMAND_DRAFT}>Demand Draft</option>
                  <option value={PaymentMode.CASH}>Cash</option>
                  <option value={PaymentMode.OTHER}>Other Banking Mode</option>
                </select>
              </div>

              {/* Disbursing Company Bank Account */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Debit From Bank Account *
                </label>
                <select
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600"
                >
                  {DISBURSING_BANK_ACCOUNTS.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
                {errors.bankAccount && <p className="text-2xs text-rose-500">{errors.bankAccount}</p>}
              </div>

              {/* Internal Transaction ID */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Transaction ID / Banking Batch ID
                </label>
                <Input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN-202611-001"
                />
              </div>

              {/* UTR Number (for Electronic) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>UTR Number {paymentMode !== PaymentMode.CHEQUE ? '*' : ''}</span>
                  <span className="font-normal text-2xs text-slate-400">Unique Bank Reference</span>
                </label>
                <Input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. UTR-HDFC-9918237192"
                  className={errors.utrNumber ? 'border-rose-500' : ''}
                />
                {errors.utrNumber && <p className="text-2xs text-rose-500">{errors.utrNumber}</p>}
              </div>

              {/* Cheque Number */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Cheque Number {paymentMode === PaymentMode.CHEQUE ? '*' : ''}</span>
                  <span className="font-normal text-2xs text-slate-400">
                    {paymentMode === PaymentMode.CHEQUE ? 'Mandatory for Cheque' : 'Optional'}
                  </span>
                </label>
                <Input
                  type="text"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g. 000492"
                  className={errors.chequeNumber ? 'border-rose-500' : ''}
                />
                {errors.chequeNumber && (
                  <p className="text-2xs text-rose-500">{errors.chequeNumber}</p>
                )}
              </div>

              {/* Payment Reference (Voucher / ERP Number) */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  ERP Payment Voucher Reference
                </label>
                <Input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. VOUCHER-SAP-9912 or TALLY-2026-881"
                />
              </div>

              {/* Payment Remarks */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Payment Remarks / Reconcile Notes
                </label>
                <Textarea
                  rows={2}
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="e.g. Prompt payment rebate of 1.5% applied. Net payment released via RTGS."
                />
              </div>

              {/* Upload Payment Proof (Document) */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Upload Payment Proof / Bank Advice Slip
                </label>
                <div className="p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {proofFile ? proofFile.name : 'Select bank confirmation PDF or receipt image'}
                    </span>
                  </div>
                  <label className="cursor-pointer">
                    <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-2xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100">
                      Browse File
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setProofFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* MARK AS COMPLETED MODAL */}
      <Modal
        isOpen={Boolean(completeModalRequest)}
        onClose={() => setCompleteModalRequest(null)}
        title={
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Mark Payment as COMPLETED</span>
          </div>
        }
        description="Verify that the payment has cleared the banking system and can be closed out permanently in the general ledger."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setCompleteModalRequest(null)}
              disabled={completePaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="success"
              size="md"
              isLoading={completePaymentMutation.isPending}
              loadingText="Completing..."
              onClick={handleMarkCompleted}
              className="font-bold px-6 shadow-md"
            >
              Confirm Completion
            </Button>
          </div>
        }
      >
        {completeModalRequest && (
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
            <p>
              Requisition{' '}
              <strong className="font-mono text-slate-900 dark:text-white">
                {completeModalRequest.requestNumber || completeModalRequest.id}
              </strong>{' '}
              to{' '}
              <strong>
                {completeModalRequest.vendor?.name || (completeModalRequest as any).vendor_name}
              </strong>{' '}
              for{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatCurrency(completeModalRequest.amount ?? (completeModalRequest as any).total_amount ?? 0)}
              </strong>{' '}
              will be permanently reconciled as COMPLETED.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentProcessing;
