import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  Search,
  Eye,
  Calendar,
  Clock,
  Building2,
  User,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  History,
  Tag,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Modal,
  Textarea,
  EmptyState,
  LoadingSpinner,
} from '@/components/ui';
import { usePendingApprovals, useApproveRequest, useRejectRequest } from '@/hooks/useApprovals';
import { useAllCompanies } from '@/hooks/useCompanies';
import { Priority, ExpenseCategory, RequestStatus, PaymentRequest } from '@/types';
import { formatCurrency, formatDate, getPriorityColor } from '@/utils/format';

type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'priority' | 'due_date';

// Robust mock fallback items for development / empty backend
const FALLBACK_PENDING_REQUESTS: Partial<PaymentRequest>[] = [
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
    priority: Priority.HIGH,
    status: RequestStatus.UNDER_REVIEW,
    invoiceNumber: 'INV-TATA-2026-9812',
    invoiceDate: '2026-11-15',
    dueDate: '2026-11-28',
    currentApprovalLevel: 2,
    totalApprovalLevels: 3,
    documents: [],
    approvalRecords: [],
    clarificationMessages: [],
    createdAt: '2026-11-16T10:30:00Z',
    updatedAt: '2026-11-16T10:30:00Z',
  },
  {
    id: 'req_003',
    requestNumber: 'REQ-2026-0893',
    title: 'Commercial Office Space Lease - Nov 2026',
    vendor: {
      id: 'v_02',
      name: 'DLF Cybercity Properties Pvt Ltd',
      vendorCode: 'VND-DLF-02',
      bankName: 'HDFC Bank',
      accountNumber: '5020001928371',
      ifscCode: 'HDFC0000128',
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
      id: 'd_02',
      name: 'Administration & Facilities',
      code: 'ADMIN',
      companyId: 'c_02',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_02',
      fullName: 'Kavita Rao',
      email: 'kavita.rao@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_02',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 520000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.RENT,
    priority: Priority.URGENT,
    status: RequestStatus.UNDER_REVIEW,
    invoiceNumber: 'RENT-NOV-8812',
    invoiceDate: '2026-11-01',
    dueDate: '2026-11-25',
    currentApprovalLevel: 2,
    totalApprovalLevels: 2,
    documents: [],
    approvalRecords: [],
    clarificationMessages: [],
    createdAt: '2026-11-17T09:15:00Z',
    updatedAt: '2026-11-17T09:15:00Z',
  },
  {
    id: 'req_006',
    requestNumber: 'REQ-2026-0898',
    title: 'Enterprise ERP Maintenance License Renewal',
    vendor: {
      id: 'v_03',
      name: 'SAP India Solutions Pvt Ltd',
      vendorCode: 'VND-SAP-03',
      bankName: 'Citibank N.A.',
      accountNumber: '0981726543',
      ifscCode: 'CITI0000002',
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
      id: 'd_03',
      name: 'Information Technology',
      code: 'IT',
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_03',
      fullName: 'Rohan Mehra',
      email: 'rohan.mehra@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 2850000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.IT_SOFTWARE,
    priority: Priority.HIGH,
    status: RequestStatus.UNDER_REVIEW,
    invoiceNumber: 'SAP-RNW-2026-019',
    invoiceDate: '2026-11-12',
    dueDate: '2026-12-01',
    currentApprovalLevel: 3,
    totalApprovalLevels: 3,
    documents: [],
    approvalRecords: [],
    clarificationMessages: [],
    createdAt: '2026-11-19T14:45:00Z',
    updatedAt: '2026-11-19T14:45:00Z',
  },
  {
    id: 'req_007',
    requestNumber: 'REQ-2026-0902',
    title: 'HVAC Air Conditioning Overhaul - Plant 2',
    vendor: {
      id: 'v_04',
      name: 'Voltas Engineering Services Ltd',
      vendorCode: 'VND-VOL-04',
      bankName: 'Axis Bank',
      accountNumber: '912010048123982',
      ifscCode: 'UTIB0000142',
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
      id: 'd_04',
      name: 'Plant Operations & Maintenance',
      code: 'MAINT',
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_04',
      fullName: 'Vikram Singh',
      email: 'vikram.singh@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_01',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 185000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.MAINTENANCE,
    priority: Priority.NORMAL,
    status: RequestStatus.UNDER_REVIEW,
    invoiceNumber: 'VOLT-SRV-4421',
    invoiceDate: '2026-11-18',
    dueDate: '2026-12-05',
    currentApprovalLevel: 1,
    totalApprovalLevels: 2,
    documents: [],
    approvalRecords: [],
    clarificationMessages: [],
    createdAt: '2026-11-20T11:20:00Z',
    updatedAt: '2026-11-20T11:20:00Z',
  },
  {
    id: 'req_008',
    requestNumber: 'REQ-2026-0910',
    title: 'Statutory External Financial Audit Q2 Retainer',
    vendor: {
      id: 'v_05',
      name: 'Deloitte Touche Tohmatsu India LLP',
      vendorCode: 'VND-DEL-05',
      bankName: 'Standard Chartered Bank',
      accountNumber: '22105198273',
      ifscCode: 'SCBL0036001',
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
    department: {
      id: 'd_05',
      name: 'Finance & Accounts',
      code: 'FIN',
      companyId: 'c_03',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    requester: {
      id: 'u_05',
      fullName: 'Pooja Sharma',
      email: 'pooja.sharma@mvgroup.com',
      role: 'REQUESTER' as any,
      companyId: 'c_03',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    amount: 850000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.CONSULTING,
    priority: Priority.HIGH,
    status: RequestStatus.UNDER_REVIEW,
    invoiceNumber: 'DEL-FIN-0982',
    invoiceDate: '2026-11-14',
    dueDate: '2026-11-29',
    currentApprovalLevel: 2,
    totalApprovalLevels: 3,
    documents: [],
    approvalRecords: [],
    clarificationMessages: [],
    createdAt: '2026-11-21T16:10:00Z',
    updatedAt: '2026-11-21T16:10:00Z',
  },
];

export const PendingApprovals: React.FC = () => {
  const navigate = useNavigate();

  // API Hooks
  const { data: apiResponse, isLoading, refetch, isRefetching } = usePendingApprovals();
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const { data: companiesData } = useAllCompanies();

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Confirmation Modals State
  const [approveModalItem, setApproveModalItem] = useState<PaymentRequest | null>(null);
  const [approveComment, setApproveComment] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState<string>('');

  const [rejectModalItem, setRejectModalItem] = useState<PaymentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Extract raw list from API response, fallback to mock data
  const rawRequests: PaymentRequest[] = useMemo(() => {
    if (apiResponse && apiResponse.data && apiResponse.data.length > 0) {
      return apiResponse.data;
    }
    return FALLBACK_PENDING_REQUESTS as PaymentRequest[];
  }, [apiResponse]);

  // Companies list for dropdown
  const companies = useMemo(() => {
    if (companiesData && companiesData.length > 0) return companiesData;
    return [
      { id: 'c_01', name: 'MV Agro Industries Ltd' },
      { id: 'c_02', name: 'MV Tech Innovations Ltd' },
      { id: 'c_03', name: 'MV Logistics Hub Pvt Ltd' },
    ];
  }, [companiesData]);

  // Filtering and Sorting
  const filteredRequests = useMemo(() => {
    return rawRequests.filter((req) => {
      // Normalization helpers
      const reqNumber = req.requestNumber || (req as any).request_number || req.id || '';
      const vendorName = req.vendor?.name || (req as any).vendor_name || '';
      const title = req.title || (req as any).payment_purpose || '';
      const requesterName = req.requester?.fullName || (req as any).requested_by_name || '';
      const companyId = req.companyId || req.company?.id || (req as any).company_name;
      const category = req.expenseCategory || (req as any).expense_category;
      const priority = req.priority;

      // Search match
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        reqNumber.toLowerCase().includes(query) ||
        vendorName.toLowerCase().includes(query) ||
        title.toLowerCase().includes(query) ||
        requesterName.toLowerCase().includes(query);

      // Filter matches
      const matchesCompany =
        selectedCompany === 'ALL' ||
        companyId === selectedCompany ||
        req.company?.name === selectedCompany;

      const matchesCategory =
        selectedCategory === 'ALL' || category === selectedCategory;

      const matchesPriority =
        selectedPriority === 'ALL' || priority === selectedPriority;

      return matchesSearch && matchesCompany && matchesCategory && matchesPriority;
    });
  }, [rawRequests, search, selectedCompany, selectedCategory, selectedPriority]);

  // Sorted requests
  const sortedRequests = useMemo(() => {
    const list = [...filteredRequests];
    const priorityWeights: Record<string, number> = {
      [Priority.URGENT]: 4,
      [Priority.HIGH]: 3,
      [Priority.NORMAL]: 2,
      [Priority.LOW]: 1,
    };

    return list.sort((a, b) => {
      const amountA = Number(a.amount ?? (a as any).total_amount ?? 0);
      const amountB = Number(b.amount ?? (b as any).total_amount ?? 0);
      const dateA = new Date(a.createdAt || (a as any).created_at || 0).getTime();
      const dateB = new Date(b.createdAt || (b as any).created_at || 0).getTime();
      const dueDateA = new Date(a.dueDate || (a as any).due_date || 0).getTime();
      const dueDateB = new Date(b.dueDate || (b as any).due_date || 0).getTime();

      switch (sortBy) {
        case 'priority': {
          const weightA = priorityWeights[a.priority] || 0;
          const weightB = priorityWeights[b.priority] || 0;
          if (weightB !== weightA) return weightB - weightA;
          return amountB - amountA; // secondary sort by amount
        }
        case 'amount_desc':
          return amountB - amountA;
        case 'amount_asc':
          return amountA - amountB;
        case 'date_desc':
          return dateB - dateA;
        case 'date_asc':
          return dateA - dateB;
        case 'due_date':
          return dueDateA - dueDateB;
        default:
          return 0;
      }
    });
  }, [filteredRequests, sortBy]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCount = sortedRequests.length;
    const totalAmount = sortedRequests.reduce(
      (sum, r) => sum + Number(r.amount ?? (r as any).total_amount ?? 0),
      0
    );
    const urgentCount = sortedRequests.filter(
      (r) => r.priority === Priority.URGENT || r.priority === Priority.HIGH
    ).length;

    return { totalCount, totalAmount, urgentCount };
  }, [sortedRequests]);

  // Handlers for Quick Action Modal Open
  const handleOpenApproveModal = (req: PaymentRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    setApproveModalItem(req);
    setApproveComment('');
    const originalAmount = req.amount ?? (req as any).total_amount ?? 0;
    setAdjustedAmount(String(originalAmount));
  };

  const handleOpenRejectModal = (req: PaymentRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectModalItem(req);
    setRejectionReason('');
    setRejectionError('');
  };

  // Execution Handlers
  const handleConfirmApproval = async () => {
    if (!approveModalItem) return;
    try {
      const finalAmount = adjustedAmount ? parseFloat(adjustedAmount) : undefined;
      await approveMutation.mutateAsync({
        requestId: approveModalItem.id,
        comment: approveComment.trim() || undefined,
        approvedAmount: finalAmount,
      });
      setApproveModalItem(null);
    } catch {
      // Error is handled by hook toast
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectModalItem) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Rejection justification is mandatory for compliance audit.');
      return;
    }
    if (rejectionReason.trim().length < 5) {
      setRejectionError('Please provide a substantive justification (minimum 5 characters).');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        requestId: rejectModalItem.id,
        reason: rejectionReason.trim(),
      });
      setRejectModalItem(null);
    } catch {
      // Error handled by hook toast
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Pending Approvals
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              {metrics.totalCount} Awaiting Sign-off
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review, authorize, adjust, or decline financial disbursement requisitions awaiting your level sign-off.
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
          <Link to="/approvals/history">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<History className="w-4 h-4" />}
              className="text-xs"
            >
              Approval History
            </Button>
          </Link>
        </div>
      </div>

      {/* High-Impact Enterprise Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-950/20 dark:to-amber-900/10 dark:border-amber-800/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Total Pending Sign-offs
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-100">
            {metrics.totalCount}
          </div>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
            Requisitions currently locked in your queue
          </p>
        </div>

        <div className="p-5 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/20 dark:to-emerald-900/10 dark:border-emerald-800/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Total Pending Value
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100">
            {formatCurrency(metrics.totalAmount)}
          </div>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Combined exposure awaiting fund release
          </p>
        </div>

        <div className="p-5 rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/40 dark:from-rose-950/20 dark:to-rose-900/10 dark:border-rose-800/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Urgent / High Priority
            </span>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-900 dark:text-rose-100">
            {metrics.urgentCount}
          </div>
          <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-400/80">
            Requires immediate verification to avoid penalties
          </p>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Request ID, Vendor, Purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition-all"
            />
          </div>

          {/* Company Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Categories</option>
              {Object.values(ExpenseCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Priorities</option>
              <option value={Priority.URGENT}>Urgent</option>
              <option value={Priority.HIGH}>High</option>
              <option value={Priority.NORMAL}>Normal</option>
              <option value={Priority.LOW}>Low</option>
            </select>
          </div>
        </div>

        {/* Sort and View Mode Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">Sort By:</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setSortBy('priority')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortBy === 'priority'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-navy-800 dark:text-white shadow-xs'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Priority
              </button>
              <button
                type="button"
                onClick={() => setSortBy('amount_desc')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortBy === 'amount_desc'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-navy-800 dark:text-white shadow-xs'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Amount (High → Low)
              </button>
              <button
                type="button"
                onClick={() => setSortBy('due_date')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortBy === 'due_date'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-navy-800 dark:text-white shadow-xs'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Due Date
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date_desc')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortBy === 'date_desc'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-navy-800 dark:text-white shadow-xs'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Newest Submitted
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span>Showing <strong className="text-slate-900 dark:text-white">{sortedRequests.length}</strong> items</span>
            <div className="hidden sm:inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2 py-1 rounded-md ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 font-medium text-navy-800 dark:text-white shadow-xs'
                    : ''
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2 py-1 rounded-md ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 font-medium text-navy-800 dark:text-white shadow-xs'
                    : ''
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-500">Loading pending approval queue...</p>
        </div>
      ) : sortedRequests.length === 0 ? (
        <EmptyState
          title="No Pending Approvals"
          description={
            search || selectedCompany !== 'ALL' || selectedCategory !== 'ALL' || selectedPriority !== 'ALL'
              ? 'No requests match your selected filters. Try resetting search or filter criteria.'
              : 'You have cleared all pending disbursement requisitions in your authorization queue!'
          }
          icon={<ShieldCheck className="w-12 h-12 text-slate-400" />}
          action={
            search || selectedCompany !== 'ALL' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedCompany('ALL');
                  setSelectedCategory('ALL');
                  setSelectedPriority('ALL');
                }}
              >
                Reset All Filters
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'cards' ? (
        /* Vertical Card Stack Layout (Optimized for Mobile & Desktop) */
        <div className="space-y-4">
          {sortedRequests.map((req) => {
            const reqNumber = req.requestNumber || (req as any).request_number || req.id;
            const vendorName = req.vendor?.name || (req as any).vendor_name || 'Vendor';
            const amount = req.amount ?? (req as any).total_amount ?? 0;
            const category = req.expenseCategory || (req as any).expense_category || 'GENERAL';
            const priority = (req.priority || Priority.NORMAL) as Priority;
            const dueDate = req.dueDate || (req as any).due_date;
            const submittedBy = req.requester?.fullName || (req as any).requested_by_name || 'User';
            const submittedDate = req.createdAt || (req as any).created_at;
            const companyName = req.company?.name || (req as any).company_name || 'MV Group';
            const department = req.department?.name || (req as any).department_name;
            const priorityStyle = getPriorityColor(priority);

            return (
              <div
                key={req.id}
                onClick={() => navigate(`/approvals/${req.id}`)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:shadow-md hover:border-navy-300 dark:hover:border-navy-700 transition-all cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Requisition Identity & Details */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy-700 dark:text-navy-300 bg-navy-50 dark:bg-navy-950/60 px-2 py-0.5 rounded border border-navy-200 dark:border-navy-800">
                        {reqNumber}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${priorityStyle.badge}`}
                      >
                        {priority} PRIORITY
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Tag className="w-3 h-3 mr-1 text-slate-400" />
                        {String(category).replace(/_/g, ' ')}
                      </span>
                      {dueDate && (
                        <span className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                          Due: <strong className="ml-1 text-slate-700 dark:text-slate-200">{formatDate(dueDate)}</strong>
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-navy-600 dark:group-hover:text-navy-300 transition-colors line-clamp-1">
                        {req.title || `Payment for ${vendorName}`}
                      </h3>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="inline-flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <strong className="text-slate-700 dark:text-slate-300 mr-1">Vendor:</strong> {vendorName}
                        </span>
                        <span className="inline-flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {companyName} {department ? `(${department})` : ''}
                        </span>
                        <span className="inline-flex items-center">
                          <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          Requested by: <span className="ml-1 font-medium text-slate-700 dark:text-slate-300">{submittedBy}</span>
                        </span>
                        {submittedDate && (
                          <span className="inline-flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            Submitted: {formatDate(submittedDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Amount & Quick Touch-Friendly Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                        Requisition Amount
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {formatCurrency(amount)}
                      </div>
                      <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Level {req.currentApprovalLevel || 1} of {req.totalApprovalLevels || 2} sign-off
                      </span>
                    </div>

                    {/* Touch-Friendly Action Buttons */}
                    <div
                      className="flex items-center gap-2 w-full sm:w-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="success"
                        size="md"
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        onClick={(e) => handleOpenApproveModal(req, e)}
                        className="flex-1 sm:flex-none font-semibold px-4 min-h-[44px] shadow-sm active:scale-95 transition-transform"
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="md"
                        leftIcon={<XCircle className="w-4 h-4" />}
                        onClick={(e) => handleOpenRejectModal(req, e)}
                        className="flex-1 sm:flex-none font-semibold px-4 min-h-[44px] shadow-sm active:scale-95 transition-transform"
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => navigate(`/approvals/${req.id}`)}
                        className="p-2.5 min-h-[44px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="View Full Requisition Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Structured Table Layout */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Vendor & Company</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {sortedRequests.map((req) => {
                  const reqNumber = req.requestNumber || (req as any).request_number || req.id;
                  const vendorName = req.vendor?.name || (req as any).vendor_name || 'Vendor';
                  const amount = req.amount ?? (req as any).total_amount ?? 0;
                  const category = req.expenseCategory || (req as any).expense_category || 'GENERAL';
                  const priority = (req.priority || Priority.NORMAL) as Priority;
                  const dueDate = req.dueDate || (req as any).due_date;
                  const submittedBy = req.requester?.fullName || (req as any).requested_by_name || 'User';
                  const priorityStyle = getPriorityColor(priority);

                  return (
                    <tr
                      key={req.id}
                      onClick={() => navigate(`/approvals/${req.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-navy-700 dark:text-navy-300">
                        {reqNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{vendorName}</div>
                        <div className="text-2xs text-slate-400">{req.company?.name || 'MV Group'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {String(category).replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold ${priorityStyle.badge}`}>
                          {priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white text-sm">
                        {formatCurrency(amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {submittedBy}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {dueDate ? formatDate(dueDate) : '-'}
                      </td>
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={(e) => handleOpenApproveModal(req, e)}
                            className="px-2.5 py-1 text-xs"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => handleOpenRejectModal(req, e)}
                            className="px-2.5 py-1 text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRITICAL: APPROVE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(approveModalItem)}
        onClose={() => setApproveModalItem(null)}
        title={
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Confirm Payment Approval</span>
          </div>
        }
        description="Verify requisition details and confirm authorization for fund disbursement."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setApproveModalItem(null)}
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
              onClick={handleConfirmApproval}
              className="font-bold px-6 shadow-md"
            >
              Confirm Approval
            </Button>
          </div>
        }
      >
        {approveModalItem && (
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-2">
              <div className="text-xs uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-300">
                Are you sure you want to approve this payment?
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Request ID:</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    {approveModalItem.requestNumber || (approveModalItem as any).request_number || approveModalItem.id}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Vendor:</span>
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {approveModalItem.vendor?.name || (approveModalItem as any).vendor_name}
                  </div>
                </div>
                <div className="col-span-2 pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Requisition Amount:</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(approveModalItem.amount ?? (approveModalItem as any).total_amount ?? 0)}
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
                placeholder="Leave blank or same to authorize full amount"
              />
              <p className="text-2xs text-slate-400">
                If statutory TDS or negotiated deduction applies, adjust the authorized net amount here.
              </p>
            </div>

            {/* Optional Comments */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Approval Remarks / Instructions <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <Textarea
                rows={3}
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="e.g., Verified against PO #8891. Release payment via RTGS before Friday."
              />
            </div>
          </div>
        )}
      </Modal>

      {/* CRITICAL: REJECT CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(rejectModalItem)}
        onClose={() => setRejectModalItem(null)}
        title={
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <XCircle className="w-5 h-5 text-rose-600" />
            <span>Reject Payment Requisition</span>
          </div>
        }
        description="Formal rejection halts disbursement. A mandatory justification will be recorded in the audit log and emailed to the requester."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setRejectModalItem(null)}
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
              onClick={handleConfirmRejection}
              className="font-bold px-6 shadow-md"
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        {rejectModalItem && (
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs">
              <span className="font-semibold text-rose-900 dark:text-rose-200">Target Request:</span>{' '}
              <strong className="font-mono">
                {rejectModalItem.requestNumber || (rejectModalItem as any).request_number || rejectModalItem.id}
              </strong>{' '}
              ({formatCurrency(rejectModalItem.amount ?? (rejectModalItem as any).total_amount ?? 0)}) to{' '}
              <strong>{rejectModalItem.vendor?.name || (rejectModalItem as any).vendor_name}</strong>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
                <span>Rejection Reason *</span>
                <span className="font-normal text-2xs text-slate-400">Required (min 5 characters)</span>
              </label>
              <Textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError('');
                }}
                placeholder="State the formal compliance, billing discrepancy, or budgetary ground for rejecting this disbursement..."
                className={rejectionError ? 'border-rose-500 focus:ring-rose-500' : ''}
              />
              {rejectionError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {rejectionError}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PendingApprovals;
