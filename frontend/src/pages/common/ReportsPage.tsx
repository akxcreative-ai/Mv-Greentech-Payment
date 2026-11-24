import React, { useState, useMemo } from 'react';
import {
  formatCurrency,
  formatDate,
} from '@/utils/format';
import {
  FileText,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Search,
  ArrowUpDown,
  PieChart as PieChartIcon,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  Button,
  Table,
  TableHeaderCell,
  TableCell,
  TableRow,
  TableHead,
  TableBody,
  Pagination,
  Badge,
  Avatar,
  BadgeVariant,
} from '@/components/ui';
import toast from 'react-hot-toast';

// Available Report Types as defined in specs
export type ReportType =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CATEGORY_WISE'
  | 'VENDOR_WISE'
  | 'MONTHLY'
  | 'DEPARTMENT_WISE'
  | 'APPROVAL_TIME'
  | 'THRESHOLD_EXCEPTIONS';

export interface ReportOption {
  id: ReportType;
  label: string;
  category: 'status' | 'analytics' | 'governance';
  description: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  // Status Pipeline Reports
  {
    id: 'PENDING_APPROVAL',
    label: 'Pending Approval',
    category: 'status',
    description: 'Requisitions awaiting Level 1 or Level 2 management sign-off',
  },
  {
    id: 'APPROVED',
    label: 'Approved Requisitions',
    category: 'status',
    description: 'Fully authorized requisitions cleared for banking disbursement',
  },
  {
    id: 'REJECTED',
    label: 'Rejected Requisitions',
    category: 'status',
    description: 'Declined requisitions along with reviewer justification notes',
  },
  {
    id: 'PAYMENT_PENDING',
    label: 'Payment Pending',
    category: 'status',
    description: 'Approved requisitions queued in accounts payable for batch disbursement',
  },
  {
    id: 'COMPLETED',
    label: 'Completed Disbursements',
    category: 'status',
    description: 'Settled payments with verified bank UTR confirmation reference',
  },
  {
    id: 'CANCELLED',
    label: 'Cancelled Requests',
    category: 'status',
    description: 'Requisitions retracted or voided prior to authorization',
  },

  // Analytics & Distributions
  {
    id: 'CATEGORY_WISE',
    label: 'Category-wise Spend',
    category: 'analytics',
    description: 'Expenditure distribution across IT, Raw Materials, Logistics, etc.',
  },
  {
    id: 'VENDOR_WISE',
    label: 'Vendor-wise Spend',
    category: 'analytics',
    description: 'Vendor expenditure concentration, terms, and invoice volumes',
  },
  {
    id: 'MONTHLY',
    label: 'Monthly Spend Trend',
    category: 'analytics',
    description: 'Month-over-month expenditure progression, variance, and forecast',
  },
  {
    id: 'DEPARTMENT_WISE',
    label: 'Department-wise Spend',
    category: 'analytics',
    description: 'Budget utilization vs actual spend across operating business units',
  },

  // Governance & Performance
  {
    id: 'APPROVAL_TIME',
    label: 'Approval Turnaround Time',
    category: 'governance',
    description: 'SLA turnaround metrics and processing cycle times per approver',
  },
  {
    id: 'THRESHOLD_EXCEPTIONS',
    label: 'Threshold Exceptions',
    category: 'governance',
    description: 'High-value requests exceeding default policy limits (> ₹1,00,000)',
  },
];

// Seed Comprehensive Data for Reports
interface RequisitionItem {
  id: string;
  requestNumber: string;
  title: string;
  amount: number;
  requesterName: string;
  requesterEmail: string;
  companyName: string;
  departmentName: string;
  vendorName: string;
  vendorCode: string;
  category: string;
  status: string;
  priority: string;
  isThresholdException: boolean;
  approvalDays: number;
  submittedAt: string;
  approvedAt?: string;
  utrNumber?: string;
}

