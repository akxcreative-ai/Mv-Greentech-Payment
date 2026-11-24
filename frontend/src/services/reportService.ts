import { api } from './api';
import {
  DashboardStats,
  ApproverDashboardStats,
  AccountantDashboardStats,
  ReportFilters,
  SpendReportData,
  VendorSpendReportData,
  DepartmentSpendReportData,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

export const reportService = {
  /**
   * Fetch executive summary dashboard statistics (Admin / Management)
   */
  async getDashboardStats(filters?: Partial<ReportFilters>): Promise<DashboardStats> {
    try {
      const response = await api.get('/reports/dashboard/admin', { params: filters });
      return unwrap(response.data);
    } catch {
      const fallback = await api.get<ApiResponse<DashboardStats> | DashboardStats>('/reports/dashboard', {
        params: filters,
      });
      return unwrap(fallback.data);
    }
  },

  /**
   * Fetch approver-specific workflow metrics and pending queues
   */
  async getApproverDashboardStats(): Promise<ApproverDashboardStats> {
    try {
      const response = await api.get('/reports/dashboard/approver');
      return unwrap(response.data);
    } catch {
      const fallback = await api.get<ApiResponse<ApproverDashboardStats> | ApproverDashboardStats>(
        '/reports/approver-dashboard'
      );
      return unwrap(fallback.data);
    }
  },

  /**
   * Fetch accountant disbursement pipeline metrics
   */
  async getAccountantDashboardStats(filters?: Partial<ReportFilters>): Promise<AccountantDashboardStats> {
    try {
      const response = await api.get('/reports/dashboard/accountant', { params: filters });
      return unwrap(response.data);
    } catch {
      const fallback = await api.get('/reports/accountant-dashboard', { params: filters });
      return unwrap(fallback.data);
    }
  },

  /**
   * Fetch spending trends aggregated across time intervals
   */
  async getSpendReports(filters?: ReportFilters): Promise<SpendReportData> {
    const response = await api.get<ApiResponse<SpendReportData> | SpendReportData>('/reports/spend', {
      params: filters,
    });

    return unwrap(response.data);
  },

  /**
   * Alias for getSpendReports
   */
  async getSpendReport(filters?: ReportFilters): Promise<SpendReportData> {
    return this.getSpendReports(filters);
  },

  /**
   * Fetch vendor-wise spend breakdown and concentration analysis
   */
  async getVendorReports(filters?: ReportFilters): Promise<VendorSpendReportData[]> {
    const response = await api.get<ApiResponse<VendorSpendReportData[]> | VendorSpendReportData[]>(
      '/reports/vendors',
      { params: filters }
    );

    const result = unwrap(response.data);
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  },

  /**
   * Alias for getVendorReports
   */
  async getVendorReport(filters?: ReportFilters): Promise<VendorSpendReportData[]> {
    return this.getVendorReports(filters);
  },

  /**
   * Fetch departmental budget vs actual spend utilization
   */
  async getDepartmentReports(filters?: ReportFilters): Promise<DepartmentSpendReportData[]> {
    const response = await api.get<ApiResponse<DepartmentSpendReportData[]> | DepartmentSpendReportData[]>(
      '/reports/departments',
      { params: filters }
    );

    const result = unwrap(response.data);
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  },

  /**
   * Alias for getDepartmentReports
   */
  async getDepartmentReport(filters?: ReportFilters): Promise<DepartmentSpendReportData[]> {
    return this.getDepartmentReports(filters);
  },

  /**
   * Export payment requests to CSV, XLSX, or PDF
   */
  async exportPaymentRequests(
    format: 'csv' | 'xlsx' | 'pdf',
    filters?: ReportFilters,
    filename?: string
  ): Promise<Blob> {
    const response = await api.get('/reports/export', {
      params: { ...filters, format },
      responseType: 'blob',
    });

    const fallbackContentType =
      format === 'csv'
        ? 'text/csv'
        : format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

    const contentType = response.headers['content-type']
      ? String(response.headers['content-type'])
      : fallbackContentType;

    const blob = new Blob([response.data], {
      type: contentType,
    });

    const defaultFilename = `payment-requests-export-${new Date().toISOString().slice(0, 10)}.${format}`;
    const targetFilename = filename || defaultFilename;

    this.downloadExport(blob, targetFilename);

    return blob;
  },

  /**
   * Alias for exportPaymentRequests
   */
  async export(
    format: 'csv' | 'xlsx' | 'pdf',
    filters?: ReportFilters,
    filename?: string
  ): Promise<Blob> {
    return this.exportPaymentRequests(format, filters, filename);
  },

  /**
   * Helper utility to download Blob in browser
   */
  downloadExport(blob: Blob, filename: string): void {
    if (typeof window === 'undefined') return;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default reportService;
