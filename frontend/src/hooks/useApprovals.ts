import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { approvalService } from '@/services/approvalService';
import {
  PaymentRequest,
  ApprovalFilters,
  PaginationParams,
} from '@/types';
import { PAYMENT_REQUESTS_KEY, PAYMENT_REQUEST_DETAIL_KEY } from './usePaymentRequests';

export const PENDING_APPROVALS_KEY = ['approvals', 'pending'];
export const APPROVAL_HISTORY_KEY = (requestId: string) => ['approvals', 'history', requestId];

/**
 * Hook to fetch paginated pending approvals for the current user
 */
export const usePendingApprovals = (
  filters?: ApprovalFilters,
  pagination?: PaginationParams
) => {
  return useQuery({
    queryKey: [...PENDING_APPROVALS_KEY, filters, pagination],
    queryFn: () => approvalService.getPendingApprovals(filters, pagination),
    staleTime: 1000 * 60 * 1, // 1 minute
  });
};

/**
 * Hook to approve a payment request
 */
export const useApproveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      comment,
      approvedAmount,
    }: {
      requestId: string;
      comment?: string;
      approvedAmount?: number;
    }) => approvalService.approveRequest(requestId, comment, approvedAmount),
    onSuccess: (updatedRequest: PaymentRequest) => {
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(updatedRequest.id),
      });
      queryClient.invalidateQueries({
        queryKey: APPROVAL_HISTORY_KEY(updatedRequest.id),
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['approver-dashboard-stats'] });
      toast.success('Payment request approved successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve request');
    },
  });
};

/**
 * Hook to reject a payment request
 */
export const useRejectRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => approvalService.rejectRequest(requestId, reason),
    onSuccess: (updatedRequest: PaymentRequest) => {
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(updatedRequest.id),
      });
      queryClient.invalidateQueries({
        queryKey: APPROVAL_HISTORY_KEY(updatedRequest.id),
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['approver-dashboard-stats'] });
      toast.success('Payment request rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject request');
    },
  });
};

/**
 * Hook to request clarification from the requester
 */
export const useRequestClarification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      message,
    }: {
      requestId: string;
      message: string;
    }) => approvalService.requestClarification(requestId, message),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(requestId),
      });
      toast.success('Clarification requested from requester');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send clarification request');
    },
  });
};

/**
 * Hook to respond to an approver's clarification query
 */
export const useRespondToClarification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      message,
    }: {
      requestId: string;
      message: string;
    }) => approvalService.respondToClarification(requestId, message),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(requestId),
      });
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_KEY });
      toast.success('Clarification response submitted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit response');
    },
  });
};

/**
 * Hook to fetch chronological approval sign-off records
 */
export const useApprovalHistory = (requestId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: APPROVAL_HISTORY_KEY(requestId),
    queryFn: () => approvalService.getApprovalHistory(requestId),
    enabled: Boolean(requestId) && (options?.enabled ?? true),
  });
};