const SEED_REQUISITIONS: RequisitionItem[] = [
  {
    id: 'req_001',
    requestNumber: 'REQ-2026-0891',
    title: 'Enterprise ERP License Q4 2026 Renewal',
    amount: 485000,
    requesterName: 'Amit Patel',
    requesterEmail: 'amit.patel@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'IT & Infrastructure',
    vendorName: 'Apex Cloud Solutions Pvt Ltd',
    vendorCode: 'VND-001',
    category: 'IT_SOFTWARE',
    status: 'APPROVED',
    priority: 'HIGH',
    isThresholdException: true,
    approvalDays: 1.5,
    submittedAt: '2026-11-20T10:00:00Z',
    approvedAt: '2026-11-21T14:30:00Z',
  },
  {
    id: 'req_002',
    requestNumber: 'REQ-2026-0892',
    title: 'Fleet Logistics & Transit Insurance Nov 2026',
    amount: 320000,
    requesterName: 'Sanjay Verma',
    requesterEmail: 'sanjay.verma@mvholdings.com',
    companyName: 'MV Infrastructure & Logistics Ltd',
    departmentName: 'Supply Chain & Logistics',
    vendorName: 'NextGen Logistics LLP',
    vendorCode: 'VND-002',
    category: 'LOGISTICS',
    status: 'PAID',
    priority: 'NORMAL',
    isThresholdException: true,
    approvalDays: 2.1,
    submittedAt: '2026-11-18T09:30:00Z',
    approvedAt: '2026-11-20T11:00:00Z',
    utrNumber: 'HDFCN26327891240',
  },
  {
    id: 'req_003',
    requestNumber: 'REQ-2026-0893',
    title: 'Quarterly External Financial Audit Consulting',
    amount: 175000,
    requesterName: 'Sneha Kulkarni',
    requesterEmail: 'sneha.kulkarni@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'Finance & Accounts',
    vendorName: 'Deloitte & Touche Advisors LLP',
    vendorCode: 'VND-003',
    category: 'CONSULTING',
    status: 'PAYMENT_PENDING',
    priority: 'HIGH',
    isThresholdException: true,
    approvalDays: 1.2,
    submittedAt: '2026-11-21T11:15:00Z',
    approvedAt: '2026-11-22T14:00:00Z',
  },
  {
    id: 'req_004',
    requestNumber: 'REQ-2026-0894',
    title: 'High-Grade Steel Plate Consignment Batch 8',
    amount: 1420000,
    requesterName: 'Manoj Tiwari',
    requesterEmail: 'manoj.tiwari@mvholdings.com',
    companyName: 'MV Infrastructure & Logistics Ltd',
    departmentName: 'Procurement',
    vendorName: 'Tata Steel Industrial Supply',
    vendorCode: 'VND-004',
    category: 'RAW_MATERIALS',
    status: 'UNDER_REVIEW',
    priority: 'URGENT',
    isThresholdException: true,
    approvalDays: 0.8,
    submittedAt: '2026-11-22T15:00:00Z',
  },
  {
    id: 'req_005',
    requestNumber: 'REQ-2026-0895',
    title: 'Workstation Laptops for New Engineering Cohort',
    amount: 650000,
    requesterName: 'Amit Patel',
    requesterEmail: 'amit.patel@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'IT & Infrastructure',
    vendorName: 'Dell Global Business Solutions',
    vendorCode: 'VND-005',
    category: 'IT_SOFTWARE',
    status: 'SUBMITTED',
    priority: 'NORMAL',
    isThresholdException: true,
    approvalDays: 0.4,
    submittedAt: '2026-11-23T09:00:00Z',
  },
  {
    id: 'req_006',
    requestNumber: 'REQ-2026-0888',
    title: 'Digital Marketing Campaign Creatives & Ads',
    amount: 88000,
    requesterName: 'Kavita Nair',
    requesterEmail: 'kavita.nair@mvholdings.com',
    companyName: 'MV Technologies & Digital',
    departmentName: 'Marketing & PR',
    vendorName: 'PixelCraft Interactive Studios',
    vendorCode: 'VND-006',
    category: 'MARKETING',
    status: 'REJECTED',
    priority: 'LOW',
    isThresholdException: false,
    approvalDays: 3.5,
    submittedAt: '2026-11-15T14:00:00Z',
    approvedAt: '2026-11-18T16:00:00Z',
  },
  {
    id: 'req_007',
    requestNumber: 'REQ-2026-0885',
    title: 'Headquarters Facility Electricity & Diesel Generator',
    amount: 94000,
    requesterName: 'Ramesh Gupta',
    requesterEmail: 'ramesh.gupta@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'Facilities & Administration',
    vendorName: 'Mahindra Power Facilities',
    vendorCode: 'VND-007',
    category: 'UTILITIES',
    status: 'PAID',
    priority: 'NORMAL',
    isThresholdException: false,
    approvalDays: 1.0,
    submittedAt: '2026-11-16T10:00:00Z',
    approvedAt: '2026-11-17T11:00:00Z',
    utrNumber: 'ICICR26320019283',
  },
  {
    id: 'req_008',
    requestNumber: 'REQ-2026-0880',
    title: 'Executive Annual Strategic Offsite Retreat',
    amount: 145000,
    requesterName: 'Ananya Roy',
    requesterEmail: 'ananya.roy@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'Human Resources',
    vendorName: 'Taj Group Corporate Hospitality',
    vendorCode: 'VND-008',
    category: 'TRAVEL_ENTERTAINMENT',
    status: 'CANCELLED',
    priority: 'LOW',
    isThresholdException: true,
    approvalDays: 0.2,
    submittedAt: '2026-11-10T12:00:00Z',
  },
  {
    id: 'req_009',
    requestNumber: 'REQ-2026-0879',
    title: 'Industrial Heavy Equipment Monthly Maintenance',
    amount: 215000,
    requesterName: 'Sanjay Verma',
    requesterEmail: 'sanjay.verma@mvholdings.com',
    companyName: 'MV Infrastructure & Logistics Ltd',
    departmentName: 'Supply Chain & Logistics',
    vendorName: 'Larsen & Toubro Plant Services',
    vendorCode: 'VND-009',
    category: 'MAINTENANCE',
    status: 'PAID',
    priority: 'HIGH',
    isThresholdException: true,
    approvalDays: 1.8,
    submittedAt: '2026-11-08T09:00:00Z',
    approvedAt: '2026-11-10T11:00:00Z',
    utrNumber: 'SBINR26312984712',
  },
  {
    id: 'req_010',
    requestNumber: 'REQ-2026-0875',
    title: 'Cloud Database Architecture Security Audit',
    amount: 350000,
    requesterName: 'Amit Patel',
    requesterEmail: 'amit.patel@mvholdings.com',
    companyName: 'MV Technologies & Digital',
    departmentName: 'IT & Infrastructure',
    vendorName: 'CyberGuard Threat Intelligence',
    vendorCode: 'VND-010',
    category: 'IT_SOFTWARE',
    status: 'APPROVED',
    priority: 'HIGH',
    isThresholdException: true,
    approvalDays: 1.4,
    submittedAt: '2026-11-05T13:00:00Z',
    approvedAt: '2026-11-07T10:00:00Z',
  },
  {
    id: 'req_011',
    requestNumber: 'REQ-2026-0872',
    title: 'Commercial Office Space Lease - Nov 2026',
    amount: 550000,
    requesterName: 'Ramesh Gupta',
    requesterEmail: 'ramesh.gupta@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'Facilities & Administration',
    vendorName: 'DLF CyberCity Developers',
    vendorCode: 'VND-011',
    category: 'RENT',
    status: 'PAID',
    priority: 'NORMAL',
    isThresholdException: true,
    approvalDays: 1.1,
    submittedAt: '2026-11-01T10:00:00Z',
    approvedAt: '2026-11-02T12:00:00Z',
    utrNumber: 'HDFCN26309812411',
  },
  {
    id: 'req_012',
    requestNumber: 'REQ-2026-0869',
    title: 'Executive Legal Counsel Retainer Fee Q4',
    amount: 280000,
    requesterName: 'Sneha Kulkarni',
    requesterEmail: 'sneha.kulkarni@mvholdings.com',
    companyName: 'MV Holdings Private Limited',
    departmentName: 'Finance & Accounts',
    vendorName: 'Shardul Amarchand Mangaldas Law',
    vendorCode: 'VND-012',
    category: 'CONSULTING',
    status: 'PAYMENT_PENDING',
    priority: 'NORMAL',
    isThresholdException: true,
    approvalDays: 1.9,
    submittedAt: '2026-10-28T14:30:00Z',
    approvedAt: '2026-10-30T16:00:00Z',
  },
];

