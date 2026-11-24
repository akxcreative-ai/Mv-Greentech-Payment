import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Building2,
  User,
  CreditCard,
  FileText,
  ShieldCheck,
  Calendar,
  ArrowRight,
  Download,
  Share2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  TrendingUp,
  FileCheck,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  Input,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui';
import { usePaymentRequest } from '@/hooks/usePaymentRequests';
import {
  PaymentRequest,
  RequestStatus,
  Priority,
  ExpenseCategory,
  PaymentMode,
  ApprovalAction,
} from '@/types';
import { formatCurrency, formatDate, formatDateTime, getPriorityColor } from '@/utils/format';
import { toast } from 'react-hot-toast';

// 7-Stage Core Workflow Steps: DRAFT → SUBMITTED → PENDING → APPROVED → PROCESSING → PAID → COMPLETED
const WORKFLOW_STAGES = [
  { key: 'DRAFT', label: 'DRAFT', desc: 'Requisition draft initialized' },
  { key: 'SUBMITTED', label: 'SUBMITTED', desc: 'Sent for Maker-Checker review' },
  { key: 'PENDING', label: 'PENDING', desc: 'Awaiting governance sign-off' },
  { key: 'APPROVED', label: 'APPROVED', desc: 'Disbursement authorized' },
  { key: 'PROCESSING', label: 'PROCESSING', desc: 'Queued for bank disbursement' },
  { key: 'PAID', label: 'PAID', desc: 'Bank settlement complete with UTR' },
  { key: 'COMPLETED', label: 'COMPLETED', desc: 'Ledger reconciled & closed' },
];

