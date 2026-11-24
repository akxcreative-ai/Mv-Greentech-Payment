import { api } from './api';
import {
  PaymentRequest,
  ApprovalRecord,
  ClarificationMessage,
  ApprovalFilters,
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

function unwrap<T>(data: ApiResponse<T> | T): T {
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data as ApiResponse<T>).data;
  }
  return data as T;
}

export const approvalService = {
  /**
   * Fetch all payment requests pending approval for the current user's role and limit
   */
  async getPending(
    filters?: ApprovalFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<PaymentRequest>> {
    const params = {
      ...filters,
      ...pagination,
    };

    const response = await api.get<any>(
      '/approvals/pending',
      { params }
    );

    const unwrapped = unwrap(response.data);
    if (Array.isArray(unwrapped)) {
      return {
        data: unwrapped,
        total: unwrapped.length,
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || unwrapped.length,
        totalPages: 1,
      };
    }
    return unwrapped as PaginatedResponse<PaymentRequest>;
  },

  /**
   * Alias for getPending
   */
  async getPendingApprovals(
    filters?: ApprovalFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<PaymentRequest>> {
    return this.getPending(filters, pagination);
  },

  /**
   * Approve a pending payment request with optional comment and adjusted approved amount
   */
  async approve(
    requestId: string,
    comment?: string,
    approvedAmount?: number
  ): Promise<PaymentRequest> {
    const response = await api.post<ApiResponse<PaymentRequest> | PaymentRequest>(
      `/approvals/${requestId}/approve`,
      { comment, approvedAmount }
    );

    return unwrap(response.data);
  },

  /**
   * Alias for approve
   */
  async approveRequest(
    requestId: string,
    comment?: string,
    approvedAmount?: number
  ): Promise<PaymentRequest> {
    return this.approve(requestId, comment, approvedAmount);
  },

  /**
   * Reject a payment request with mandatory audit reason
   */
  async reject(requestId: string, reason: string): Promise<PaymentRequest> {
    const response = await api.post<ApiResponse<PaymentRequest> | PaymentRequest>(
      `/approvals/${requestId}/reject`,
      { reason }
    );

    return unwrap(response.data);
  },

  /**
   * Alias for reject
   */
  async rejectRequest(requestId: string, reason: string): Promise<PaymentRequest> {
    return this.reject(requestId, reason);
  },

  /**
   * Request clarification from the requester before deciding on approval
   */
  async clarify(requestId: string, message: string): Promise<ClarificationMessage> {
    const response = await api.post<ApiResponse<ClarificationMessage> | ClarificationMessage>(
      `/approvals/${requestId}/clarify`,
      { message }
    );

    return unwrap(response.data);
  },

  /**
   * Alias for clarify
   */
  async requestClarification(requestId: string, message: string): Promise<ClarificationMessage> {
    return this.clarify(requestId, message);
  },

  /**
   * Respond to an approver's clarification inquiry
   */
  async respond(requestId: string, message: string): Promise<ClarificationMessage> {
    const response = await api.post<ApiResponse<ClarificationMessage> | ClarificationMessage>(
      `/approvals/${requestId}/respond`,
      { message }
    );

    return unwrap(response.data);
  },

  /**
   * Alias for respond
   */
  async respondToClarification(requestId: string, message: string): Promise<ClarificationMessage> {
    return this.respond(requestId, message);
  },

  /**
   * Fetch full approval trail and chronological sign-off history for a request
   */
  async history(requestId: string): Promise<ApprovalRecord[]> {
    const response = await api.get<ApiResponse<ApprovalRecord[]> | ApprovalRecord[]>(
      `/approvals/${requestId}/history`
    );

    return unwrap(response.data);
  },

  /**
   * Alias for history
   */
  async getApprovalHistory(requestId: string): Promise<ApprovalRecord[]> {
    return this.history(requestId);
  },
};

export default approvalService;
