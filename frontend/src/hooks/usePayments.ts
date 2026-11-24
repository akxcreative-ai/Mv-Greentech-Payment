import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { paymentService } from '@/services/paymentService';
import { PaymentRecord, RecordPaymentInput } from '@/types';
import { PAYMENT_REQUESTS_KEY, PAYMENT_REQUEST_DETAIL_KEY } from './usePaymentRequests';

export const PAYMENT_RECORD_KEY = (requestId: string) => ['payment-record', requestId];

/**
 * Hook to record payment disbursement
 */
export const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      data,
    }: {
      requestId: string;
      data: RecordPaymentInput;
    }) => paymentService.recordPayment(requestId, data),
    onSuccess: (_record: PaymentRecord, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUEST_DETAIL_KEY(requestId) });
      queryClient.invalidateQueries({ queryKey: PAYMENT_RECORD_KEY(requestId) });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Payment recorded successfully! Status updated to PAID.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record payment');
    },
  });
};

/**
 * Hook to mark payment workflow as fully completed
 */
export const useMarkPaymentCompleted = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => paymentService.markCompleted(requestId),
    onSuccess: (_record: PaymentRecord, requestId) => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENT_REQUEST_DETAIL_KEY(requestId) });
      queryClient.invalidateQueries({ queryKey: PAYMENT_RECORD_KEY(requestId) });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Payment workflow marked as COMPLETED!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark payment as completed');
    },
  });
};

/**
 * Hook to fetch payment record for a request
 */
export const usePaymentRecord = (requestId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: PAYMENT_RECORD_KEY(requestId),
    queryFn: () => paymentService.getPaymentRecord(requestId),
    enabled: Boolean(requestId) && (options?.enabled ?? true),
  });
};
