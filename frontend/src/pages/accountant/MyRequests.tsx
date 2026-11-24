import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Filter,
  Eye,
  Edit3,
  Send,
  RefreshCw,
  FileText,
  SlidersHorizontal,
  X,
  ExternalLink,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePaymentRequests, useSubmitPaymentRequest } from '@/hooks/usePaymentRequests';
import { useVendors } from '@/hooks/useVendors';
import {
  RequestStatus,
  Priority,
  ExpenseCategory,
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
  Tabs,
  TabItem,
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
  ConfirmDialog,
} from '@/components/ui';

export const MyRequests: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Search & Filter State
  const [search, setSearch] = useState<string>('');
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Submit Draft Dialog State
  const [submitDraftId, setSubmitDraftId] = useState<string | null>(null);

  // Queries & Mutations
  const { data: vendorsData } = useVendors({ limit: 100 });
  const vendors = vendorsData?.data || [];

  const submitMutation = useSubmitPaymentRequest();

  // Map Tab to Status filter for API query
  const queryStatus = useMemo(() => {
    switch (activeTab) {
      case 'DRAFTS':
        return RequestStatus.DRAFT;
      case 'SUBMITTED':
        return RequestStatus.SUBMITTED;
      case 'PENDING':
        return RequestStatus.PENDING_APPROVAL;
      case 'APPROVED':
        return RequestStatus.APPROVED;
      case 'REJECTED':
        return RequestStatus.REJECTED;
      case 'COMPLETED':
        return RequestStatus.PAID;
      case 'ALL':
      default:
        return statusFilter !== 'ALL' ? statusFilter : undefined;
    }
  }, [activeTab, statusFilter]);

  // Construct query filters
  const filters = useMemo(() => {
    const f: any = {
      requesterId: user?.id,
      search: search.trim() || undefined,
      status: queryStatus,
      expenseCategory: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      vendorId: vendorFilter !== 'ALL' ? vendorFilter : undefined,
      priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    return f;
  }, [user?.id, search, queryStatus, categoryFilter, vendorFilter, priorityFilter, startDate, endDate]);

  const {
    data: requestsData,
    isLoading,
    isFetching,
    refetch,
  } = usePaymentRequests(filters, {
    page,
    pageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const requests: PaymentRequest[] = requestsData?.data || [];
  const totalCount = requestsData?.total ?? requests.length;
  const totalPages = requestsData?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

  // Tabs Definition
  const tabs: TabItem[] = [
    { id: 'ALL', label: 'All Requests' },
    { id: 'DRAFTS', label: 'Drafts' },
    { id: 'SUBMITTED', label: 'Submitted' },
    { id: 'PENDING', label: 'Pending Approval' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
    { id: 'COMPLETED', label: 'Completed' },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategoryFilter('ALL');
    setVendorFilter('ALL');
    setPriorityFilter('ALL');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasActiveFilters =
    search !== '' ||
    categoryFilter !== 'ALL' ||
    vendorFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const handleSubmitDraft = async () => {
    if (!submitDraftId) return;
    await submitMutation.mutateAsync(submitDraftId);
    setSubmitDraftId(null);
  };

  // Get Empty State copy based on current tab
  const getEmptyStateDetails = () => {
    switch (activeTab) {
      case 'DRAFTS':
        return {
          title: 'No Draft Requests Found',
          description: 'You do not have any saved drafts. Start a new requisition to save your work.',
        };
      case 'SUBMITTED':
        return {
          title: 'No Submitted Requests',
          description: 'No payment requests have been recently submitted into the queue.',
        };
      case 'PENDING':
        return {
          title: 'No Pending Approvals',
          description: 'All your requisitions have completed their review or no requests are awaiting sign-off.',
        };
      case 'APPROVED':
        return {
          title: 'No Approved Requests',
          description: 'You do not have any payment requisitions that have completed approval.',
        };
      case 'REJECTED':
        return {
          title: 'No Rejected Requests',
          description: 'Great news! None of your payment requisitions have been rejected.',
        };
      case 'COMPLETED':
        return {
          title: 'No Completed Disbursements',
          description: 'No processed or completed payments found in your history.',
        };
      default:
        return {
          title: 'No Payment Requests Found',
          description: hasActiveFilters
            ? 'No requisitions matched your applied filter criteria. Try resetting your search filters.'
            : 'You haven\'t created any payment requisitions yet. Click below to initiate your first request.',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Payment Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track, manage, and submit your organizational payment requests and vendor disbursements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching && !isLoading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
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

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-dark-border">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="underline"
        />
      </div>

      {/* Search and Filter Bar */}
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
            {/* View Mode Toggle (Desktop) */}
            <div className="hidden sm:flex items-center border border-slate-200 dark:border-dark-border rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-dark-card shadow-xs text-navy-800 dark:text-cyan-400'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-dark-card shadow-xs text-navy-800 dark:text-cyan-400'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Cards view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <Button
              variant={showFilterDrawer ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowFilterDrawer((prev) => !prev)}
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            >
              Filters
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
                Reset All
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showFilterDrawer && (
          <div className="pt-3 border-t border-slate-100 dark:border-dark-border/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Vendor Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Vendor
              </label>
              <Select
                value={vendorFilter}
                onChange={(e) => {
                  setVendorFilter(e.target.value);
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

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Expense Category
              </label>
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                <option value="ALL">All Categories</option>
                {Array.from(new Set(Object.values(ExpenseCategory))).map((cat) => (
                  <option key={cat} value={cat}>
                    {getExpenseCategoryLabel(cat)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Priority
              </label>
              <Select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
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

            {/* Status Filter (Only if activeTab is ALL) */}
            {activeTab === 'ALL' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
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
            )}

            {/* Date Range Start */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Created From
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

            {/* Date Range End */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Created To
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

      {/* Main Content Area: Table / Cards / Empty State */}
      {isLoading ? (
        <Table isLoading skeletonRows={5} skeletonCols={7} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title={getEmptyStateDetails().title}
          description={getEmptyStateDetails().description}
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/payment-requests/new')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Payment Request
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          {viewMode === 'table' ? (
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Request #</TableHeaderCell>
                    <TableHeaderCell>Vendor</TableHeaderCell>
                    <TableHeaderCell>Category</TableHeaderCell>
                    <TableHeaderCell className="text-right">Total Amount (₹)</TableHeaderCell>
                    <TableHeaderCell>Priority</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Created Date</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((req) => {
                    const priorityStyle = getPriorityColor(req.priority);
                    const isDraft = req.status === RequestStatus.DRAFT;
                    const totalAmt = req.totalAmount ?? req.amount;

                    return (
                      <TableRow key={req.id}>
                        {/* Request ID */}
                        <TableCell className="font-mono font-medium">
                          <Link
                            to={`/payment-requests/${req.id}`}
                            className="text-navy-800 dark:text-cyan-400 hover:underline font-semibold"
                          >
                            {req.requestNumber || req.id.slice(0, 8)}
                          </Link>
                          {req.invoiceNumber && (
                            <div className="text-[11px] text-slate-400 font-sans">
                              Inv: {req.invoiceNumber}
                            </div>
                          )}
                        </TableCell>

                        {/* Vendor */}
                        <TableCell>
                          <div className="font-medium text-slate-900 dark:text-white line-clamp-1">
                            {req.vendor?.name || 'Unknown Vendor'}
                          </div>
                          {req.vendor?.vendorCode && (
                            <div className="text-[11px] text-slate-400">
                              {req.vendor.vendorCode}
                            </div>
                          )}
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {getExpenseCategoryLabel(req.expenseCategory)}
                          </span>
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-right font-semibold text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totalAmt)}
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

                        {/* Date */}
                        <TableCell className="text-slate-500 text-xs">
                          {formatDate(req.createdAt)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/payment-requests/${req.id}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-navy-800 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {isDraft && (
                              <>
                                <Link
                                  to={`/payment-requests/edit/${req.id}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Edit Draft"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setSubmitDraftId(req.id)}
                                  className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                                  title="Submit Requisition"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Desktop Cards Grid View */
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((req) => {
                const priorityStyle = getPriorityColor(req.priority);
                const isDraft = req.status === RequestStatus.DRAFT;
                const totalAmt = req.totalAmount ?? req.amount;

                return (
                  <div
                    key={req.id}
                    className="bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-dark-border shadow-xs hover:border-navy-300 dark:hover:border-cyan-800 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link
                          to={`/payment-requests/${req.id}`}
                          className="font-mono text-sm font-bold text-navy-800 dark:text-cyan-400 hover:underline"
                        >
                          {req.requestNumber || req.id.slice(0, 8)}
                        </Link>
                        <StatusBadge status={req.status} size="sm" />
                      </div>

                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1 mb-1">
                        {req.vendor?.name || 'Vendor N/A'}
                      </h3>
                      {req.invoiceNumber && (
                        <p className="text-xs text-slate-400 font-mono mb-3">
                          Invoice: {req.invoiceNumber}
                        </p>
                      )}

                      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-dark-border mb-3 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Category:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[150px]">
                            {getExpenseCategoryLabel(req.expenseCategory)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Total (₹):</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                            {formatCurrency(totalAmt)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-dark-border">
                          <span className="text-slate-400">Due Date:</span>
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {formatDate(req.dueDate || req.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-dark-border text-xs">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityStyle.badge}`}
                      >
                        {req.priority}
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/payment-requests/${req.id}`}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-dark-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          Details
                        </Link>
                        {isDraft && (
                          <>
                            <Link
                              to={`/payment-requests/edit/${req.id}`}
                              className="p-1 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Edit Draft"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setSubmitDraftId(req.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-navy-800 text-white hover:bg-navy-900 dark:bg-cyan-600 dark:hover:bg-cyan-700 transition"
                            >
                              Submit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {requests.map((req) => {
              const priorityStyle = getPriorityColor(req.priority);
              const isDraft = req.status === RequestStatus.DRAFT;
              const totalAmt = req.totalAmount ?? req.amount;

              return (
                <div
                  key={req.id}
                  className="bg-white dark:bg-dark-card rounded-xl p-4 border border-slate-200 dark:border-dark-border shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
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
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-y border-slate-100 dark:border-dark-border/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Category
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {getExpenseCategoryLabel(req.expenseCategory)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Total Amount
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {formatCurrency(totalAmt)}
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
                      <span>{formatDate(req.createdAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/payment-requests/${req.id}`)}
                      >
                        View
                      </Button>
                      {isDraft && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSubmitDraftId(req.id)}
                        >
                          Submit
                        </Button>
                      )}
                    </div>
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

      {/* Confirmation Dialog for Submitting a Draft */}
      <ConfirmDialog
        isOpen={Boolean(submitDraftId)}
        onClose={() => setSubmitDraftId(null)}
        onConfirm={handleSubmitDraft}
        actionType="approve"
        title="Submit Payment Requisition"
        message="Are you sure you want to submit this draft for multi-level approval? Once submitted, it cannot be modified directly."
        confirmText="Confirm & Submit"
        isLoading={submitMutation.isPending}
      />
    </div>
  );
};

export default MyRequests;