// Department Aggregate Report Data
const DEPARTMENT_SUMMARY_DATA = [
  {
    name: 'Procurement',
    head: 'Manoj Tiwari',
    company: 'MV Infrastructure',
    count: 24,
    allocatedBudget: 50000000,
    actualSpend: 34500000,
    utilization: 69,
  },
  {
    name: 'IT & Infrastructure',
    head: 'Amit Patel',
    company: 'MV Holdings',
    count: 42,
    allocatedBudget: 35000000,
    actualSpend: 28900000,
    utilization: 82.5,
  },
  {
    name: 'Supply Chain & Logistics',
    head: 'Sanjay Verma',
    company: 'MV Infrastructure',
    count: 36,
    allocatedBudget: 30000000,
    actualSpend: 24200000,
    utilization: 80.6,
  },
  {
    name: 'Finance & Accounts',
    head: 'Sneha Kulkarni',
    company: 'MV Holdings',
    count: 18,
    allocatedBudget: 15000000,
    actualSpend: 9800000,
    utilization: 65.3,
  },
  {
    name: 'Facilities & Admin',
    head: 'Ramesh Gupta',
    company: 'MV Holdings',
    count: 29,
    allocatedBudget: 20000000,
    actualSpend: 16400000,
    utilization: 82.0,
  },
  {
    name: 'Marketing & PR',
    head: 'Kavita Nair',
    company: 'MV Technologies',
    count: 15,
    allocatedBudget: 12000000,
    actualSpend: 7500000,
    utilization: 62.5,
  },
];

