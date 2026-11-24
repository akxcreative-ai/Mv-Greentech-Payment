import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  SlidersHorizontal,
  Download,
  CheckSquare,
  XSquare,
  RefreshCw,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Building2,
  Users,
  CreditCard,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAllCompanies } from '@/hooks/useCompanies';
import { useDepartmentsByCompany } from '@/hooks/useDepartments';
import { useVendors } from '@/hooks/useVendors';
import { useApproveRequest, useRejectRequest } from '@/hooks/useApprovals';
import {
  RequestStatus,
  Priority,
  ExpenseCategory,
  PaymentMode,
  Role,
  PaymentRequest,
} from '@/types';
import {
  formatCurrency,
  formatDate,
  getPriorityColor,
  getExpenseCategoryLabel,
} from '@/utils/format';
import {
  Button,
  SearchInput,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  StatusBadge,
  EmptyState,
  Select,
  Input,
  StatsCard,
  ConfirmDialog,
  Modal,
  Textarea,
} from '@/components/ui';
import toast from 'react-hot-toast';

export const PaymentRequestsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
  const isApprover =
    isAdmin ||
    user?.role === Role.APPROVER ||
    user?.role === Role.MANAGEMENT ||
    user?.role === Role.DIRECTOR;

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedVendor, setSelectedVendor] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // External Reference Data
  const { data: companies = [] } = useAllCompanies();
  const { data: departments = [] } = useDepartmentsByCompany(
    selectedCompany !== 'ALL' ? selectedCompany : '',
    { enabled: selectedCompany !== 'ALL' }
  );
  const { data: vendorsData } = useVendors({ limit: 100 });
  const vendors = vendorsData?.data || [];

  // Mutations for bulk operations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();

  // Build filter object for query
  const queryFilters = useMemo(() => {
    return {
      search: search.trim() || undefined,
      companyId: selectedCompany !== 'ALL' ? selectedCompany : undefined,
      departmentId: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
      vendorId: selectedVendor !== 'ALL' ? selectedVendor : undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      expenseCategory: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      paymentMode: selectedPaymentMode !== 'ALL' ? selectedPaymentMode : undefined,
      priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
  }, [
    search,
    selectedCompany,
    selectedDepartment,
    selectedVendor,
    selectedStatus,
    selectedCategory,
    selectedPaymentMode,
    selectedPriority,
    minAmount,
    maxAmount,
    startDate,
    endDate,
  ]);

  const {
    data: requestsData,
    isLoading,
    isFetching,
    refetch,
  } = usePaymentRequests(queryFilters, {
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  const requests: PaymentRequest[] = requestsData?.data || [];
  const totalCount = requestsData?.total ?? requests.length;
  const totalPages = requestsData?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

  // Sort toggle handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // KPI Calculations across current visible or fetched set
  const kpiStats = useMemo(() => {
    let totalAmt = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let paidCount = 0;

    requests.forEach((req) => {
      const amt = Number(req.totalAmount ?? req.amount ?? 0);
      totalAmt += amt;
      const st = String(req.status);
      if (
        st === RequestStatus.UNDER_REVIEW ||
        st === RequestStatus.SUBMITTED ||
        st === 'PENDING_APPROVAL' ||
        st === RequestStatus.CLARIFICATION_REQUESTED
      ) {
        pendingCount++;
      } else if (st === RequestStatus.APPROVED || st === RequestStatus.PAYMENT_SCHEDULED) {
        approvedCount++;
      } else if (st === RequestStatus.PAID) {
        paidCount++;
      }
    });

    return {
      totalCount,
      totalAmount: totalAmt,
      pendingCount,
      approvedCount,
      paidCount,
    };
  }, [requests, totalCount]);

  // Bulk Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(requests.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllSelected = requests.length > 0 && selectedIds.length === requests.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < requests.length;

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCompany('ALL');
    setSelectedDepartment('ALL');
    setSelectedVendor('ALL');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setSelectedPaymentMode('ALL');
    setSelectedPriority('ALL');
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasActiveFilters =
    search !== '' ||
    selectedCompany !== 'ALL' ||
    selectedDepartment !== 'ALL' ||
    selectedVendor !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedPaymentMode !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    minAmount !== '' ||
    maxAmount !== '' ||
    startDate !== '' ||
    endDate !== '';

  // Export to CSV Function
  const handleExportCSV = (exportSelectedOnly = false) => {
    const listToExport = exportSelectedOnly
      ? requests.filter((r) => selectedIds.includes(r.id))
      : requests;

    if (listToExport.length === 0) {
      toast.error('No requests available to export');
      return;
    }

    const headers = [
      'Request Number',
      'Date Created',
      'Requester',
      'Company',
      'Department',
      'Vendor Name',
      'Vendor Code',
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Expense Category',
      'Payment Mode',
      'Base Amount (INR)',
      'GST Amount (INR)',
      'Total Amount (INR)',
      'Status',
      'Priority',
      'Remarks',
    ];

    const rows = listToExport.map((req) => [
      `"${req.requestNumber || req.id}"`,
      `"${formatDate(req.createdAt)}"`,
      `"${req.requester?.fullName || (req as any).requester_name || ''}"`,
      `"${req.company?.name || (req as any).company_name || ''}"`,
      `"${req.department?.name || (req as any).department_name || ''}"`,
      `"${req.vendor?.name || (req as any).vendor_name || ''}"`,
      `"${req.vendor?.vendorCode || ''}"`,
      `"${req.invoiceNumber || ''}"`,
      `"${formatDate(req.invoiceDate)}"`,
      `"${formatDate(req.dueDate)}"`,
      `"${getExpenseCategoryLabel(req.expenseCategory)}"`,
      `"${req.paymentMode || ''}"`,
      `"${req.amount || 0}"`,
      `"${req.gstAmount || 0}"`,
      `"${req.totalAmount ?? req.amount ?? 0}"`,
      `"${req.status || ''}"`,
      `"${req.priority || ''}"`,
      `"${(req.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Payment_Requests_${formatDate(new Date(), 'yyyyMMdd_HHmm')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${listToExport.length} requests successfully`);
  };

  // Bulk Approve Execution
  const executeBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    let successCount = 0;

    for (const reqId of selectedIds) {
      try {
        await approveMutation.mutateAsync({
          requestId: reqId,
          comment: 'Bulk approved via Administrator Management Console',
        });
        successCount++;
      } catch {
        // Individual item failure logged
      }
    }

    setIsBulkProcessing(false);
    setShowBulkApproveModal(false);
    setSelectedIds([]);
    toast.success(`Bulk approved ${successCount} of ${selectedIds.length} requisitions`);
    refetch();
  };

  // Bulk Reject Execution
  const executeBulkReject = async () => {
    if (selectedIds.length === 0 || !bulkRejectReason.trim()) return;
    setIsBulkProcessing(true);
    let successCount = 0;

    for (const reqId of selectedIds) {
      try {
        await rejectMutation.mutateAsync({
          requestId: reqId,
          reason: bulkRejectReason.trim(),
        });
        successCount++;
      } catch {
        // Individual item failure logged
      }
    }

    setIsBulkProcessing(false);
    setShowBulkRejectModal(false);
    setBulkRejectReason('');
    setSelectedIds([]);
    toast.success(`Bulk rejected ${successCount} of ${selectedIds.length} requisitions`);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            All Payment Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise overview of payment requisitions, approvals, and disbursement statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            onClick={() => handleExportCSV(false)}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export All (CSV)
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/payment-requests/new')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Request
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Requests"
          value={kpiStats.totalCount.toString()}
          subtitle="System wide requisitions"
          icon={<FileText className="w-5 h-5" />}
          color="primary"
        />
        <StatsCard
          title="Total Volume"
          value={formatCurrency(kpiStats.totalAmount, false)}
          subtitle="Current requisition batch"
          icon={<DollarSign className="w-5 h-5" />}
          color="purple"
        />
        <StatsCard
          title="Pending Approval"
          value={kpiStats.pendingCount.toString()}
          subtitle="Requires reviewer sign-off"
          icon={<Clock className="w-5 h-5" />}
          color="warning"
        />
        <StatsCard
          title="Approved"
          value={kpiStats.approvedCount.toString()}
          subtitle="Cleared for disbursement"
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="info"
        />
        <StatsCard
          title="Paid & Completed"
          value={kpiStats.paidCount.toString()}
          subtitle="Successfully disbursed"
          icon={<CreditCard className="w-5 h-5" />}
          color="success"
        />
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200 dark:border-dark-border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg">
            <SearchInput
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search by Request #, vendor, invoice #, purpose..."
              onClear={() => {
                setSearch('');
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters((prev) => !prev)}
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            >
              Advanced Filters
              {hasActiveFilters && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-navy-600 text-white dark:bg-cyan-500 dark:text-navy-950 rounded-full text-[10px] font-bold">
                  Active
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Extended Filter Controls */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 dark:border-dark-border/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Company Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Company
              </label>
              <Select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setSelectedDepartment('ALL');
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Department
              </label>
              <Select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setPage(1);
                }}
                disabled={selectedCompany === 'ALL'}
                className="w-full text-xs"
              >
                <option value="ALL">
                  {selectedCompany === 'ALL' ? 'Select Company First' : 'All Departments'}
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </Select>
            </div>

            {/* Vendor Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Vendor
              </label>
              <Select
                value={selectedVendor}
                onChange={(e) => {
                  setSelectedVendor(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendorCode})
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Status
              </label>
              <Select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Statuses</option>
                {Object.values(RequestStatus).map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>

            {/* Expense Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Category
              </label>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Categories</option>
                {Array.from(new Set(Object.values(ExpenseCategory))).map((c) => (
                  <option key={c} value={c}>
                    {getExpenseCategoryLabel(c)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Payment Mode
              </label>
              <Select
                value={selectedPaymentMode}
                onChange={(e) => {
                  setSelectedPaymentMode(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Modes</option>
                {Object.values(PaymentMode).map((pm) => (
                  <option key={pm} value={pm}>
                    {pm.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Priority
              </label>
              <Select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Priorities</option>
                {Object.values(Priority).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>

            {/* Min Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Min Amount (₹)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-mono"
              />
            </div>

            {/* Max Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Max Amount (₹)
              </label>
              <Input
                type="number"
                placeholder="10000000"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-mono"
              />
            </div>

            {/* Created Date From */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                From Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              />
            </div>

            {/* Created Date To */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                To Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating / Sticky Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-navy-900 text-white px-4 py-3 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{selectedIds.length} request(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV(true)}
              className="text-white border-slate-600 hover:bg-navy-800"
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export Selected
            </Button>

            {isApprover && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowBulkRejectModal(true)}
                  leftIcon={<XSquare className="w-3.5 h-3.5" />}
                >
                  Bulk Reject
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => setShowBulkApproveModal(true)}
                  leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
                >
                  Bulk Approve
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Requests Table / Cards */}
      {isLoading ? (
        <Table isLoading skeletonRows={6} skeletonCols={9} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="No Payment Requests Found"
          description={
            hasActiveFilters
              ? 'No payment requisitions matched your applied filter criteria. Try resetting or broadening your search.'
              : 'There are currently no payment requisitions recorded in the system.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear All Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/payment-requests/new')}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create First Request
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableRow>
                  {/* Bulk Select Checkbox */}
                  <TableHeaderCell className="w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-navy-800 focus:ring-navy-600"
                    />
                  </TableHeaderCell>

                  {/* Sortable Column: Request # */}
                  <TableHeaderCell
                    sortable
                    sortDirection={sortBy === 'requestNumber' ? sortOrder : null}
                    onSort={() => handleSort('requestNumber')}
                  >
                    Request #
                  </TableHeaderCell>

                  <TableHeaderCell>Requester & Entity</TableHeaderCell>
                  <TableHeaderCell>Vendor</TableHeaderCell>

                  {/* Sortable Column: Amount */}
                  <TableHeaderCell
                    className="text-right"
                    sortable
                    sortDirection={sortBy === 'amount' ? sortOrder : null}
                    onSort={() => handleSort('amount')}
                  >
                    Amount (₹)
                  </TableHeaderCell>

                  {/* Sortable Column: Priority */}
                  <TableHeaderCell
                    sortable
                    sortDirection={sortBy === 'priority' ? sortOrder : null}
                    onSort={() => handleSort('priority')}
                  >
                    Priority
                  </TableHeaderCell>

                  {/* Sortable Column: Status */}
                  <TableHeaderCell
                    sortable
                    sortDirection={sortBy === 'status' ? sortOrder : null}
                    onSort={() => handleSort('status')}
                  >
                    Status
                  </TableHeaderCell>

                  {/* Sortable Column: Due Date */}
                  <TableHeaderCell
                    sortable
                    sortDirection={sortBy === 'dueDate' ? sortOrder : null}
                    onSort={() => handleSort('dueDate')}
                  >
                    Due Date
                  </TableHeaderCell>

                  {/* Sortable Column: Created Date */}
                  <TableHeaderCell
                    sortable
                    sortDirection={sortBy === 'createdAt' ? sortOrder : null}
                    onSort={() => handleSort('createdAt')}
                  >
                    Date
                  </TableHeaderCell>

                  <TableHeaderCell className="text-right">Action</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((req) => {
                  const isSelected = selectedIds.includes(req.id);
                  const priorityStyle = getPriorityColor(req.priority);

                  return (
                    <TableRow key={req.id} selected={isSelected}>
                      {/* Checkbox */}
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(req.id)}
                          className="rounded border-slate-300 text-navy-800 focus:ring-navy-600"
                        />
                      </TableCell>

                      {/* Request Number */}
                      <TableCell className="font-mono">
                        <Link
                          to={`/payment-requests/${req.id}`}
                          className="text-navy-800 dark:text-cyan-400 hover:underline font-bold text-xs"
                        >
                          {req.requestNumber || req.id.slice(0, 8)}
                        </Link>
                        {req.invoiceNumber && (
                          <div className="text-[11px] text-slate-400 font-sans">
                            Inv: {req.invoiceNumber}
                          </div>
                        )}
                      </TableCell>

                      {/* Requester & Company */}
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {req.requester?.fullName || (req as any).requester_name || 'Requester'}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span>{req.company?.name || 'MV Group'}</span>
                          <span>&bull;</span>
                          <span>{req.department?.name || 'General'}</span>
                        </div>
                      </TableCell>

                      {/* Vendor */}
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {req.vendor?.name || 'Vendor N/A'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {getExpenseCategoryLabel(req.expenseCategory)}
                        </div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                        <div>{formatCurrency(req.totalAmount ?? req.amount)}</div>
                        {req.gstAmount != null && req.gstAmount > 0 && (
                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                            incl. GST {formatCurrency(req.gstAmount)}
                          </div>
                        )}
                      </TableCell>

                      {/* Priority */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityStyle.badge}`}
                        >
                          {req.priority}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={req.status} size="sm" />
                      </TableCell>

                      {/* Due Date */}
                      <TableCell className="text-xs text-slate-500 font-medium">
                        {formatDate(req.dueDate)}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(req.createdAt)}
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <Link
                          to={`/payment-requests/${req.id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-navy-800 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex"
                          title="View Requisition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {requests.map((req) => {
              const priorityStyle = getPriorityColor(req.priority);
              const isSelected = selectedIds.includes(req.id);

              return (
                <div
                  key={req.id}
                  className={`bg-white dark:bg-dark-card rounded-xl p-4 border shadow-xs space-y-3 ${
                    isSelected
                      ? 'border-navy-600 dark:border-cyan-500 ring-1 ring-navy-600'
                      : 'border-slate-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(req.id)}
                        className="rounded border-slate-300 text-navy-800 focus:ring-navy-600"
                      />
                      <div>
                        <Link
                          to={`/payment-requests/${req.id}`}
                          className="font-mono text-sm font-bold text-navy-800 dark:text-cyan-400 hover:underline"
                        >
                          {req.requestNumber || req.id.slice(0, 8)}
                        </Link>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                          {req.vendor?.name || 'Vendor N/A'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-xs py-1.5 border-y border-slate-100 dark:border-dark-border/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Requester / Dept
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {req.requester?.fullName || 'Requester'} ({req.department?.name || 'General'})
                      </span>
                      <div className="text-[11px] text-slate-400">
                        {getExpenseCategoryLabel(req.expenseCategory)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Total Amount
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {formatCurrency(req.totalAmount ?? req.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityStyle.badge}`}
                      >
                        {req.priority}
                      </span>
                      <span>Due: {formatDate(req.dueDate)}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/payment-requests/${req.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Bulk Approve Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBulkApproveModal}
        onClose={() => setShowBulkApproveModal(false)}
        onConfirm={executeBulkApprove}
        actionType="approve"
        title={`Bulk Approve ${selectedIds.length} Payment Requisitions`}
        message={`Are you sure you want to approve all ${selectedIds.length} selected payment requisitions? They will immediately proceed to disbursement processing.`}
        confirmText="Confirm Bulk Approval"
        isLoading={isBulkProcessing}
      />

      {/* Bulk Reject Modal */}
      <Modal
        isOpen={showBulkRejectModal}
        onClose={() => setShowBulkRejectModal(false)}
        title={`Bulk Reject ${selectedIds.length} Payment Requisitions`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Provide a mandatory rejection audit note applied to all {selectedIds.length} selected requisitions. Requesters will be notified.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="e.g., Bulk rejected during quarterly budget audit due to cost quota constraints."
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkRejectModal(false)}
              disabled={isBulkProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={executeBulkReject}
              isLoading={isBulkProcessing}
              disabled={!bulkRejectReason.trim()}
            >
              Confirm Bulk Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentRequestsList;