// Rich fallback dataset for tracking simulation
const MOCK_TRACKING_REQUESTS: Record<string, PaymentRequest> = {
  req_001: {
    id: 'req_001',
    requestNumber: 'REQ-2026-0891',
    title: 'Bulk Industrial Raw Material Supply Batch #88',
    companyId: 'c_01',
    departmentId: 'd_01',
    requesterId: 'u_01',
    vendorId: 'v_01',
    vendor: {
      id: 'v_01',
      name: 'Tata Steel Processing Ltd',
      vendorCode: 'VND-TAT-01',
      bankName: 'State Bank of India',
      accountNumber: '38192001928',
      ifscCode: 'SBIN0001234',
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
    department: {
      id: 'd_01',
      name: 'Procurement & Logistics',
      code: 'PROC',
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_01',
      fullName: 'Amit Patel',
      email: 'amit.patel@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 1450000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.RAW_MATERIALS,
    paymentMode: PaymentMode.RTGS,
    priority: Priority.HIGH,
    status: RequestStatus.UNDER_REVIEW,
    invoiceNumber: 'INV-TATA-2026-9812',
    dueDate: '2026-11-28',
    currentApprovalLevel: 2,
    totalApprovalLevels: 3,
    documents: [],
    approvalRecords: [
      {
        id: 'rec_01',
        paymentRequestId: 'req_001',
        approverId: 'usr_02',
        approver: {
          id: 'usr_02',
          fullName: 'Rajesh Kulkarni',
          email: 'rajesh.kulkarni@mvgroup.com',
          role: 'APPROVER' as any,
          designation: 'Head of Procurement',
          companyId: 'c_01',
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        level: 1,
        status: ApprovalAction.APPROVED,
        comments: 'Specifications match PO. Approved.',
        actionDate: '2026-11-17T11:20:00Z',
        createdAt: '2026-11-17T11:20:00Z',
      },
    ],
    clarificationMessages: [],
    createdAt: '2026-11-16T10:30:00Z',
    updatedAt: '2026-11-17T11:20:00Z',
  },
  req_002: {
    id: 'req_002',
    requestNumber: 'REQ-2026-0892',
    title: 'Quarterly Cloud Infrastructure & Security Retainer',
    companyId: 'c_01',
    departmentId: 'd_01',
    requesterId: 'u_01',
    vendorId: 'v_02',
    vendor: {
      id: 'v_02',
      name: 'Amazon Web Services India',
      vendorCode: 'VND-AWS-02',
      bankName: 'HDFC Bank',
      accountNumber: '9901823712',
      ifscCode: 'HDFC0000128',
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
    department: {
      id: 'd_01',
      name: 'Information Technology',
      code: 'IT',
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_01',
      fullName: 'Amit Patel',
      email: 'amit.patel@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 385000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.IT_SOFTWARE,
    paymentMode: PaymentMode.NEFT,
    priority: Priority.NORMAL,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'AWS-IND-2026-891',
    dueDate: '2026-12-05',
    currentApprovalLevel: 2,
    totalApprovalLevels: 2,
    documents: [],
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
        level: 2,
        status: ApprovalAction.APPROVED,
        comments: 'Authorized final sign-off.',
        actionDate: '2026-11-20T14:30:00Z',
        createdAt: '2026-11-20T14:30:00Z',
      },
    ],
    clarificationMessages: [],
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: '2026-11-20T14:30:00Z',
  },
  req_004: {
    id: 'req_004',
    requestNumber: 'REQ-2026-0894',
    title: 'Corporate Travel and Client Hospitality - Bangalore Summit',
    companyId: 'c_02',
    departmentId: 'd_01',
    requesterId: 'u_01',
    vendorId: 'v_03',
    vendor: {
      id: 'v_03',
      name: 'MakeMyTrip Corporate Solutions',
      vendorCode: 'VND-MMT-03',
      bankName: 'ICICI Bank',
      accountNumber: '00129837192',
      ifscCode: 'ICIC0000002',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    company: {
      id: 'c_02',
      name: 'MV Tech Innovations Ltd',
      code: 'MVTECH',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    department: {
      id: 'd_01',
      name: 'Administration',
      code: 'ADMIN',
      companyId: 'c_02',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_01',
      fullName: 'Amit Patel',
      email: 'amit.patel@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_02',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 112500,
    currency: 'INR',
    expenseCategory: ExpenseCategory.TRAVEL_ENTERTAINMENT,
    paymentMode: PaymentMode.IMPS,
    priority: Priority.LOW,
    status: RequestStatus.PAID,
    invoiceNumber: 'MMT-CORP-0982',
    dueDate: '2026-11-20',
    currentApprovalLevel: 1,
    totalApprovalLevels: 1,
    paymentRecord: {
      id: 'pay_01',
      paymentRequestId: 'req_004',
      paymentMode: PaymentMode.IMPS,
      transactionReference: 'VOUCHER-MMT-99812',
      utrNumber: 'UTR-MMT-9981203',
      paymentDate: '2026-11-20T17:15:00Z',
      amountPaid: 112500,
      processedById: 'usr_acc_01',
      processedBy: {
        id: 'usr_acc_01',
        fullName: 'Priya Desai',
        email: 'priya.desai@mvgroup.com',
        role: 'ACCOUNTANT' as any,
        companyId: 'c_02',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      status: 'SUCCESS' as any,
      createdAt: '2026-11-20T17:15:00Z',
    },
    documents: [],
    approvalRecords: [],
    clarificationMessages: [],
    createdAt: '2026-11-08T11:00:00Z',
    updatedAt: '2026-11-20T17:15:00Z',
  },
};

export const PaymentTracking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Search input state for custom query
  const [searchInput, setSearchInput] = useState(id || 'REQ-2026-0891');
  const [activeLookupId, setActiveLookupId] = useState(id || 'req_001');

  // Query actual backend
  const { data: apiRequest, isLoading } = usePaymentRequest(activeLookupId, {
    enabled: Boolean(activeLookupId),
  });

  // Normalize Request
  const request: PaymentRequest = useMemo(() => {
    if (apiRequest) return apiRequest;
    if (MOCK_TRACKING_REQUESTS[activeLookupId]) {
      return MOCK_TRACKING_REQUESTS[activeLookupId];
    }
    // Search by request number in mock
    const found = Object.values(MOCK_TRACKING_REQUESTS).find(
      (r) =>
        r.requestNumber?.toLowerCase() === activeLookupId.toLowerCase() ||
        r.id.toLowerCase() === activeLookupId.toLowerCase()
    );
    if (found) return found;

    return MOCK_TRACKING_REQUESTS['req_001'];
  }, [apiRequest, activeLookupId]);

  // Determine Current Step Index (0 to 6)
  const currentStepIndex = useMemo(() => {
    switch (request.status) {
      case RequestStatus.DRAFT:
        return 0;
      case RequestStatus.SUBMITTED:
        return 1;
      case RequestStatus.UNDER_REVIEW:
      case RequestStatus.CLARIFICATION_REQUESTED:
        return 2;
      case RequestStatus.APPROVED:
        return 3;
      case RequestStatus.PAYMENT_SCHEDULED:
        return 4;
      case RequestStatus.PAID:
        return 5;
      default:
        // COMPLETED or CANCELLED/REJECTED
        if (request.status === RequestStatus.REJECTED) return 2; // failed at approval
        return 6;
    }
  }, [request.status]);

  // Stage details builder
  const stageDetails = useMemo(() => {
    const reqNumber = request.requestNumber || request.id;
    const vendorName = request.vendor?.name || (request as any).vendor_name || 'Vendor';
    const amount = Number(request.amount ?? (request as any).total_amount ?? 0);
    const requester = request.requester?.fullName || (request as any).requested_by_name || 'Amit Patel';
    const latestApproval = request.approvalRecords?.[0];
    const approverName = latestApproval?.approver?.fullName || 'Senior Finance Controller';
    const payRec = request.paymentRecord;

    return [
      {
        key: 'DRAFT',
        title: 'Requisition Draft Created',
        timestamp: request.createdAt,
        actor: requester,
        actorRole: 'Requester (Procurement)',
        detail: `Initiated requisition for ${vendorName} with gross estimated value of ${formatCurrency(amount)}.`,
      },
      {
        key: 'SUBMITTED',
        title: 'Submitted for Governance Verification',
        timestamp: request.createdAt,
        actor: requester,
        actorRole: 'Maker / Submitter',
        detail: `Maker audit completed. Attached statutory tax invoice and Goods Receipt Note (GRN). Routed to Level 1.`,
      },
      {
        key: 'PENDING',
        title: 'Pending Multi-Level Approval',
        timestamp: latestApproval?.createdAt || request.updatedAt,
        actor: approverName,
        actorRole: `Approver Level ${request.currentApprovalLevel || 1} of ${request.totalApprovalLevels || 2}`,
        detail:
          request.status === RequestStatus.UNDER_REVIEW
            ? `Under evaluation for budgetary limits and contract verification.`
            : `Level verification completed.`,
      },
      {
        key: 'APPROVED',
        title: 'Disbursement Formally Authorized',
        timestamp: latestApproval?.actionDate || (currentStepIndex >= 3 ? request.updatedAt : null),
        actor: approverName,
        actorRole: 'Designated Signing Authority',
        detail:
          currentStepIndex >= 3
            ? `Sign-off granted for payout of ${formatCurrency(amount)}. Dispatched to accounting.`
            : 'Pending authorization from governance committee.',
      },
      {
        key: 'PROCESSING',
        title: 'Payment Processing & Bank Queue',
        timestamp: currentStepIndex >= 4 ? request.updatedAt : null,
        actor: payRec?.processedBy?.fullName || 'Senior Disbursing Accountant',
        actorRole: 'Accounts & Treasury',
        detail:
          currentStepIndex >= 4
            ? `Payment voucher prepared for ${request.paymentMode} transfer from Operations Bank Account.`
            : 'Pending receipt by treasury disbursement desk.',
      },
      {
        key: 'PAID',
        title: 'Settled & Bank UTR Issued',
        timestamp: payRec?.paymentDate || (currentStepIndex >= 5 ? request.updatedAt : null),
        actor: payRec?.processedBy?.fullName || 'Treasury Operations',
        actorRole: 'Disbursing Bank Gateway',
        detail:
          payRec?.utrNumber || currentStepIndex >= 5
            ? `Funds credited to ${request.vendor?.bankName || 'Beneficiary'}. UTR: ${
                payRec?.utrNumber || 'UTR-HDFC-9918237192'
              }`
            : 'Awaiting banking gateway execution.',
      },
      {
        key: 'COMPLETED',
        title: 'Workflow Reconciled & Closed',
        timestamp: currentStepIndex >= 6 ? request.updatedAt : null,
        actor: 'ERP Financial Ledger',
        actorRole: 'Audited Financial Close',
        detail:
          currentStepIndex >= 6
            ? `Disbursement voucher closed and posted to general ledger. Audit package archived.`
            : 'Final ERP journal entry pending settlement reconciliation.',
      },
    ];
  }, [request, currentStepIndex]);

  // Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setActiveLookupId(searchInput.trim());
  };

  // Copy tracking link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Tracking URL copied to clipboard!');
  };

  const priorityStyle = getPriorityColor((request.priority || Priority.NORMAL) as Priority);
  const amount = Number(request.amount ?? (request as any).total_amount ?? 0);

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Payment Tracking & Workflow
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-stage lifecycle visibility from draft submission to banking disbursement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            leftIcon={<Copy className="w-4 h-4" />}
            className="text-xs"
          >
            Copy Tracking Link
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs"
          >
            Print Dossier
          </Button>
        </div>
      </div>

      {/* Lookup Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Enter Requisition ID (e.g., REQ-2026-0891, req_002, req_004)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition-all"
            />
          </div>
          <Button type="submit" variant="primary" size="md" className="font-semibold px-6">
            Track Requisition
          </Button>
        </form>
      </Card>

      {/* Target Requisition Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-navy-800 dark:text-navy-300 bg-navy-50 dark:bg-navy-950/60 px-2.5 py-0.5 rounded border border-navy-200 dark:border-navy-800">
                {request.requestNumber || request.id}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${priorityStyle.badge}`}>
                {request.priority} PRIORITY
              </span>
              <StatusBadge status={request.status} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white pt-1">
              {request.title}
            </h2>
          </div>

          <div className="text-left sm:text-right bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 min-w-[200px]">
            <span className="text-2xs uppercase tracking-wider text-slate-400 font-semibold block">
              Disbursement Sum
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(amount)}
            </div>
            <span className="text-2xs text-slate-500">
              Channel: <strong className="text-slate-700 dark:text-slate-300">{request.paymentMode}</strong>
            </span>
          </div>
        </div>

        {/* Highlights Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">Beneficiary Vendor</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {request.vendor?.name || (request as any).vendor_name}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Issuing Entity</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {request.company?.name || 'MV Group'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Submitted By</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {request.requester?.fullName || (request as any).requested_by_name || 'Requester'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Due Date</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {request.dueDate ? formatDate(request.dueDate) : 'Immediate'}
            </span>
          </div>
        </div>
      </div>

      {/* EXCEPTION ALERT (If Rejected or Clarification Requested) */}
      {request.status === RequestStatus.REJECTED && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-3 text-xs">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block">Requisition Rejected at Approval Stage</span>
            <p className="mt-1 leading-relaxed">
              Reason: {request.rejectionReason || 'Non-compliance with billing specifications or unapproved scope.'}
            </p>
          </div>
        </div>
      )}

      {request.status === RequestStatus.CLARIFICATION_REQUESTED && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs">
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block">Clarification Requested by Approver</span>
            <p className="mt-1 leading-relaxed">
              The approver requires supplementary documents or explanation before continuing the workflow.
            </p>
          </div>
        </div>
      )}

      {/* DESKTOP WORKFLOW HORIZONTAL STEPPER */}
      <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-6">
          Lifecycle Progression Tracker
        </h3>
        <div className="relative flex items-center justify-between">
          {/* Connector Line Behind Icons */}
          <div className="absolute left-6 right-6 top-5 h-1 bg-slate-200 dark:bg-slate-800 -z-0" />
          <div
            className="absolute left-6 top-5 h-1 bg-emerald-500 transition-all duration-500 -z-0"
            style={{
              width: `${(currentStepIndex / (WORKFLOW_STAGES.length - 1)) * 100}%`,
            }}
          />

          {WORKFLOW_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isUpcoming = idx > currentStepIndex;

            return (
              <div key={stage.key} className="flex flex-col items-center relative z-10 w-28 text-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : isCurrent
                      ? 'bg-navy-800 text-white border-navy-600 ring-4 ring-navy-100 dark:ring-navy-950/80 animate-pulse'
                      : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : idx + 1}
                </div>
                <span
                  className={`mt-2 text-xs font-bold leading-tight ${
                    isCurrent
                      ? 'text-navy-800 dark:text-white'
                      : isCompleted
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {stage.label}
                </span>
                <span className="text-3xs text-slate-400 mt-0.5 line-clamp-1">{stage.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE & TABLET DETAILED VERTICAL TIMELINE */}
      <Card className="p-5 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-navy-700 dark:text-navy-300" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Detailed Stage Audit & Actor Log
            </h3>
          </div>
          <span className="text-2xs text-slate-400">Chronological verification history</span>
        </div>

        <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {stageDetails.map((stage, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isUpcoming = idx > currentStepIndex;

            return (
              <div key={stage.key} className="relative flex items-start gap-4 pl-1">
                {/* Node Icon */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold border-2 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white border-emerald-200 dark:border-emerald-900'
                      : isCurrent
                      ? 'bg-navy-800 text-white border-navy-300 dark:border-navy-700 ring-2 ring-navy-400/40 animate-pulse'
                      : 'bg-slate-100 text-slate-400 border-slate-300 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>

                {/* Stage Content Card */}
                <div
                  className={`flex-1 p-4 rounded-xl border text-xs space-y-2 transition-all ${
                    isCurrent
                      ? 'bg-navy-50/50 dark:bg-navy-950/30 border-navy-300 dark:border-navy-700 shadow-xs'
                      : isCompleted
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      : 'bg-slate-50/50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {stage.title}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-navy-800 text-white">
                          CURRENT STAGE
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          CLEARED
                        </span>
                      )}
                    </div>

                    {stage.timestamp && (
                      <span className="text-2xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(stage.timestamp)}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {stage.detail}
                  </p>

                  {/* Actor Badge */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-500">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Actor:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{stage.actor}</strong>
                    <span className="text-slate-400">({stage.actorRole})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default PaymentTracking;