// Vendor Spend Aggregates
const VENDOR_SUMMARY_DATA = [
  {
    name: 'Tata Steel Industrial Supply',
    code: 'VND-004',
    gstin: '27AAACT2727Q1ZW',
    category: 'RAW_MATERIALS',
    invoicesCount: 14,
    totalDisbursed: 28400000,
    pendingBalance: 1420000,
    avgTermsDays: 30,
    accountMasked: 'XXXX-XXXX-9912',
  },
  {
    name: 'NextGen Logistics LLP',
    code: 'VND-002',
    gstin: '27AABCN8812F1Z9',
    category: 'LOGISTICS',
    invoicesCount: 22,
    totalDisbursed: 14200000,
    pendingBalance: 320000,
    avgTermsDays: 15,
    accountMasked: 'XXXX-XXXX-4412',
  },
  {
    name: 'Apex Cloud Solutions Pvt Ltd',
    code: 'VND-001',
    gstin: '27AABCA1234A1Z5',
    category: 'IT_SOFTWARE',
    invoicesCount: 9,
    totalDisbursed: 9850000,
    pendingBalance: 485000,
    avgTermsDays: 45,
    accountMasked: 'XXXX-XXXX-8821',
  },
  {
    name: 'DLF CyberCity Developers',
    code: 'VND-011',
    gstin: '06AAACD1122C1Z8',
    category: 'RENT',
    invoicesCount: 11,
    totalDisbursed: 6050000,
    pendingBalance: 0,
    avgTermsDays: 30,
    accountMasked: 'XXXX-XXXX-1002',
  },
  {
    name: 'Dell Global Business Solutions',
    code: 'VND-005',
    gstin: '29AAACD5544B1Z3',
    category: 'IT_SOFTWARE',
    invoicesCount: 6,
    totalDisbursed: 4900000,
    pendingBalance: 650000,
    avgTermsDays: 30,
    accountMasked: 'XXXX-XXXX-5521',
  },
  {
    name: 'Deloitte & Touche Advisors LLP',
    code: 'VND-003',
    gstin: '27AAACD9988D1Z2',
    category: 'CONSULTING',
    invoicesCount: 8,
    totalDisbursed: 3850000,
    pendingBalance: 175000,
    avgTermsDays: 45,
    accountMasked: 'XXXX-XXXX-7701',
  },
];

// Monthly Trend Spend Data
const MONTHLY_TREND_DATA = [
  { month: 'Jun 2026', requests: 48, totalSpend: 11200000, approved: 10500000, disbursed: 9800000, rejectionRate: 4.2 },
  { month: 'Jul 2026', requests: 54, totalSpend: 13400000, approved: 12800000, disbursed: 12100000, rejectionRate: 3.7 },
  { month: 'Aug 2026', requests: 62, totalSpend: 15900000, approved: 14800000, disbursed: 14200000, rejectionRate: 5.1 },
  { month: 'Sep 2026', requests: 59, totalSpend: 14100000, approved: 13600000, disbursed: 13000000, rejectionRate: 2.8 },
  { month: 'Oct 2026', requests: 71, totalSpend: 18200000, approved: 17100000, disbursed: 16500000, rejectionRate: 3.2 },
  { month: 'Nov 2026', requests: 68, totalSpend: 19800000, approved: 18400000, disbursed: 17600000, rejectionRate: 4.0 },
];

// Category Spend Aggregate
const CATEGORY_CHART_DATA = [
  { name: 'Raw Materials', value: 34500000, color: '#1b365d' },
  { name: 'IT & Software', value: 28900000, color: '#0284c7' },
  { name: 'Supply Logistics', value: 24200000, color: '#059669' },
  { name: 'Rent & Lease', value: 16400000, color: '#d97706' },
  { name: 'Consulting & Legal', value: 9800000, color: '#7c3aed' },
  { name: 'Marketing & Other', value: 7500000, color: '#ec4899' },
];

// Approval Turnaround Aggregate Data
const APPROVAL_TIME_DATA = [
  { department: 'IT & Infra', avgHours: 28, slaLimit: 48, compliance: 96 },
  { department: 'Procurement', avgHours: 36, slaLimit: 48, compliance: 91 },
  { department: 'Supply Chain', avgHours: 42, slaLimit: 48, compliance: 88 },
  { department: 'Finance', avgHours: 18, slaLimit: 24, compliance: 98 },
  { department: 'Facilities', avgHours: 24, slaLimit: 48, compliance: 95 },
  { department: 'Marketing', avgHours: 52, slaLimit: 48, compliance: 78 },
];

const getStatusBadgeVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'PAID':
      return 'success';
    case 'REJECTED':
      return 'rejected';
    case 'PAYMENT_PENDING':
    case 'PAYMENT_SCHEDULED':
      return 'info';
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return 'pending';
    case 'CANCELLED':
      return 'draft';
    default:
      return 'default';
  }
};

