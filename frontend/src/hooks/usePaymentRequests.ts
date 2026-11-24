import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { paymentRequestService } from '@/services/paymentRequestService';
import {
  PaymentRequest,
  PaymentRequestFilters,
  PaginationParams,
  CreatePaymentRequestInput,
  UpdatePaymentRequestInput,
  DuplicateCheckInput,
} from '@/types';

export const PAYMENT_REQUESTS_KEY = ['payment-requests'];
export const PAYMENT_REQUEST_DETAIL_KEY = (id: string) => ['payment-request', id];

/**
 * Hook to fetch paginated and filtered list of payment requests
 */
export const usePaymentRequests = (
  filters?: PaymentRequestFilters,
  pagination?: PaginationParams
) => {
  return useQuery({
    queryKey: [...PAYMENT_REQUESTS_KEY, filters, pagination],
    queryFn: () => paymentRequestService.getPaymentRequests(filters, pagination),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Hook to fetch complete payment request details by ID
 */
export const usePaymentRequest = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: PAYMENT_REQUEST_DETAIL_KEY(id),
    queryFn: () => paymentRequestService.getPaymentRequest(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Hook to create a new draft payment request
 */
export const useCreatePaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePaymentRequestInput) =>
      paymentRequestService.createPaymentRequest(data),
    onSuccess: (newRequest: PaymentRequest) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Payment request #${newRequest.requestNumber || ''} created successfully!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create payment request');
    },
  });
};

/**
 * Hook to update an existing payment request
 */
export const useUpdatePaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentRequestInput }) =>
      paymentRequestService.updatePaymentRequest(id, data),
    onSuccess: (updatedRequest: PaymentRequest) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(updatedRequest.id),
      });
      toast.success('Payment request updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update payment request');
    },
  });
};

/**
 * Hook to delete a payment request
 */
export const useDeletePaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentRequestService.deletePaymentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Payment request deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete payment request');
    },
  });
};

/**
 * Hook to submit a draft payment request into the approval chain
 */
export const useSubmitPaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentRequestService.submitPaymentRequest(id),
    onSuccess: (submittedRequest: PaymentRequest) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(submittedRequest.id),
      });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Payment request submitted for approval!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit payment request');
    },
  });
};

/**
 * Hook to cancel a payment request
 */
export const useCancelPaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      paymentRequestService.cancelPaymentRequest(id, reason),
    onSuccess: (cancelledRequest: PaymentRequest) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(cancelledRequest.id),
      });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Payment request cancelled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel payment request');
    },
  });
};

/**
 * Hook to upload supporting document to a payment request
 */
export const useUploadDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
      paymentRequestService.uploadDocument(requestId, file),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(requestId),
      });
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });
};

/**
 * Hook to delete a document from a payment request
 */
export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, docId }: { requestId: string; docId: string }) =>
      paymentRequestService.deleteDocument(requestId, docId),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: PAYMENT_REQUEST_DETAIL_KEY(requestId),
      });
      toast.success('Document removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });
};

/**
 * Hook to download a document
 */
export const useDownloadDocument = () => {
  return useMutation({
    mutationFn: ({
      requestId,
      docId,
      filename,
    }: {
      requestId: string;
      docId: string;
      filename?: string;
    }) => paymentRequestService.downloadDocument(requestId, docId, filename),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to download document');
    },
  });
};

/**
 * Hook to check duplicate requisition
 */
export const useCheckDuplicate = () => {
  return useMutation({
    mutationFn: (data: DuplicateCheckInput) => paymentRequestService.checkDuplicate(data),
  });
};

export default usePaymentRequests;
