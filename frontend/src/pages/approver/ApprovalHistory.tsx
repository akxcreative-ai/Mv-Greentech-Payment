import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  History,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Calendar,
  Building2,
  Download,
  Eye,
  FileText,
  Clock,
  ArrowUpDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  Input,
  Select,
  EmptyState,
  LoadingSpinner,
} from '@/components/ui';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAllCompanies } from '@/hooks/useCompanies';
import { useAllVendors } from '@/hooks/useVendors';
import {
  PaymentRequest,
  RequestStatus,
  Priority,
  ExpenseCategory,
  ApprovalAction,
} from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

type TabType = 'APPROVED' | 'REJECTED' | 'ALL';

// Rich fallback history records for testing & development
const FALLBACK_HISTORY_REQUESTS: Partial<PaymentRequest>[] = [
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
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: '2026-11-20T14:30:00Z',
    approvalRecords: [
      {
        id: 'rec_01',
        paymentRequestId: 'req_002',
        approverId: 'usr_me',
        status: ApprovalAction.APPROVED,
        comments: 'Verified against AWS enterprise tier pricing contract. Approved for payment release.',
        actionDate: '2026-11-20T14:30:00Z',
        level: 2,
        createdAt: '2026-11-20T14:30:00Z',
      },
    ],
  },
  {
    id: 'req_004',
    requestNumber: 'REQ-2026-0894',
    title: 'Corporate Travel and Client Hospitality - Bangalore Summit',
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
    amount: 112500,
    currency: 'INR',
    expenseCategory: ExpenseCategory.TRAVEL_ENTERTAINMENT,
    priority: Priority.LOW,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'MMT-CORP-0982',
    createdAt: '2026-11-08T11:00:00Z',
    updatedAt: '2026-11-19T16:15:00Z',
    approvalRecords: [
      {
        id: 'rec_02',
        paymentRequestId: 'req_004',
        approverId: 'usr_me',
        status: ApprovalAction.APPROVED,
        comments: 'All hotel and flight vouchers attached and verified against travel policy.',
        actionDate: '2026-11-19T16:15:00Z',
        level: 1,
        createdAt: '2026-11-19T16:15:00Z',
      },
    ],
  },
  {
    id: 'req_009',
    requestNumber: 'REQ-2026-0888',
    title: 'Consulting Retainer for Market Expansion Strategy',
    vendor: {
      id: 'v_06',
      name: 'McKinsey & Company India LLP',
      vendorCode: 'VND-MCK-06',
      bankName: 'Deutsche Bank',
      accountNumber: '1092837461',
      ifscCode: 'DEUT0796DEL',
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
    amount: 3200000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.CONSULTING,
    priority: Priority.HIGH,
    status: RequestStatus.REJECTED,
    invoiceNumber: 'MCK-DEL-8871',
    rejectionReason: 'Scope deliverables not yet submitted by vendor. Payment deferred to next billing cycle.',
    createdAt: '2026-11-05T10:00:00Z',
    updatedAt: '2026-11-18T12:00:00Z',
    approvalRecords: [
      {
        id: 'rec_03',
        paymentRequestId: 'req_009',
        approverId: 'usr_me',
        status: ApprovalAction.REJECTED,
        comments: 'Deliverable milestones incomplete per project schedule. Rejection logged.',
        actionDate: '2026-11-18T12:00:00Z',
        level: 2,
        createdAt: '2026-11-18T12:00:00Z',
      },
    ],
  },
  {
    id: 'req_010',
    requestNumber: 'REQ-2026-0879',
    title: 'Heavy Logistics Transport Charges - Fleet Batch #12',
    vendor: {
      id: 'v_07',
      name: 'Blue Dart Express Freight',
      vendorCode: 'VND-BDT-07',
      bankName: 'Kotak Mahindra Bank',
      accountNumber: '8819203912',
      ifscCode: 'KKBK0000958',
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
    amount: 450000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.LOGISTICS,
    priority: Priority.NORMAL,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'BDT-LOG-7721',
    createdAt: '2026-11-02T14:00:00Z',
    updatedAt: '2026-11-15T11:45:00Z',
    approvalRecords: [
      {
        id: 'rec_04',
        paymentRequestId: 'req_010',
        approverId: 'usr_me',
        status: ApprovalAction.APPROVED,
        comments: 'Waybills reconciled with internal dispatch records. Approved.',
        actionDate: '2026-11-15T11:45:00Z',
        level: 2,
        createdAt: '2026-11-15T11:45:00Z',
      },
    ],
  },
  {
    id: 'req_011',
    requestNumber: 'REQ-2026-0865',
    title: 'Annual Fire Safety Audit & Equipment Servicing',
    vendor: {
      id: 'v_08',
      name: 'Ceasefire Industries Ltd',
      vendorCode: 'VND-CSR-08',
      bankName: 'HDFC Bank',
      accountNumber: '5020008819231',
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
    amount: 195000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.MAINTENANCE,
    priority: Priority.NORMAL,
    status: RequestStatus.APPROVED,
    invoiceNumber: 'CF-SRV-2026-90',
    createdAt: '2026-10-28T09:30:00Z',
    updatedAt: '2026-11-12T10:15:00Z',
    approvalRecords: [
      {
        id: 'rec_05',
        paymentRequestId: 'req_011',
        approverId: 'usr_me',
        status: ApprovalAction.APPROVED,
        comments: 'Safety certificates filed with administration. Approved.',
        actionDate: '2026-11-12T10:15:00Z',
        level: 1,
        createdAt: '2026-11-12T10:15:00Z',
      },
    ],
  },
  {
    id: 'req_012',
    requestNumber: 'REQ-2026-0854',
    title: 'Duplicate Office Stationery Order - Duplicate Submission',
    vendor: {
      id: 'v_09',
      name: 'Staples India Commercial Supplies',
      vendorCode: 'VND-STP-09',
      bankName: 'Axis Bank',
      accountNumber: '9110200192837',
      ifscCode: 'UTIB0000142',
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
    amount: 45000,
    currency: 'INR',
    expenseCategory: ExpenseCategory.OFFICE_SUPPLIES,
    priority: Priority.LOW,
    status: RequestStatus.REJECTED,
    invoiceNumber: 'STP-2026-881',
    rejectionReason: 'Duplicate invoice already reimbursed in Batch #82. Denied.',
    createdAt: '2026-10-25T11:00:00Z',
    updatedAt: '2026-11-05T14:20:00Z',
    approvalRecords: [
      {
        id: 'rec_06',
        paymentRequestId: 'req_012',
        approverId: 'usr_me',
        status: ApprovalAction.REJECTED,
        comments: 'Duplicate billing identified during maker-checker verification.',
        actionDate: '2026-11-05T14:20:00Z',
        level: 1,
        createdAt: '2026-11-05T14:20:00Z',
      },
    ],
  },
];

export const ApprovalHistory: React.FC = () => {
  const navigate = useNavigate();

  // Queries
  const { data: apiResponse, isLoading, refetch, isRefetching } = usePaymentRequests({
    pageSize: 100,
  });
  const { data: companiesData } = useAllCompanies();
  const { data: vendorsData } = useAllVendors();

  // Filter States
  const [activeTab, setActiveTab] = useState<TabType>('APPROVED');
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Extract base list
  const allHistoryRecords: PaymentRequest[] = useMemo(() => {
    if (apiResponse && apiResponse.data && apiResponse.data.length > 0) {
      // Filter requests that are decided (APPROVED, REJECTED, PAID, etc.)
      const decided = apiResponse.data.filter(
        (r) =>
          r.status === RequestStatus.APPROVED ||
          r.status === RequestStatus.REJECTED ||
          r.status === RequestStatus.PAID
      );
      if (decided.length > 0) return decided;
    }
    return FALLBACK_HISTORY_REQUESTS as PaymentRequest[];
  }, [apiResponse]);

  // Companies & Vendors list
  const companies = useMemo(() => {
    if (companiesData && companiesData.length > 0) return companiesData;
    return [
      { id: 'c_01', name: 'MV Agro Industries Ltd' },
      { id: 'c_02', name: 'MV Tech Innovations Ltd' },
      { id: 'c_03', name: 'MV Logistics Hub Pvt Ltd' },
    ];
  }, [companiesData]);

  const vendors = useMemo(() => {
    if (vendorsData && vendorsData.length > 0) return vendorsData;
    return [
      { id: 'v_02', name: 'Amazon Web Services India' },
      { id: 'v_03', name: 'MakeMyTrip Corporate Solutions' },
      { id: 'v_06', name: 'McKinsey & Company India LLP' },
      { id: 'v_07', name: 'Blue Dart Express Freight' },
      { id: 'v_08', name: 'Ceasefire Industries Ltd' },
      { id: 'v_09', name: 'Staples India Commercial Supplies' },
    ];
  }, [vendorsData]);

  // Tab Filtering
  const tabFiltered = useMemo(() => {
    return allHistoryRecords.filter((req) => {
      if (activeTab === 'APPROVED') {
        return req.status === RequestStatus.APPROVED || req.status === RequestStatus.PAID;
      }
      if (activeTab === 'REJECTED') {
        return req.status === RequestStatus.REJECTED;
      }
      return true;
    });
  }, [allHistoryRecords, activeTab]);

  // Comprehensive Search & Advanced Filtering
  const filteredRecords = useMemo(() => {
    return tabFiltered.filter((req) => {
      const reqNumber = req.requestNumber || (req as any).request_number || req.id || '';
      const vendorName = req.vendor?.name || (req as any).vendor_name || '';
      const title = req.title || (req as any).payment_purpose || '';
      const companyName = req.company?.name || (req as any).company_name || '';
      const query = search.trim().toLowerCase();

      // Search match
      const matchesSearch =
        !query ||
        reqNumber.toLowerCase().includes(query) ||
        vendorName.toLowerCase().includes(query) ||
        title.toLowerCase().includes(query);

      // Company match
      const matchesCompany =
        selectedCompany === 'ALL' ||
        companyName === selectedCompany ||
        req.companyId === selectedCompany;

      // Vendor match
      const matchesVendor =
        selectedVendor === 'ALL' ||
        vendorName === selectedVendor ||
        req.vendorId === selectedVendor;

      // Date range match (decision date or updated date)
      const decisionDateStr =
        req.approvalRecords?.[0]?.actionDate || req.updatedAt || (req as any).created_at;
      let matchesDate = true;
      if (decisionDateStr) {
        const itemDate = new Date(decisionDateStr).getTime();
        if (startDate) {
          matchesDate = matchesDate && itemDate >= new Date(startDate).getTime();
        }
        if (endDate) {
          matchesDate = matchesDate && itemDate <= new Date(endDate + 'T23:59:59').getTime();
        }
      }

      return matchesSearch && matchesCompany && matchesVendor && matchesDate;
    });
  }, [tabFiltered, search, selectedCompany, selectedVendor, startDate, endDate]);

  // Pagination calculation
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Aggregate Counts for Tabs
  const counts = useMemo(() => {
    const approvedCount = allHistoryRecords.filter(
      (r) => r.status === RequestStatus.APPROVED || r.status === RequestStatus.PAID
    ).length;
    const rejectedCount = allHistoryRecords.filter(
      (r) => r.status === RequestStatus.REJECTED
    ).length;
    return {
      all: allHistoryRecords.length,
      approved: approvedCount,
      rejected: rejectedCount,
    };
  }, [allHistoryRecords]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Request ID', 'Vendor', 'Amount', 'Status', 'Decision Date', 'Comment'];
    const rows = filteredRecords.map((r) => [
      r.requestNumber || r.id,
      `"${r.vendor?.name || (r as any).vendor_name || ''}"`,
      r.amount ?? (r as any).total_amount ?? 0,
      r.status,
      r.approvalRecords?.[0]?.actionDate ? formatDate(r.approvalRecords[0].actionDate) : formatDate(r.updatedAt),
      `"${r.approvalRecords?.[0]?.comments || r.rejectionReason || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `approval_history_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Approval History
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
              Audit Trail
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Historical log of all payment disbursements approved, adjusted, or rejected by you.
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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs"
          >
            Export History (.csv)
          </Button>
        </div>
      </div>

      {/* TABS: Approved, Rejected, All */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setActiveTab('APPROVED');
            setCurrentPage(1);
          }}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'APPROVED'
              ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Approved Requisitions
          <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
            {counts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('REJECTED');
            setCurrentPage(1);
          }}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'REJECTED'
              ? 'border-rose-600 text-rose-700 dark:border-rose-400 dark:text-rose-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <XCircle className="w-4 h-4 text-rose-600" />
          Rejected Requisitions
          <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
            {counts.rejected}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('ALL');
            setCurrentPage(1);
          }}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ALL'
              ? 'border-navy-700 text-navy-800 dark:border-navy-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          All Decisions
          <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {counts.all}
          </span>
        </button>
      </div>

      {/* Advanced Filter Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Request ID, Vendor, Purpose..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition-all"
            />
          </div>

          {/* Company Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                setCurrentPage(1);
              }}
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

          {/* Vendor Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedVendor}
              onChange={(e) => {
                setSelectedVendor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters button */}
          <div className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                setSearch('');
                setSelectedCompany('ALL');
                setSelectedVendor('ALL');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
              }}
              className="text-xs"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Date Range Sub-Bar */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">Decision Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-1 focus:ring-navy-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-1 focus:ring-navy-600"
            />
          </div>

          <div className="ml-auto text-slate-400">
            Showing <strong className="text-slate-800 dark:text-white">{filteredRecords.length}</strong> audited records
          </div>
        </div>
      </Card>

      {/* History Table / Records View */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-500">Retrieving decision history...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <EmptyState
          title="No Decision Records Found"
          description="No historical approval or rejection records match the specified filters or date criteria."
          icon={<History className="w-12 h-12 text-slate-400" />}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Request ID</th>
                  <th className="py-3.5 px-4">Vendor & Company</th>
                  <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Decision Date</th>
                  <th className="py-3.5 px-4">Audited Remarks / Comment</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {paginatedRecords.map((req) => {
                  const reqNumber = req.requestNumber || (req as any).request_number || req.id;
                  const vendorName = req.vendor?.name || (req as any).vendor_name || 'Vendor';
                  const amount = req.amount ?? (req as any).total_amount ?? 0;
                  const companyName = req.company?.name || (req as any).company_name || 'MV Group';
                  const latestRecord = req.approvalRecords?.[0];
                  const decisionDate = latestRecord?.actionDate || req.updatedAt || (req as any).created_at;
                  const comment = latestRecord?.comments || req.rejectionReason || req.remarks || '-';
                  const isApproved = req.status === RequestStatus.APPROVED || req.status === RequestStatus.PAID;

                  return (
                    <tr
                      key={req.id}
                      onClick={() => navigate(`/approvals/${req.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-navy-700 dark:text-navy-300">
                        {reqNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{vendorName}</div>
                        <div className="text-2xs text-slate-400">{companyName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white text-sm">
                        {formatCurrency(amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {decisionDate ? formatDateTime(decisionDate) : '-'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300 italic">
                        "{comment}"
                      </td>
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/approvals/${req.id}`)}
                          className="text-xs"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Dossier
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{' '}
              <strong className="text-slate-900 dark:text-white">
                {(currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900 dark:text-white">
                {Math.min(currentPage * pageSize, totalRecords)}
              </strong>{' '}
              of <strong className="text-slate-900 dark:text-white">{totalRecords}</strong> records
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>

              <div className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalHistory;
