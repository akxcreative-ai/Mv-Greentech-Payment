import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { reportService } from '@/services/reportService';
import { ReportFilters } from '@/types';

export const SPEND_REPORT_KEY = ['reports', 'spend'];
export const VENDOR_REPORT_KEY = ['reports', 'vendors'];
export const DEPARTMENT_REPORT_KEY = ['reports', 'departments'];

/**
 * Hook to fetch spending trends and historical volumes
 */
export const useSpendReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: [...SPEND_REPORT_KEY, filters],
    queryFn: () => reportService.getSpendReports(filters),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch vendor expenditure analysis
 */
export const useVendorSpendReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: [...VENDOR_REPORT_KEY, filters],
    queryFn: () => reportService.getVendorReports(filters),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch department budget utilization reports
 */
export const useDepartmentSpendReport = (filters?: ReportFilters) => {
  return useQuery({
    queryKey: [...DEPARTMENT_REPORT_KEY, filters],
    queryFn: () => reportService.getDepartmentReports(filters),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to trigger reports export download (CSV, XLSX, PDF)
 */
export const useExportReport = () => {
  return useMutation({
    mutationFn: ({
      format,
      filters,
      filename,
    }: {
      format: 'csv' | 'xlsx' | 'pdf';
      filters?: ReportFilters;
      filename?: string;
    }) => reportService.exportPaymentRequests(format, filters, filename),
    onSuccess: (_, { format }) => {
      toast.success(`Export generated successfully (${format.toUpperCase()})`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to export report');
    },
  });
};