export const ReportsPage: React.FC = () => {
  // Active Report Type selection
  const [selectedReport, setSelectedReport] = useState<ReportType>('MONTHLY');

  // Filters State
  const [datePreset, setDatePreset] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('2026-11-01');
  const [endDate, setEndDate] = useState<string>('2026-11-30');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Table Sort State
  const [sortField, setSortField] = useState<string>('amount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Active Report metadata
  const currentReportOption = useMemo(() => {
    return (
      REPORT_OPTIONS.find((r) => r.id === selectedReport) || REPORT_OPTIONS[0]
    );
  }, [selectedReport]);

  // Handle Preset Date Change
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === 'TODAY') {
      const d = today.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'THIS_MONTH') {
      setStartDate('2026-11-01');
      setEndDate('2026-11-30');
    } else if (preset === 'LAST_MONTH') {
      setStartDate('2026-10-01');
      setEndDate('2026-10-31');
    } else if (preset === 'THIS_QUARTER') {
      setStartDate('2026-10-01');
      setEndDate('2026-12-31');
    } else if (preset === 'ALL_TIME') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setDatePreset('THIS_MONTH');
    setStartDate('2026-11-01');
    setEndDate('2026-11-30');
    setCompanyFilter('ALL');
    setDepartmentFilter('ALL');
    setVendorFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
    toast.success('Report filters reset to default.');
  };

  // Filtered Requisitions based on current report and filter controls
  const filteredRequisitions = useMemo(() => {
    return SEED_REQUISITIONS.filter((item) => {
      // 1. Report Type specific constraints
      if (selectedReport === 'PENDING_APPROVAL') {
        if (item.status !== 'SUBMITTED' && item.status !== 'UNDER_REVIEW') return false;
      } else if (selectedReport === 'APPROVED') {
        if (item.status !== 'APPROVED') return false;
      } else if (selectedReport === 'REJECTED') {
        if (item.status !== 'REJECTED') return false;
      } else if (selectedReport === 'PAYMENT_PENDING') {
        if (item.status !== 'PAYMENT_PENDING') return false;
      } else if (selectedReport === 'COMPLETED') {
        if (item.status !== 'PAID') return false;
      } else if (selectedReport === 'CANCELLED') {
        if (item.status !== 'CANCELLED') return false;
      } else if (selectedReport === 'THRESHOLD_EXCEPTIONS') {
        if (!item.isThresholdException) return false;
      }

      // 2. Global Filter Controls
      if (companyFilter !== 'ALL' && !item.companyName.includes(companyFilter)) {
        return false;
      }

      if (departmentFilter !== 'ALL' && item.departmentName !== departmentFilter) {
        return false;
      }

      if (vendorFilter !== 'ALL' && item.vendorName !== vendorFilter) {
        return false;
      }

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          item.requestNumber.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query) ||
          item.requesterName.toLowerCase().includes(query) ||
          item.vendorName.toLowerCase().includes(query) ||
          item.departmentName.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // Date Range
      if (startDate) {
        const itemDate = item.submittedAt.slice(0, 10);
        if (itemDate < startDate) return false;
      }
      if (endDate) {
        const itemDate = item.submittedAt.slice(0, 10);
        if (itemDate > endDate) return false;
      }

      return true;
    });
  }, [
    selectedReport,
    companyFilter,
    departmentFilter,
    vendorFilter,
    categoryFilter,
    statusFilter,
    searchTerm,
    startDate,
    endDate,
  ]);

  // Sorted Requisitions
  const sortedRequisitions = useMemo(() => {
    return [...filteredRequisitions].sort((a, b) => {
      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];

      if (sortField === 'amount') {
        aVal = a.amount;
        bVal = b.amount;
      } else if (sortField === 'submittedAt') {
        aVal = new Date(a.submittedAt).getTime();
        bVal = new Date(b.submittedAt).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRequisitions, sortField, sortDirection]);

  // Paginated Requisitions
  const paginatedRequisitions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRequisitions.slice(startIndex, startIndex + pageSize);
  }, [sortedRequisitions, currentPage, pageSize]);

  // Calculated Summary KPI Metrics
  const summaryMetrics = useMemo(() => {
    const totalRequests = filteredRequisitions.length;
    const totalAmount = filteredRequisitions.reduce((acc, curr) => acc + curr.amount, 0);
    const avgTurnaround =
      totalRequests > 0
        ? (filteredRequisitions.reduce((acc, curr) => acc + curr.approvalDays, 0) / totalRequests).toFixed(1)
        : '0.0';
    const exceptionCount = filteredRequisitions.filter((r) => r.isThresholdException).length;

    return {
      totalRequests,
      totalAmount,
      avgTurnaround,
      exceptionCount,
    };
  }, [filteredRequisitions]);

  // Toggle Table Sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = '';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `MV_${selectedReport}_Report_${dateStamp}.csv`;

    if (selectedReport === 'DEPARTMENT_WISE') {
      const headers = ['Department Name', 'Company', 'Head', 'Requisitions', 'Allocated Budget', 'Actual Spend', 'Utilization %'];
      const rows = DEPARTMENT_SUMMARY_DATA.map((d) => [
        `"${d.name}"`,
        `"${d.company}"`,
        `"${d.head}"`,
        d.count,
        d.allocatedBudget,
        d.actualSpend,
        `${d.utilization}%`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (selectedReport === 'VENDOR_WISE') {
      const headers = ['Vendor Name', 'Code', 'GSTIN', 'Category', 'Paid Invoices', 'Total Disbursed', 'Pending Balance', 'Avg Terms (Days)'];
      const rows = VENDOR_SUMMARY_DATA.map((v) => [
        `"${v.name}"`,
        v.code,
        v.gstin,
        v.category,
        v.invoicesCount,
        v.totalDisbursed,
        v.pendingBalance,
        v.avgTermsDays,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (selectedReport === 'MONTHLY') {
      const headers = ['Month', 'Requisitions', 'Total Value', 'Approved Value', 'Disbursed Value', 'Rejection Rate %'];
      const rows = MONTHLY_TREND_DATA.map((m) => [
        `"${m.month}"`,
        m.requests,
        m.totalSpend,
        m.approved,
        m.disbursed,
        `${m.rejectionRate}%`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else {
      // Requisition list
      const headers = ['Requisition ID', 'Title', 'Amount (INR)', 'Requester', 'Department', 'Company', 'Vendor', 'Status', 'Priority', 'Turnaround Days', 'Date'];
      const rows = sortedRequisitions.map((r) => [
        r.requestNumber,
        `"${r.title.replace(/"/g, '""')}"`,
        r.amount,
        `"${r.requesterName}"`,
        `"${r.departmentName}"`,
        `"${r.companyName}"`,
        `"${r.vendorName}"`,
        r.status,
        r.priority,
        r.approvalDays,
        r.submittedAt.slice(0, 10),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${currentReportOption.label} to CSV successfully.`);
  };

  // Export to Excel (.xlsx simulation via tab-delimited / XML)
  const handleExportExcel = () => {
    toast.success(`Generating formatted Excel workbook for ${currentReportOption.label}...`);
    handleExportCSV();
  };

  // Export to PDF
  const handleExportPDF = () => {
    toast.success(`Preparing printable PDF report for ${currentReportOption.label}...`);
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Financial Reports & Intelligence
            </h1>
            <Badge variant="primary" size="sm">
              Fiscal Year 2026-27
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enterprise analytics, multi-entity expenditure aggregation, SLA turnaround compliance, and vendor concentration.
          </p>
        </div>

        {/* Global Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="w-3.5 h-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
            PDF
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            Excel (.xlsx)
          </Button>

          <Button variant="primary" size="sm" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            CSV Export
          </Button>
        </div>
      </div>

      {/* Report Type Selector: Categorized Selector Grid */}
      <div className="app-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-dark-border pb-3">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-navy-600 dark:text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Select Report Perspective ({REPORT_OPTIONS.length} Available)
            </h2>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400">
            Active: <strong className="text-navy-700 dark:text-cyan-300">{currentReportOption.label}</strong>
          </span>
        </div>

        {/* Categorized Dropdown / Pill selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {REPORT_OPTIONS.map((opt) => {
            const isSelected = selectedReport === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedReport(opt.id);
                  setCurrentPage(1);
                }}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-navy-50 dark:bg-navy-950/60 border-navy-600 dark:border-cyan-500 ring-1 ring-navy-600 dark:ring-cyan-500 text-navy-900 dark:text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-dark-border text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {opt.category}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-navy-600 dark:text-cyan-400" />
                  )}
                </div>
                <span className="text-xs font-semibold leading-tight line-clamp-1">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Requisitions */}
        <div className="app-card p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Requisitions in Scope
            </span>
            <div className="p-2 rounded-lg bg-navy-50 dark:bg-navy-900/50 text-navy-700 dark:text-cyan-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summaryMetrics.totalRequests}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center">
            <TrendingUp className="w-3 h-3 text-emerald-500 mr-1" />
            Matching active filters
          </p>
        </div>

        {/* Card 2: Total Value */}
        <div className="app-card p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Aggregated Spend Value
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatCurrency(summaryMetrics.totalAmount)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            INR Net Authorized & Pending
          </p>
        </div>

        {/* Card 3: SLA Turnaround Time */}
        <div className="app-card p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Avg Turnaround Time
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summaryMetrics.avgTurnaround} <span className="text-sm font-normal text-slate-500">days</span>
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            94.2% within 48h SLA
          </p>
        </div>

        {/* Card 4: Threshold Exceptions */}
        <div className="app-card p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Threshold Exceptions (&gt; ₹1L)
            </span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summaryMetrics.exceptionCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Required Multi-Tier L2 Approval
          </p>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="app-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Report Filter Matrix
            </h3>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            {['TODAY', 'THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER', 'ALL_TIME'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleDatePresetChange(preset)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  datePreset === preset
                    ? 'bg-navy-600 text-white dark:bg-cyan-500 dark:text-navy-950 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {preset.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Term */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Requisition #, vendor, title, or requester..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white"
              />
            </div>
          </div>

          {/* Company Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Company
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white"
            >
              <option value="ALL">All Companies</option>
              <option value="MV Holdings">MV Holdings Pvt Ltd</option>
              <option value="MV Infrastructure">MV Infrastructure Ltd</option>
              <option value="MV Technologies">MV Technologies & Digital</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white"
            >
              <option value="ALL">All Departments</option>
              <option value="Procurement">Procurement</option>
              <option value="IT & Infrastructure">IT & Infrastructure</option>
              <option value="Supply Chain & Logistics">Supply Chain & Logistics</option>
              <option value="Finance & Accounts">Finance & Accounts</option>
              <option value="Facilities & Administration">Facilities & Administration</option>
              <option value="Marketing & PR">Marketing & PR</option>
              <option value="Human Resources">Human Resources</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-dark-border rounded-lg text-xs dark:text-white"
            />
          </div>
        </div>

        {/* Reset Filter Action */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-dark-border">
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {/* Visual Analytics Charts Section (Rendered based on selected report perspective) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Progression or Department Spend */}
        <div className="app-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {selectedReport === 'DEPARTMENT_WISE'
                  ? 'Departmental Budget vs. Actual Expenditure (₹)'
                  : 'Monthly Expenditure & Disbursement Run-Rate (₹)'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Aggregated cross-entity expenditure in Lakhs (INR)
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-navy-600 dark:text-cyan-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {selectedReport === 'DEPARTMENT_WISE' ? (
                <BarChart data={DEPARTMENT_SUMMARY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `₹${v / 1000000}M`} />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Value']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                  />
                  <Bar dataKey="actualSpend" name="Actual Spend" fill="#1b365d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="allocatedBudget" name="Allocated Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={MONTHLY_TREND_DATA}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1b365d" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#1b365d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 100000}L`} />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Spend']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="totalSpend" stroke="#1b365d" fillOpacity={1} fill="url(#spendGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="disbursed" stroke="#059669" fillOpacity={0} strokeWidth={2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Distribution Donut or Approval SLA */}
        <div className="app-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {selectedReport === 'APPROVAL_TIME'
                  ? 'Turnaround Efficiency & 48h SLA Adherence'
                  : 'Expense Classification Concentration (%)'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedReport === 'APPROVAL_TIME'
                  ? 'Average processing hours per operating division'
                  : 'Proportional spend by cost-center categories'}
              </p>
            </div>
            <PieChartIcon className="w-4 h-4 text-navy-600 dark:text-cyan-400" />
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              {selectedReport === 'APPROVAL_TIME' ? (
                <BarChart data={APPROVAL_TIME_DATA} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} unit="h" />
                  <YAxis dataKey="department" type="category" stroke="#94a3b8" fontSize={10} width={90} />
                  <Tooltip
                    formatter={(val: number) => [`${val} Hours`, 'Avg Turnaround']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                  />
                  <Bar dataKey="avgHours" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={CATEGORY_CHART_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {CATEGORY_CHART_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Volume']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Report Data Table */}
      <div className="app-card overflow-hidden">
        {/* Table Title and Pagination Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-dark-border flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {currentReportOption.label} Data Table
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentReportOption.description}
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-dark-border rounded text-xs dark:text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Dynamic Table Presentation */}
        {selectedReport === 'DEPARTMENT_WISE' ? (
          /* Department Report View */
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Department Name</TableHeaderCell>
                  <TableHeaderCell>Operating Entity</TableHeaderCell>
                  <TableHeaderCell>Department Head</TableHeaderCell>
                  <TableHeaderCell className="text-center">Active Requests</TableHeaderCell>
                  <TableHeaderCell className="text-right">Allocated Budget</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actual Spend</TableHeaderCell>
                  <TableHeaderCell>Budget Utilization</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DEPARTMENT_SUMMARY_DATA.map((dept) => (
                  <TableRow key={dept.name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <TableCell className="font-semibold text-xs text-slate-900 dark:text-white">
                      {dept.name}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                      {dept.company}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                      {dept.head}
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono font-medium">
                      {dept.count}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                      {formatCurrency(dept.allocatedBudget, false)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-navy-800 dark:text-cyan-400">
                      {formatCurrency(dept.actualSpend, false)}
                    </TableCell>
                    <TableCell className="w-48">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span>{dept.utilization}%</span>
                          <span className={dept.utilization > 80 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                            {dept.utilization > 80 ? 'High' : 'On Track'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              dept.utilization > 80 ? 'bg-amber-500' : 'bg-navy-600 dark:bg-cyan-500'
                            }`}
                            style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : selectedReport === 'VENDOR_WISE' ? (
          /* Vendor Report View */
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Vendor Code & Name</TableHeaderCell>
                  <TableHeaderCell>GSTIN Number</TableHeaderCell>
                  <TableHeaderCell>Primary Category</TableHeaderCell>
                  <TableHeaderCell className="text-center">Paid Invoices</TableHeaderCell>
                  <TableHeaderCell className="text-right">Total Disbursed</TableHeaderCell>
                  <TableHeaderCell className="text-right">Pending Balance</TableHeaderCell>
                  <TableHeaderCell>Payment Terms</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {VENDOR_SUMMARY_DATA.map((vnd) => (
                  <TableRow key={vnd.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <TableCell>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {vnd.name}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {vnd.code} • Bank: {vnd.accountMasked}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {vnd.gstin}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" size="sm">
                        {vnd.category.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {vnd.invoicesCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(vnd.totalDisbursed, false)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {formatCurrency(vnd.pendingBalance, false)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                      Net {vnd.avgTermsDays} Days
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : selectedReport === 'MONTHLY' ? (
          /* Monthly Trend Report View */
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Reporting Month</TableHeaderCell>
                  <TableHeaderCell className="text-center">Total Requisitions</TableHeaderCell>
                  <TableHeaderCell className="text-right">Total Invoiced Spend</TableHeaderCell>
                  <TableHeaderCell className="text-right">Authorized Value</TableHeaderCell>
                  <TableHeaderCell className="text-right">Disbursed Volume</TableHeaderCell>
                  <TableHeaderCell className="text-center">Rejection Rate</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {MONTHLY_TREND_DATA.map((m) => (
                  <TableRow key={m.month} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <TableCell className="text-xs font-semibold text-slate-900 dark:text-white font-mono">
                      {m.month}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {m.requests}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-800 dark:text-slate-200">
                      {formatCurrency(m.totalSpend, false)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-navy-700 dark:text-cyan-400 font-semibold">
                      {formatCurrency(m.approved, false)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatCurrency(m.disbursed, false)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-slate-600 dark:text-slate-300">
                      {m.rejectionRate}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* Standard Requisition List for Status, Turnaround & Threshold Reports */
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>
                    <button
                      type="button"
                      onClick={() => handleSort('requestNumber')}
                      className="flex items-center space-x-1"
                    >
                      <span>Requisition #</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <button
                      type="button"
                      onClick={() => handleSort('submittedAt')}
                      className="flex items-center space-x-1"
                    >
                      <span>Date</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>Requester & Dept</TableHeaderCell>
                  <TableHeaderCell>Beneficiary Vendor</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('amount')}
                      className="flex items-center justify-end space-x-1 w-full"
                    >
                      <span>Amount (₹)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-center">SLA Days</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRequisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileText className="w-8 h-8 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          No requisitions found matching current report criteria.
                        </p>
                        <Button variant="outline" size="sm" onClick={handleResetFilters}>
                          Reset Filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRequisitions.map((req) => {
                    const statusVariant = getStatusBadgeVariant(req.status);

                    return (
                      <TableRow key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        {/* Requisition # */}
                        <TableCell>
                          <div>
                            <span className="font-mono text-xs font-semibold text-navy-800 dark:text-cyan-400">
                              {req.requestNumber}
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-xs" title={req.title}>
                              {req.title}
                            </p>
                          </div>
                        </TableCell>

                        {/* Date */}
                        <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(req.submittedAt)}
                        </TableCell>

                        {/* Requester & Dept */}
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Avatar name={req.requesterName} size="sm" className="w-6 h-6 text-[10px]" />
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                                {req.requesterName}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {req.departmentName}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Beneficiary Vendor */}
                        <TableCell>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {req.vendorName}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400">
                            {req.vendorCode}
                          </span>
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          <Badge variant="default" size="sm">
                            {req.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-right">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {formatCurrency(req.amount)}
                          </span>
                          {req.isThresholdException && (
                            <span className="block text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                              Threshold &gt; ₹1L
                            </span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={statusVariant} size="sm" dot>
                            {req.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>

                        {/* SLA Days */}
                        <TableCell className="text-center font-mono text-xs">
                          <span
                            className={
                              req.approvalDays > 2
                                ? 'text-rose-600 font-semibold'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {req.approvalDays}d
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Standard Requisition Pagination */}
        {sortedRequisitions.length > 0 && selectedReport !== 'DEPARTMENT_WISE' && selectedReport !== 'VENDOR_WISE' && selectedReport !== 'MONTHLY' && (
          <div className="p-4 border-t border-slate-100 dark:border-dark-border">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(sortedRequisitions.length / pageSize)}
              onPageChange={(page) => setCurrentPage(page)}
              totalItems={sortedRequisitions.length}
              pageSize={pageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
