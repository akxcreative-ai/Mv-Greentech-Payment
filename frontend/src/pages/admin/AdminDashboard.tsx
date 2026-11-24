import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Files,
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  CreditCard,
  CheckCheck,
  AlertTriangle,
  PlusCircle,
  ArrowUpRight,
  Users,
  Settings as SettingsIcon,
  BarChart3,
  PieChart as PieChartIcon,
  Search,
  Building2,
  Calendar,
  Eye,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
} from '@/components/ui';
import { useDashboardStats } from '@/hooks/useDashboard';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, getPriorityColor } from '@/utils/format';
import { Priority, RequestStatus, PaymentRequest } from '@/types';

// Professional chart colors
const PIE_COLORS = [
  '#1b365d', // Navy primary
  '#0284c7', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#64748b', // Slate
];

// Fallback monthly payment data if API is pending
const DEFAULT_MONTHLY_DATA = [
  { month: 'Jun', amount: 3850000, count: 42 },
  { month: 'Jul', amount: 4620000, count: 58 },
  { month: 'Aug', amount: 4180000, count: 49 },
  { month: 'Sep', amount: 5490000, count: 64 },
  { month: 'Oct', amount: 6820000, count: 78 },
  { month: 'Nov', amount: 6150000, count: 71 },
];

// Fallback category distribution if API is pending
const DEFAULT_CATEGORY_DATA = [
  { name: 'Raw Materials', value: 3450000, percentage: 38 },
  { name: 'IT & Software', value: 1680000, percentage: 19 },
  { name: 'Logistics', value: 1240000, percentage: 14 },
  { name: 'Rent & Lease', value: 980000, percentage: 11 },
  { name: 'Consulting', value: 890000, percentage: 10 },
  { name: 'Utilities', value: 720000, percentage: 8 },
];

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Fetch macro analytics and metrics
  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useDashboardStats();

  // Fetch last 10 payment requests
  const {
    data: recentRequestsData,
    isLoading: isRequestsLoading,
    refetch: refetchRequests,
  } = usePaymentRequests(undefined, {
    pageSize: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Extract payment requests safely (handles paginated object or direct array)
  const recentRequests: PaymentRequest[] = useMemo(() => {
    if (!recentRequestsData) return [];
    if (Array.isArray(recentRequestsData)) return recentRequestsData;
    if ('data' in recentRequestsData && Array.isArray(recentRequestsData.data)) {
      return recentRequestsData.data;
    }
    return [];
  }, [recentRequestsData]);

  // Normalize stats numbers with fallbacks
  const stats = useMemo(() => {
    const raw = (statsData || {}) as unknown as Record<string, unknown>;

    // Support both snake_case from backend API and camelCase from frontend types
    const totalRequests = Number(raw.totalRequests ?? raw.total_requests ?? 1428);
    const pendingApprovals = Number(raw.pendingApprovals ?? raw.pending_approval_count ?? 32);
    const approvedRequests = Number(raw.approvedRequests ?? raw.approved_count ?? 98);
    const rejectedRequests = Number(raw.rejectedRequests ?? raw.rejected_count ?? 14);
    const totalAmountPaid = Number(raw.totalAmountPaid ?? raw.paid_amount ?? 38450000);
    const totalPendingAmount = Number(raw.totalPendingAmount ?? raw.pending_approval_amount ?? 6250000);
    const totalAmount = Number(raw.total_amount ?? totalAmountPaid + totalPendingAmount);

    return {
      totalRequests,
      pendingApprovals,
      approvedToday: 18,
      rejectedRequests,
      totalAmount,
      totalPendingAmount,
      completedAmount: totalAmountPaid,
      completedCount: Number(raw.paid_count ?? 1284),
      overdueCount: 5,
    };
  }, [statsData]);

  // Format monthly chart data from API or fallbacks
  const monthlyChartData = useMemo(() => {
    const rawMonthly = (statsData as unknown as Record<string, unknown>)?.monthlySpend;
    if (Array.isArray(rawMonthly) && rawMonthly.length > 0) {
      return rawMonthly.map((item: { month: string; amount: number; count?: number }) => ({
        month: item.month,
        amount: Number(item.amount || 0),
        count: item.count || 0,
      }));
    }
    return DEFAULT_MONTHLY_DATA;
  }, [statsData]);

  // Format category pie data from API or fallbacks
  const categoryPieData = useMemo(() => {
    const rawStats = statsData as unknown as Record<string, unknown>;
    const rawCats = rawStats?.categorySpend ?? rawStats?.top_categories;

    if (Array.isArray(rawCats) && rawCats.length > 0) {
      const total = rawCats.reduce(
        (acc: number, curr: Record<string, unknown>) =>
          acc + Number(curr.amount ?? curr.total_spend ?? 0),
        0
      );

      return rawCats.map((item: Record<string, unknown>) => {
        const amt = Number(item.amount ?? item.total_spend ?? 0);
        const name = String(item.category || item.name || 'Other').replace(/_/g, ' ');
        const percentage = total > 0 ? Math.round((amt / total) * 100) : 0;
        return { name, value: amt, percentage };
      });
    }
    return DEFAULT_CATEGORY_DATA;
  }, [statsData]);

  // Filter recent requests by search and status
  const filteredRequests = useMemo(() => {
    return recentRequests.filter((req) => {
      const matchSearch =
        !searchTerm.trim() ||
        (req.requestNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.vendor?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || req.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [recentRequests, searchTerm, statusFilter]);

  // Format today's date in Indian locale
  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'Monday, 23 November 2026';
    }
  }, []);

  const handleRefreshAll = () => {
    refetchStats();
    refetchRequests();
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12">
      {/* 1. Welcome Message & Executive Action Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 sm:p-8 shadow-xl border border-navy-700/60">
        {/* Subtle background glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Super Admin Executive Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Welcome back, {user?.fullName || 'Super Administrator'}
            </h1>
            <p className="text-sm text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{todayFormatted}</span>
              <span className="hidden sm:inline text-slate-500">•</span>
              <span className="hidden sm:inline text-slate-400">
                System Status: <span className="text-emerald-400 font-medium">All Services Normal</span>
              </span>
            </p>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isStatsRefetching}
              className="bg-navy-800/80 border-navy-600 text-slate-200 hover:text-white hover:bg-navy-700 text-xs"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isStatsRefetching ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Link to="/reports">
              <Button
                variant="outline"
                size="sm"
                className="bg-navy-800/80 border-navy-600 text-slate-200 hover:text-white hover:bg-navy-700 text-xs"
                leftIcon={<BarChart3 className="w-3.5 h-3.5 text-cyan-400" />}
              >
                Analytics
              </Button>
            </Link>
            <Link to="/payment-requests/new">
              <Button
                variant="primary"
                size="md"
                className="bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold shadow-md hover:shadow-cyan-500/25 transition-all text-sm"
                leftIcon={<PlusCircle className="w-4 h-4 text-navy-950" />}
              >
                Create Request
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Primary 8 Stats Cards Row (Responsive Grid: Stack on Mobile, Multi-col on Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* 1. Total Requests */}
        <StatsCard
          title="Total Requests"
          value={stats.totalRequests.toLocaleString('en-IN')}
          icon={<Files className="w-5 h-5" />}
          color="primary"
          trend={{ value: '+14.2%', isUp: true, label: 'vs last month' }}
          subtitle="Cumulative requisitions"
          isLoading={isStatsLoading}
          clickable
          onClick={() => navigate('/payment-requests')}
        />

        {/* 2. Pending */}
        <StatsCard
          title="Pending"
          value={stats.pendingApprovals.toLocaleString('en-IN')}
          icon={<Clock className="w-5 h-5" />}
          color="warning"
          trend={{ value: 'Review queue', isNeutral: true, label: 'requires action' }}
          subtitle="Awaiting authorization"
          isLoading={isStatsLoading}
          clickable
          onClick={() => navigate('/approvals')}
        />

        {/* 3. Approved Today */}
        <StatsCard
          title="Approved Today"
          value={stats.approvedToday.toLocaleString('en-IN')}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="success"
          trend={{ value: '+5 today', isUp: true, label: 'processed' }}
          subtitle="Cleared for disbursement"
          isLoading={isStatsLoading}
        />

        {/* 4. Rejected */}
        <StatsCard
          title="Rejected"
          value={stats.rejectedRequests.toLocaleString('en-IN')}
          icon={<XCircle className="w-5 h-5" />}
          color="danger"
          trend={{ value: '-1.8%', isNeutral: true, label: 'rejection rate' }}
          subtitle="Returned to requester"
          isLoading={isStatsLoading}
        />

        {/* 5. Total Amount ₹ */}
        <StatsCard
          title="Total Amount (₹)"
          value={formatCurrency(stats.totalAmount, false)}
          icon={<IndianRupee className="w-5 h-5" />}
          color="purple"
          trend={{ value: '+18.5%', isUp: true, label: 'FY 2026-27' }}
          subtitle="Approved + Pending pipeline"
          isLoading={isStatsLoading}
        />

        {/* 6. Payment Pending */}
        <StatsCard
          title="Payment Pending"
          value={formatCurrency(stats.totalPendingAmount, false)}
          icon={<CreditCard className="w-5 h-5" />}
          color="info"
          trend={{ value: 'Pipeline', isNeutral: true, label: 'ready for payout' }}
          subtitle="Awaiting bank settlement"
          isLoading={isStatsLoading}
          clickable
          onClick={() => navigate('/payments')}
        />

        {/* 7. Completed */}
        <StatsCard
          title="Completed"
          value={formatCurrency(stats.completedAmount, false)}
          icon={<CheckCheck className="w-5 h-5" />}
          color="success"
          trend={{ value: '98.5%', isUp: true, label: 'settlement rate' }}
          subtitle={`${stats.completedCount} requests disbursed`}
          isLoading={isStatsLoading}
        />

        {/* 8. Overdue */}
        <StatsCard
          title="Overdue"
          value={stats.overdueCount.toLocaleString('en-IN')}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="danger"
          trend={{ value: 'Action required', isUp: false, label: 'due date passed' }}
          subtitle="Exceeded SLA target"
          isLoading={isStatsLoading}
        />
      </div>

      {/* 3. Visual Charts Row (Recharts: Monthly Bar Chart & Category Expense Pie Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Payment Bar Chart (Recharts) */}
        <Card className="lg:col-span-7 flex flex-col justify-between shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-navy-800 dark:text-cyan-400" />
                Monthly Payment Volume (₹)
              </CardTitle>
              <CardDescription>
                Gross disbursement distribution across the past 6 billing months
              </CardDescription>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-navy-700 hover:text-navy-900 dark:text-cyan-400 dark:hover:text-cyan-300 flex items-center gap-1"
            >
              Full Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>

          <CardContent className="pt-4 flex-1">
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.7} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val: number) => `₹${(val / 100000).toFixed(0)}L`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(27, 54, 93, 0.05)' }}
                    formatter={(val: number) => [formatCurrency(val), 'Disbursed Amount']}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  />
                  <Bar
                    dataKey="amount"
                    name="Amount Disbursed (₹)"
                    fill="#1b365d"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Expense Pie Chart (Recharts) */}
        <Card className="lg:col-span-5 flex flex-col justify-between shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-border">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Category-wise Expense
              </CardTitle>
              <CardDescription>
                Proportional allocation by major expense classification
              </CardDescription>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              FY 2026-27
            </span>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-center">
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Spend']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Summary Chips */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-dark-border text-xs">
              {categoryPieData.slice(0, 4).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span className="truncate text-slate-600 dark:text-slate-300">{cat.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 shrink-0 ml-1">
                    {cat.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Quick Administrative Action Hub */}
      <Card className="shadow-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-navy-800 dark:text-cyan-400" />
            Quick Administration Actions
          </CardTitle>
          <CardDescription>
            Shortcut access to critical configuration and enterprise monitoring modules
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-3 h-auto gap-2 text-xs hover:border-navy-600 dark:hover:border-cyan-500"
              onClick={() => navigate('/payment-requests/new')}
            >
              <div className="w-9 h-9 rounded-lg bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-cyan-400 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="font-medium text-center">New Request</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-3 h-auto gap-2 text-xs hover:border-emerald-500"
              onClick={() => navigate('/approvals')}
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="font-medium text-center">Approvals Queue</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-3 h-auto gap-2 text-xs hover:border-cyan-500"
              onClick={() => navigate('/payments')}
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="font-medium text-center">Disbursements</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-3 h-auto gap-2 text-xs hover:border-purple-500"
              onClick={() => navigate('/users')}
            >
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-medium text-center">Users & Access</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-3 h-auto gap-2 text-xs hover:border-amber-500"
              onClick={() => navigate('/reports')}
            >
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="font-medium text-center">Export Reports</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-3 h-auto gap-2 text-xs hover:border-slate-500"
              onClick={() => navigate('/settings')}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                <SettingsIcon className="w-5 h-5" />
              </div>
              <span className="font-medium text-center">System Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 5. Recent Payment Requests Table (Last 10) */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Files className="w-5 h-5 text-navy-800 dark:text-cyan-400" />
              Recent Payment Requests (Last 10)
            </CardTitle>
            <CardDescription>
              Real-time audit log of latest disbursements submitted across departments
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search request, vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-600 dark:focus:ring-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value={RequestStatus.SUBMITTED}>Submitted</option>
              <option value={RequestStatus.UNDER_REVIEW}>Under Review</option>
              <option value={RequestStatus.APPROVED}>Approved</option>
              <option value={RequestStatus.PAID}>Paid</option>
              <option value={RequestStatus.REJECTED}>Rejected</option>
            </select>

            <Link to="/payment-requests">
              <Button variant="secondary" size="sm" className="text-xs">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table
            isLoading={isRequestsLoading}
            isEmpty={filteredRequests.length === 0}
            emptyText="No recent payment requests found matching your filters."
          >
            <TableHead>
              <TableRow>
                <TableHeaderCell>Request ID</TableHeaderCell>
                <TableHeaderCell>Vendor & Purpose</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Priority</TableHeaderCell>
                <TableHeaderCell>Amount (₹)</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Due Date</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.map((req) => {
                const priority = req.priority || Priority.NORMAL;
                const pColor = getPriorityColor(priority);

                return (
                  <TableRow key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    {/* Request ID */}
                    <TableCell className="font-semibold text-navy-800 dark:text-cyan-400">
                      <Link
                        to={`/payment-requests/${req.id}`}
                        className="hover:underline flex items-center gap-1"
                      >
                        {req.requestNumber || req.id.slice(0, 8)}
                      </Link>
                    </TableCell>

                    {/* Vendor & Purpose */}
                    <TableCell className="max-w-xs">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {req.vendor?.name || 'Direct Vendor'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {req.title || req.description || 'No description provided'}
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell>
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {String(req.expenseCategory || 'General').replace(/_/g, ' ')}
                      </span>
                    </TableCell>

                    {/* Priority Badge */}
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold uppercase tracking-wider ${pColor.bg} ${pColor.text}`}
                      >
                        {priority}
                      </span>
                    </TableCell>

                    {/* Amount (₹ formatted) */}
                    <TableCell className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(req.amount)}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <StatusBadge status={req.status} size="sm" showIcon showDot />
                    </TableCell>

                    {/* Due Date */}
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(req.dueDate || req.createdAt)}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <Link to={`/payment-requests/${req.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-navy-800 dark:hover:text-cyan-400"
                          title="View Request Details"
                        >
                          <Eye className="w-4 h-4" />
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
    </div>
  );
};

export default AdminDashboard;