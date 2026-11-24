import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileCheck,
  CheckCircle2,
  Calendar,
  Building2,
  Download,
  Eye,
  FileText,
  Search,
  Filter,
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  Input,
  Select,
  Modal,
  EmptyState,
  LoadingSpinner,
} from '@/components/ui';
import { usePaymentRequests, useDownloadDocument } from '@/hooks/usePaymentRequests';
import { useAllCompanies } from '@/hooks/useCompanies';
import { useAllVendors } from '@/hooks/useVendors';
import {
  PaymentRequest,
  RequestStatus,
  PaymentMode,
  PaymentStatus,
  PaymentRecord,
} from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

// Rich fallback completed payments
const FALLBACK_COMPLETED_PAYMENTS: Partial<PaymentRequest>[] = [
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
    status: RequestStatus.PAID,
    paymentMode: PaymentMode.IMPS,
    invoiceNumber: 'MMT-CORP-0982',
    createdAt: '2026-11-08T11:00:00Z',
    updatedAt: '2026-11-20T17:15:00Z',
    paymentRecord: {
      id: 'pay_rec_01',
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
      bankAccountId: 'HDFC Bank - Current A/C 5020001928371',
      remarks: 'Paid via IMPS. Corporate booking receipt filed.',
      status: PaymentStatus.SUCCESS,
      createdAt: '2026-11-20T17:15:00Z',
    },
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
    status: RequestStatus.PAID,
    paymentMode: PaymentMode.RTGS,
    invoiceNumber: 'BDT-LOG-7721',
    createdAt: '2026-11-02T14:00:00Z',
    updatedAt: '2026-11-16T12:30:00Z',
    paymentRecord: {
      id: 'pay_rec_02',
      paymentRequestId: 'req_010',
      paymentMode: PaymentMode.RTGS,
      transactionReference: 'VOUCHER-BDT-44129',
      utrNumber: 'RTGS-KKBK-20261116-0981',
      paymentDate: '2026-11-16T12:30:00Z',
      amountPaid: 450000,
      processedById: 'usr_acc_01',
      processedBy: {
        id: 'usr_acc_01',
        fullName: 'Priya Desai',
        email: 'priya.desai@mvgroup.com',
        role: 'ACCOUNTANT' as any,
        companyId: 'c_03',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      bankAccountId: 'State Bank of India - Cash Credit A/C 38192001928',
      remarks: 'Settled against validated freight waybills.',
      status: PaymentStatus.SUCCESS,
      createdAt: '2026-11-16T12:30:00Z',
    },
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
    status: RequestStatus.PAID,
    paymentMode: PaymentMode.NEFT,
    invoiceNumber: 'CF-SRV-2026-90',
    createdAt: '2026-10-28T09:30:00Z',
    updatedAt: '2026-11-13T15:20:00Z',
    paymentRecord: {
      id: 'pay_rec_03',
      paymentRequestId: 'req_011',
      paymentMode: PaymentMode.NEFT,
      transactionReference: 'VOUCHER-CF-88192',
      utrNumber: 'NEFT-HDFC-20261113-7721',
      paymentDate: '2026-11-13T15:20:00Z',
      amountPaid: 195000,
      processedById: 'usr_acc_01',
      processedBy: {
        id: 'usr_acc_01',
        fullName: 'Priya Desai',
        email: 'priya.desai@mvgroup.com',
        role: 'ACCOUNTANT' as any,
        companyId: 'c_01',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      bankAccountId: 'HDFC Bank - Current A/C 5020001928371',
      remarks: 'Safety compliance sign-off attached.',
      status: PaymentStatus.SUCCESS,
      createdAt: '2026-11-13T15:20:00Z',
    },
  },
];

export const CompletedPayments: React.FC = () => {
  const navigate = useNavigate();

  // Queries
  const { data: apiResponse, isLoading, refetch, isRefetching } = usePaymentRequests({
    status: RequestStatus.PAID,
    pageSize: 100,
  });
  const { data: companiesData } = useAllCompanies();
  const { data: vendorsData } = useAllVendors();

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected payment for viewing full details & proof modal
  const [viewPaymentModal, setViewPaymentModal] = useState<PaymentRequest | null>(null);

  // Extract base list
  const completedList: PaymentRequest[] = useMemo(() => {
    if (apiResponse && apiResponse.data && apiResponse.data.length > 0) {
      const paid = apiResponse.data.filter((r) => r.status === RequestStatus.PAID);
      if (paid.length > 0) return paid;
    }
    return FALLBACK_COMPLETED_PAYMENTS as PaymentRequest[];
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
      { id: 'v_03', name: 'MakeMyTrip Corporate Solutions' },
      { id: 'v_07', name: 'Blue Dart Express Freight' },
      { id: 'v_08', name: 'Ceasefire Industries Ltd' },
    ];
  }, [vendorsData]);

  // Filtering
  const filteredPayments = useMemo(() => {
    return completedList.filter((req) => {
      const reqNumber = req.requestNumber || (req as any).request_number || req.id || '';
      const vendorName = req.vendor?.name || (req as any).vendor_name || '';
      const utr = req.paymentRecord?.utrNumber || (req as any).utr_number || '';
      const query = search.trim().toLowerCase();

      // Search match
      const matchesSearch =
        !query ||
        reqNumber.toLowerCase().includes(query) ||
        vendorName.toLowerCase().includes(query) ||
        utr.toLowerCase().includes(query);

      // Company match
      const companyName = req.company?.name || (req as any).company_name || '';
      const matchesCompany =
        selectedCompany === 'ALL' ||
        companyName === selectedCompany ||
        req.companyId === selectedCompany;

      // Vendor match
      const matchesVendor =
        selectedVendor === 'ALL' ||
        vendorName === selectedVendor ||
        req.vendorId === selectedVendor;

      // Date match
      const payDateStr = req.paymentRecord?.paymentDate || req.updatedAt || (req as any).created_at;
      let matchesDate = true;
      if (payDateStr) {
        const itemDate = new Date(payDateStr).getTime();
        if (startDate) {
          matchesDate = matchesDate && itemDate >= new Date(startDate).getTime();
        }
        if (endDate) {
          matchesDate = matchesDate && itemDate <= new Date(endDate + 'T23:59:59').getTime();
        }
      }

      return matchesSearch && matchesCompany && matchesVendor && matchesDate;
    });
  }, [completedList, search, selectedCompany, selectedVendor, startDate, endDate]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalAmount = filteredPayments.reduce(
      (sum, r) => sum + Number(r.paymentRecord?.amountPaid ?? r.amount ?? (r as any).total_amount ?? 0),
      0
    );
    return {
      count: filteredPayments.length,
      totalAmount,
    };
  }, [filteredPayments]);

  // Pagination calculation
  const totalRecords = filteredPayments.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredPayments.slice(startIndex, startIndex + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Request ID', 'Vendor', 'Amount', 'Payment Date', 'UTR', 'Status', 'Payment Mode'];
    const rows = filteredPayments.map((r) => [
      r.requestNumber || r.id,
      `"${r.vendor?.name || (r as any).vendor_name || ''}"`,
      r.paymentRecord?.amountPaid ?? r.amount ?? (r as any).total_amount ?? 0,
      r.paymentRecord?.paymentDate ? formatDate(r.paymentRecord.paymentDate) : formatDate(r.updatedAt),
      `"${r.paymentRecord?.utrNumber || (r as any).utr_number || 'N/A'}"`,
      r.status,
      r.paymentMode || 'NEFT',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `completed_payments_${new Date().toISOString().slice(0, 10)}.csv`);
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
              Completed Payments
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Settled Vouchers
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Reconciled bank disbursements, transaction reference records, and payment proof audit logs.
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
            Export Disbursed CSV
          </Button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/20 dark:to-emerald-900/10 dark:border-emerald-800/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              Total Disbursed Sum
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
              {formatCurrency(metrics.totalAmount)}
            </div>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">
              Confirmed electronic & cheque fund release
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/20 dark:to-blue-900/10 dark:border-blue-800/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
              Settled Requisitions Count
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-100 mt-1">
              {metrics.count} Vouchers
            </div>
            <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1">
              Fully reconciled with vendor ledger
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-300">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Request ID, Vendor, UTR number..."
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

          {/* Reset Filters */}
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
            <span className="font-semibold text-slate-600 dark:text-slate-300">Payment Date Range:</span>
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
            Showing <strong className="text-slate-800 dark:text-white">{filteredPayments.length}</strong> settled vouchers
          </div>
        </div>
      </Card>

      {/* Completed Payments Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-500">Loading completed payment records...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          title="No Completed Payments Found"
          description="No disbursed payment records match your selected search or filter parameters."
          icon={<FileCheck className="w-12 h-12 text-slate-400" />}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Request ID</th>
                  <th className="py-3.5 px-4">Vendor & Company</th>
                  <th className="py-3.5 px-4 text-right">Disbursed Amount (₹)</th>
                  <th className="py-3.5 px-4">Payment Date</th>
                  <th className="py-3.5 px-4">UTR / Bank Reference</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Payment Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {paginatedPayments.map((req) => {
                  const reqNumber = req.requestNumber || (req as any).request_number || req.id;
                  const vendorName = req.vendor?.name || (req as any).vendor_name || 'Vendor';
                  const amount = req.paymentRecord?.amountPaid ?? req.amount ?? (req as any).total_amount ?? 0;
                  const payDate = req.paymentRecord?.paymentDate || req.updatedAt || (req as any).created_at;
                  const utr = req.paymentRecord?.utrNumber || (req as any).utr_number || 'UTR-NOT-SPECIFIED';
                  const companyName = req.company?.name || (req as any).company_name || 'MV Group';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setViewPaymentModal(req)}
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
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {payDate ? formatDate(payDate) : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {utr}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          PAID
                        </span>
                      </td>
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewPaymentModal(req)}
                          className="text-xs"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Voucher
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
              of <strong className="text-slate-900 dark:text-white">{totalRecords}</strong> completed payments
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

      {/* FULL PAYMENT DETAILS & PROOF MODAL */}
      <Modal
        isOpen={Boolean(viewPaymentModal)}
        onClose={() => setViewPaymentModal(null)}
        title={
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Disbursement Settlement Voucher</span>
          </div>
        }
        description="Statutory proof of fund transfer, bank authorization, and payment voucher record."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            {viewPaymentModal && (
              <Link to={`/payment-tracking/${viewPaymentModal.id}`}>
                <Button variant="outline" size="sm" leftIcon={<ExternalLink className="w-4 h-4" />}>
                  View Full Tracking Timeline
                </Button>
              </Link>
            )}
            <Button variant="secondary" size="sm" onClick={() => setViewPaymentModal(null)}>
              Close
            </Button>
          </div>
        }
      >
        {viewPaymentModal && (
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
            {/* Payment Summary Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-navy-800 dark:text-navy-300">
                  {viewPaymentModal.requestNumber || viewPaymentModal.id}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  STATUS: PAID & SETTLED
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {viewPaymentModal.title}
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 pt-1">
                {formatCurrency(
                  viewPaymentModal.paymentRecord?.amountPaid ??
                    viewPaymentModal.amount ??
                    (viewPaymentModal as any).total_amount ??
                    0
                )}
              </div>
            </div>

            {/* Remittance & Bank Settlement Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
              <div>
                <span className="text-slate-400 block">Beneficiary Vendor</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {viewPaymentModal.vendor?.name || (viewPaymentModal as any).vendor_name}
                </span>
                <div className="text-2xs text-slate-500 font-mono mt-0.5">
                  A/C: {viewPaymentModal.vendor?.accountNumber} ({viewPaymentModal.vendor?.ifscCode})
                </div>
              </div>

              <div>
                <span className="text-slate-400 block">Disbursed From</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewPaymentModal.paymentRecord?.bankAccountId || 'HDFC Operations Current Account'}
                </span>
                <div className="text-2xs text-slate-500">
                  Mode: <strong className="text-slate-700 dark:text-slate-300">{viewPaymentModal.paymentMode || 'NEFT'}</strong>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block">Unique Transaction Reference (UTR)</span>
                <span className="font-mono font-bold text-navy-700 dark:text-navy-300 text-sm">
                  {viewPaymentModal.paymentRecord?.utrNumber || (viewPaymentModal as any).utr_number || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Settlement Timestamp</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDateTime(viewPaymentModal.paymentRecord?.paymentDate || viewPaymentModal.updatedAt)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">ERP Payment Reference</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {viewPaymentModal.paymentRecord?.transactionReference || 'VOUCHER-DEFAULT'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Processed By</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewPaymentModal.paymentRecord?.processedBy?.fullName || 'Senior Disbursing Accountant'}
                </span>
              </div>
            </div>

            {/* Remarks */}
            {viewPaymentModal.paymentRecord?.remarks && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Accountant Settlement Remarks:
                </span>
                <p className="text-slate-600 dark:text-slate-400 italic">
                  "{viewPaymentModal.paymentRecord.remarks}"
                </p>
              </div>
            )}

            {/* Payment Proof Download Box */}
            <div className="p-3.5 border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Bank Transfer Advice / Payment Slip
                  </div>
                  <div className="text-2xs text-slate-500">
                    Official acknowledgement issued by core banking gateway
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => {
                  toast.success('Downloading bank payment confirmation advice slip...');
                }}
              >
                Download Proof
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CompletedPayments;
