import { api } from './api';
import {
  PaymentRequest,
  PaymentRequestDocument,
  PaymentRequestFilters,
  PaginationParams,
  PaginatedResponse,
  CreatePaymentRequestInput,
  UpdatePaymentRequestInput,
  DuplicateCheckInput,
  DuplicateCheckResult,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

function normalizePaginatedResponse<T>(res: any): PaginatedResponse<T> {
  const unwrapped = unwrap(res) as any;
  if (Array.isArray(unwrapped)) {
    return {
      data: unwrapped,
      total: unwrapped.length,
      page: 1,
      pageSize: unwrapped.length,
      totalPages: 1,
    };
  }
  if (!unwrapped || typeof unwrapped !== 'object') {
    return {
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
  }
  const items = unwrapped.data || unwrapped.items || [];
  return {
    data: items,
    total: unwrapped.total ?? items.length,
    page: unwrapped.page ?? 1,
    pageSize: unwrapped.pageSize ?? unwrapped.page_size ?? 10,
    totalPages: unwrapped.totalPages ?? unwrapped.pages ?? 1,
  };
}

export const paymentRequestService = {
  /**
   * Fetch payment requests with optional filtering and pagination
   */
  async getPaymentRequests(
    filters?: PaymentRequestFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<PaymentRequest>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<ApiResponse<PaginatedResponse<PaymentRequest>> | PaginatedResponse<PaymentRequest>>(
      '/payment-requests',
      { params }
    );

    return normalizePaginatedResponse<PaymentRequest>(response.data);
  },

  /**
   * Fetch single payment request by ID with complete details
   */
  async getPaymentRequest(id: string): Promise<PaymentRequest> {
    const response = await api.get<ApiResponse<PaymentRequest> | PaymentRequest>(
      `/payment-requests/${id}`
    );

    return unwrap(response.data);
  },

  /**
   * Create a new draft payment requisition
   */
  async createPaymentRequest(data: CreatePaymentRequestInput): Promise<PaymentRequest> {
    const response = await api.post<ApiResponse<PaymentRequest> | PaymentRequest>(
      '/payment-requests',
      data
    );

    return unwrap(response.data);
  },

  /**
   * Update existing draft or editable payment request
   */
  async updatePaymentRequest(id: string, data: UpdatePaymentRequestInput): Promise<PaymentRequest> {
    const response = await api.put<ApiResponse<PaymentRequest> | PaymentRequest>(
      `/payment-requests/${id}`,
      data
    );

    return unwrap(response.data);
  },

  /**
   * Delete draft or cancelled payment request
   */
  async deletePaymentRequest(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/payment-requests/${id}`
    );

    const message =
      response.data && typeof response.data === 'object' && 'data' in response.data && (response.data as { data: { message: string } }).data?.message
        ? (response.data as { data: { message: string } }).data.message
        : (response.data as { message: string }).message || 'Payment request deleted successfully';

    return { success: true, message };
  },

  /**
   * Submit payment request into the multi-level approval pipeline
   */
  async submitPaymentRequest(id: string): Promise<PaymentRequest> {
    const response = await api.post<ApiResponse<PaymentRequest> | PaymentRequest>(
      `/payment-requests/${id}/submit`
    );

    return unwrap(response.data);
  },

  /**
   * Cancel payment request by requester or administrator
   */
  async cancelPaymentRequest(id: string, reason?: string): Promise<PaymentRequest> {
    const response = await api.post<ApiResponse<PaymentRequest> | PaymentRequest>(
      `/payment-requests/${id}/cancel`,
      { reason }
    );

    return unwrap(response.data);
  },

  /**
   * Upload supporting invoice, quotation, or receipt document
   */
  async uploadDocument(requestId: string, file: File): Promise<PaymentRequestDocument> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<PaymentRequestDocument> | PaymentRequestDocument>(
      `/payment-requests/${requestId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return unwrap(response.data);
  },

  /**
   * Delete uploaded document from payment request
   */
  async deleteDocument(requestId: string, docId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<ApiResponse<{ message: string }> | { message: string }>(
      `/payment-requests/${requestId}/documents/${docId}`
    );

    const message =
      response.data && typeof response.data === 'object' && 'data' in response.data && (response.data as { data: { message: string } }).data?.message
        ? (response.data as { data: { message: string } }).data.message
        : (response.data as { message: string }).message || 'Document deleted successfully';

    return { success: true, message };
  },

  /**
   * Download attached document as Blob and optionally trigger browser download
   */
  async downloadDocument(requestId: string, docId: string, filename?: string): Promise<Blob> {
    const response = await api.get(`/payment-requests/${requestId}/documents/${docId}/download`, {
      responseType: 'blob',
    });

    const contentType = response.headers['content-type']
      ? String(response.headers['content-type'])
      : 'application/octet-stream';

    const blob = new Blob([response.data], {
      type: contentType,
    });

    if (filename && typeof window !== 'undefined') {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }

    return blob;
  },

  /**
   * Check for potential duplicate payment requests (vendor + invoice # + amount)
   */
  async checkDuplicate(data: DuplicateCheckInput): Promise<DuplicateCheckResult> {
    const response = await api.post<ApiResponse<DuplicateCheckResult> | DuplicateCheckResult>(
      '/payment-requests/check-duplicate',
      data
    );

    return unwrap(response.data);
  },
};

export default paymentRequestService;
