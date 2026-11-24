import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/reportService';
import { ReportFilters } from '@/types';

export const DASHBOARD_STATS_KEY = ['dashboard-stats'];
export const ADMIN_DASHBOARD_STATS_KEY = ['admin-dashboard-stats'];
export const APPROVER_DASHBOARD_STATS_KEY = ['approver-dashboard-stats'];
export const ACCOUNTANT_DASHBOARD_STATS_KEY = ['accountant-dashboard-stats'];

/**
 * Hook to fetch main KPI cards, spend overview, and status distribution
 */
export const useDashboardStats = (filters?: Partial<ReportFilters>) => {
  return useQuery({
    queryKey: [...DASHBOARD_STATS_KEY, filters],
    queryFn: () => reportService.getDashboardStats(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to fetch super admin executive dashboard stats
 */
export const useAdminDashboardStats = (filters?: Partial<ReportFilters>) => {
  return useQuery({
    queryKey: [...ADMIN_DASHBOARD_STATS_KEY, filters],
    queryFn: () => reportService.getDashboardStats(filters),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to fetch approver specific queue metrics and urgency breakdown
 */
export const useApproverDashboardStats = () => {
  return useQuery({
    queryKey: APPROVER_DASHBOARD_STATS_KEY,
    queryFn: () => reportService.getApproverDashboardStats(),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to fetch accountant payout and disbursement queue metrics
 */
export const useAccountantDashboardStats = (filters?: Partial<ReportFilters>) => {
  return useQuery({
    queryKey: [...ACCOUNTANT_DASHBOARD_STATS_KEY, filters],
    queryFn: () => reportService.getAccountantDashboardStats(filters),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });
};
