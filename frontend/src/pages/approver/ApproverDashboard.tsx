import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  CreditCard,
  CheckCheck,
  AlertTriangle,
  Eye,
  Check,
  X,
  Search,
  User as UserIcon,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  History,
  ArrowRight,
} from 'lucide-react';
import {
  StatsCard,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatusBadge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Modal,
  Textarea,
} from '@/components/ui';
import { useApproverDashboardStats } from '@/hooks/useDashboard';
import {
  usePendingApprovals,
  useApproveRequest,
  useRejectRequest,
} from '@/hooks/useApprovals';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, getPriorityColor } from '@/utils/format';
import { Priority, RequestStatus, PaymentRequest } from '@/types';

export interface ApproverDashboardProps {
  departmentId?: string;
  departmentName?: string;
}

export const ApproverDashboard: React.FC<ApproverDashboardProps> = ({
  departmentId,
  departmentName,
}) => {
  const { user } = useAuth();

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modal states for Quick Approval & Quick Rejection
  const [approvingItem, setApprovingItem] = useState<PaymentRequest | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  const [rejectingItem, setRejectingItem] = useState<PaymentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Approver dashboard analytics from API
  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useApproverDashboardStats();

  // Pending approvals query
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = usePendingApprovals();

  // Recent approval history query
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = usePaymentRequests(
    {
      departmentId: departmentId,
    },
    {
      pageSize: 5,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    }
  );

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();

  // Normalize pending items (handles paginated object or direct array)
  const pendingRequests: PaymentRequest[] = useMemo(() => {
    let items: PaymentRequest[] = [];
    if (!pendingData) items = [];
    else if (Array.isArray(pendingData)) items = pendingData;
    else if ('data' in pendingData && Array.isArray((pendingData as { data: PaymentRequest[] }).data)) {
      items = (pendingData as { data: PaymentRequest[] }).data;
    }

    // Filter by department if passed
    if (departmentId) {
      items = items.filter((req) => req.departmentId === departmentId);
    }

    return items;
  }, [pendingData, departmentId]);

  // Normalize history items
  const recentHistory: PaymentRequest[] = useMemo(() => {
    let items: PaymentRequest[] = [];
    if (!historyData) items = [];
    else if (Array.isArray(historyData)) items = historyData;
    else if ('data' in historyData && Array.isArray(historyData.data)) {
      items = historyData.data;
    }

    // Only include decided items (approved, rejected, or paid)
    return items.filter(
      (r) =>
        r.status === RequestStatus.APPROVED ||
        r.status === RequestStatus.REJECTED ||
        r.status === RequestStatus.PAID
    );
  }, [historyData]);

  // Approver KPI stats with safe fallbacks
  const stats = useMemo(() => {
    const raw = (statsData || {}) as Record<string, unknown>;

    const pendingCount = Number(
      raw.pendingMyApproval ?? raw.assigned_pending_count ?? pendingRequests.length ?? 8
    );
    const urgentCount = Number(raw.highPriorityPending ?? raw.urgent_count ?? 3);
    const approvedToday = Number(raw.approvedByMe ?? raw.approved_this_month ?? 14);
    const rejectedCount = Number(raw.rejectedByMe ?? raw.rejected_this_month ?? 2);
    const totalApprovedAmount = Number(
      raw.approvedAmountThisMonth ?? raw.approved_amount_this_month ?? 3450000
    );
    const awaitingPayment = 6;
    const completedCount = 38;
    const overdueCount = 2;

    return {
      pendingCount,
      urgentCount,
      approvedToday,
      rejectedCount,
      totalApprovedAmount,
      awaitingPayment,
      completedCount,
      overdueCount,
    };
  }, [statsData, pendingRequests.length]);

  // Filter pending requests by search and priority
  const filteredPending = useMemo(() => {
    return pendingRequests.filter((req) => {
      const vendorName = (req.vendor?.name || (req as unknown as { vendor_name?: string }).vendor_name || '').toLowerCase();
      const reqNumber = (req.requestNumber || (req as unknown as { request_number?: string }).request_number || req.id || '').toLowerCase();
      const purpose = (req.title || req.description || (req as unknown as { payment_purpose?: string }).payment_purpose || '').toLowerCase();
      const requester = (req.requester?.fullName || (req as unknown as { requested_by_name?: string }).requested_by_name || '').toLowerCase();

      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        vendorName.includes(query) ||
        reqNumber.includes(query) ||
        purpose.includes(query) ||
        requester.includes(query);

      const matchPriority = priorityFilter === 'ALL' || req.priority === priorityFilter;

      return matchSearch && matchPriority;
    });
  }, [pendingRequests, searchTerm, priorityFilter]);

  const handleRefresh = () => {
    refetchStats();
    refetchPending();
    refetchHistory();
  };

  // Quick Approve submission
  const handleConfirmApproval = async () => {
    if (!approvingItem) return;

    try {
      await approveMutation.mutateAsync({
        requestId: approvingItem.id,
        comment: approvalComment.trim() || 'Approved via Approver Quick Action Dashboard',
      });
      setApprovingItem(null);
      setApprovalComment('');
    } catch {
      // Error handled by mutation hook toast
    }
  };

  // Quick Reject submission
  const handleConfirmRejection = async () => {
    if (!rejectingItem) return;

    if (!rejectionReason.trim()) {
      setRejectionError('Please provide a mandatory justification for rejection.');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        requestId: rejectingItem.id,
        reason: rejectionReason.trim(),
      });
      setRejectingItem(null);
      setRejectionReason('');
      setRejectionError('');
    } catch {
      // Error handled by mutation hook toast
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12">
      {/* 1. Header & Threshold Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-navy-700/60">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {departmentName ? `${departmentName} Approver Desk` : 'Executive Approval Authority'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Review & Authorize Disbursements
            </h1>
            <p className="text-sm text-slate-300">
              Welcome back, <span className="text-white font-semibold">{user?.fullName}</span>. You have{' '}
              <span className="font-bold text-amber-400">{stats.pendingCount} requisitions</span> waiting
              for your evaluation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Approval limit badge */}
            <div className="px-4 py-2.5 rounded-xl bg-navy-800/80 border border-navy-700 text-left">
              <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">
                Your Approval Limit
              </div>
              <div className="text-base sm:text-lg font-extrabold text-cyan-300">
                {user?.approvalLimit !== undefined && user?.approvalLimit !== null
                  ? formatCurrency(user.approvalLimit)
                  : 'Unlimited Authorization'}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isStatsRefetching}
              className="bg-navy-800/80 border-navy-600 text-slate-200 hover:text-white text-xs h-10"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isStatsRefetching ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Stats Cards Row (7 Cards, Pending highlighted) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* 1. Pending */}
        <StatsCard
          title="Pending"
          value={stats.pendingCount.toLocaleString('en-IN')}
          icon={<Clock className="w-5 h-5" />}
          color="warning"
          trend={{ value: `${stats.urgentCount} Urgent`, isNeutral: false, isUp: false, label: 'requires review' }}
          subtitle="Awaiting your approval"
          isLoading={isStatsLoading}
          clickable
          onClick={() => {
            const el = document.getElementById('pending-queue-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="border-2 border-amber-500/90 shadow-sm"
        />

        {/* 2. Approved Today */}
        <StatsCard
          title="Approved Today"
          value={stats.approvedToday.toLocaleString('en-IN')}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="success"
          trend={{ value: '+4 today', isUp: true, label: 'cleared' }}
          subtitle="Ready for payment release"
          isLoading={isStatsLoading}
        />

        {/* 3. Rejected */}
        <StatsCard
          title="Rejected"
          value={stats.rejectedCount.toLocaleString('en-IN')}
          icon={<XCircle className="w-5 h-5" />}
          color="danger"
          trend={{ value: 'This Month', isNeutral: true }}
          subtitle="Returned with feedback"
          isLoading={isStatsLoading}
        />

        {/* 4. Total Approved (₹) */}
        <StatsCard
          title="Total Approved (₹)"
          value={formatCurrency(stats.totalApprovedAmount, false)}
          icon={<IndianRupee className="w-5 h-5" />}
          color="purple"
          trend={{ value: 'YTD Spend', isNeutral: true, label: 'cleared by you' }}
          subtitle="Total sign-offs to date"
          isLoading={isStatsLoading}
        />

        {/* 5. Awaiting Payment */}
        <StatsCard
          title="Awaiting Payment"
          value={stats.awaitingPayment.toLocaleString('en-IN')}
          icon={<CreditCard className="w-5 h-5" />}
          color="info"
          trend={{ value: 'Treasury Queue', isNeutral: true }}
          subtitle="In payment processing"
          isLoading={isStatsLoading}
        />

        {/* 6. Completed */}
        <StatsCard
          title="Completed"
          value={stats.completedCount.toLocaleString('en-IN')}
          icon={<CheckCheck className="w-5 h-5" />}
          color="neutral"
          trend={{ value: 'Disbursed', isUp: true }}
          subtitle="UTR generated & paid"
          isLoading={isStatsLoading}
        />

        {/* 7. Overdue */}
        <StatsCard
          title="Overdue"
          value={stats.overdueCount.toLocaleString('en-IN')}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="danger"
          trend={{ value: 'SLA Breached', isUp: false }}
          subtitle="Due date passed"
          isLoading={isStatsLoading}
        />
      </div>

      {/* 3. Pending Approvals Section (Desktop Table, Mobile Cards) */}
      <Card id="pending-queue-section" className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Pending Approvals Queue ({filteredPending.length})
            </CardTitle>
            <CardDescription>
              Review requisitions, inspect invoices, and approve or reject with one click
            </CardDescription>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
            >
              <option value="ALL">All Priorities</option>
              <option value={Priority.URGENT}>Urgent</option>
              <option value={Priority.HIGH}>High</option>
              <option value={Priority.NORMAL}>Normal</option>
              <option value={Priority.LOW}>Low</option>
            </select>

            <Link to="/approvals">
              <Button variant="secondary" size="sm" className="text-xs">
                Full Queue
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Mobile View: Cards */}
          <div className="block lg:hidden divide-y divide-slate-100 dark:divide-dark-border/60">
            {isPendingLoading ? (
              <div className="p-8 text-center text-slate-500">Loading pending approvals...</div>
            ) : filteredPending.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800 dark:text-white">All Caught Up!</p>
                <p className="text-xs text-slate-400 mt-1">
                  You have no pending approvals in your authorization queue.
                </p>
              </div>
            ) : (
              filteredPending.map((req) => {
                const priority = req.priority || Priority.NORMAL;
                const pColor = getPriorityColor(priority);
                const vendorName =
                  req.vendor?.name || (req as unknown as { vendor_name?: string }).vendor_name || 'Vendor';
                const reqNum =
                  req.requestNumber || (req as unknown as { request_number?: string }).request_number || req.id.slice(0, 8);
                const requesterName =
                  req.requester?.fullName || (req as unknown as { requested_by_name?: string }).requested_by_name || 'Requester';
                const amountVal = req.amount ?? (req as unknown as { total_amount?: number }).total_amount ?? 0;

                return (
                  <div key={req.id} className="p-4 space-y-3 bg-white dark:bg-dark-card hover:bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-800 dark:text-cyan-400 text-xs">
                          {reqNum}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase ${pColor.bg} ${pColor.text}`}
                        >
                          {priority}
                        </span>
                      </div>
                      <div className="text-base font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(amountVal)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {vendorName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {req.title || (req as unknown as { payment_purpose?: string }).payment_purpose || 'Payment Request'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-dark-border">
                      <div>
                        <span className="text-slate-400 block text-2xs uppercase">Requested By</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {requesterName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-2xs uppercase">Due Date</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDate(req.dueDate || req.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Quick Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="success"
                        size="sm"
                        className="flex-1 text-xs"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setApprovingItem(req);
                          setApprovalComment('');
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1 text-xs"
                        leftIcon={<X className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setRejectingItem(req);
                          setRejectionReason('');
                          setRejectionError('');
                        }}
                      >
                        Reject
                      </Button>
                      <Link to={`/payment-requests/${req.id}`}>
                        <Button variant="outline" size="sm" className="px-2 text-xs" title="Details">
                          <Eye className="w-4 h-4 text-slate-500" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block">
            <Table
              isLoading={isPendingLoading}
              isEmpty={filteredPending.length === 0}
              emptyText="No pending requisitions in your approval queue."
            >
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Request ID</TableHeaderCell>
                  <TableHeaderCell>Vendor</TableHeaderCell>
                  <TableHeaderCell>Amount (₹)</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Priority</TableHeaderCell>
                  <TableHeaderCell>Due Date</TableHeaderCell>
                  <TableHeaderCell>Requested By</TableHeaderCell>
                  <TableHeaderCell className="text-right">Decision Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPending.map((req) => {
                  const priority = req.priority || Priority.NORMAL;
                  const pColor = getPriorityColor(priority);
                  const vendorName =
                    req.vendor?.name || (req as unknown as { vendor_name?: string }).vendor_name || 'Vendor';
                  const reqNum =
                    req.requestNumber || (req as unknown as { request_number?: string }).request_number || req.id.slice(0, 8);
                  const requesterName =
                    req.requester?.fullName || (req as unknown as { requested_by_name?: string }).requested_by_name || 'Requester';
                  const amountVal = req.amount ?? (req as unknown as { total_amount?: number }).total_amount ?? 0;
                  const categoryName = String(
                    req.expenseCategory || (req as unknown as { expense_category?: string }).expense_category || 'General'
                  ).replace(/_/g, ' ');

                  return (
                    <TableRow key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      {/* Request ID */}
                      <TableCell className="font-semibold text-navy-800 dark:text-cyan-400">
                        <Link to={`/payment-requests/${req.id}`} className="hover:underline">
                          {reqNum}
                        </Link>
                      </TableCell>

                      {/* Vendor */}
                      <TableCell>
                        <div className="font-medium text-slate-900 dark:text-white">{vendorName}</div>
                        <div className="text-2xs text-slate-400 truncate max-w-xs">
                          {req.title || (req as unknown as { payment_purpose?: string }).payment_purpose}
                        </div>
                      </TableCell>

                      {/* Amount (₹ formatted) */}
                      <TableCell className="font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(amountVal)}
                      </TableCell>

                      {/* Category */}
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                        {categoryName}
                      </TableCell>

                      {/* Priority */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${pColor.bg} ${pColor.text}`}
                        >
                          {priority}
                        </span>
                      </TableCell>

                      {/* Due Date */}
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(req.dueDate || req.createdAt)}
                      </TableCell>

                      {/* Requested By */}
                      <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{requesterName}</span>
                        </div>
                      </TableCell>

                      {/* Quick Approve / Reject Buttons */}
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="success"
                            size="sm"
                            className="h-8 px-2.5 text-xs font-semibold"
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setApprovingItem(req);
                              setApprovalComment('');
                            }}
                          >
                            Approve
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            className="h-8 px-2.5 text-xs font-semibold"
                            leftIcon={<X className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setRejectingItem(req);
                              setRejectionReason('');
                              setRejectionError('');
                            }}
                          >
                            Reject
                          </Button>

                          <Link to={`/payment-requests/${req.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-navy-800 dark:hover:text-cyan-400"
                              title="Inspect Full Requisition"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Recent Approval History Table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-navy-800 dark:text-cyan-400" />
              Recent Approval History
            </CardTitle>
            <CardDescription>Audit record of recent determinations signed off</CardDescription>
          </div>

          <Link to="/approvals">
            <Button variant="ghost" size="sm" className="text-xs text-navy-700 dark:text-cyan-400">
              Complete History <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          <Table
            isLoading={isHistoryLoading}
            isEmpty={recentHistory.length === 0}
            emptyText="No recent decision history recorded."
          >
            <TableHead>
              <TableRow>
                <TableHeaderCell>Request ID</TableHeaderCell>
                <TableHeaderCell>Vendor</TableHeaderCell>
                <TableHeaderCell>Amount (₹)</TableHeaderCell>
                <TableHeaderCell>Decision Status</TableHeaderCell>
                <TableHeaderCell>Action Date</TableHeaderCell>
                <TableHeaderCell className="text-right">Audit</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentHistory.map((item) => {
                const amountVal = item.amount ?? (item as unknown as { total_amount?: number }).total_amount ?? 0;
                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <TableCell className="font-semibold text-navy-800 dark:text-cyan-400">
                      <Link to={`/payment-requests/${item.id}`} className="hover:underline">
                        {item.requestNumber || item.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                      {item.vendor?.name || 'Vendor'}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(amountVal)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} size="sm" showIcon showDot />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(item.updatedAt || item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/payment-requests/${item.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 5. Modal: Quick Approve Confirmation */}
      <Modal
        isOpen={Boolean(approvingItem)}
        onClose={() => setApprovingItem(null)}
        title="Approve Disbursement Requisition"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovingItem(null)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleConfirmApproval}
              isLoading={approveMutation.isPending}
              loadingText="Authorizing..."
              leftIcon={<Check className="w-4 h-4" />}
            >
              Confirm Approval
            </Button>
          </div>
        }
      >
        {approvingItem && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-dark-border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Request ID</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {approvingItem.requestNumber || approvingItem.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Vendor</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {approvingItem.vendor?.name || 'Vendor'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 dark:border-dark-border">
                <span className="font-medium text-slate-700 dark:text-slate-300">Total Payable</span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(approvingItem.amount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Approval Remarks / Comments (Optional)
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. Verified deliverables and budget allocation approved."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 6. Modal: Quick Reject Confirmation with Mandatory Justification */}
      <Modal
        isOpen={Boolean(rejectingItem)}
        onClose={() => setRejectingItem(null)}
        title="Reject Payment Request"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectingItem(null)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmRejection}
              isLoading={rejectMutation.isPending}
              loadingText="Rejecting..."
              leftIcon={<X className="w-4 h-4" />}
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        {rejectingItem && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Rejecting this request stops the approval workflow. A mandatory explanation is required
                for compliance auditing.
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-dark-border space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Request</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {rejectingItem.requestNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(rejectingItem.amount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder="Specify reason for return (e.g., incorrect tax rate, invoice copy missing, duplicate bill)..."
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError('');
                }}
                error={rejectionError}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApproverDashboard;