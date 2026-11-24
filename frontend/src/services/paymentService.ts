import { api } from './api';
import {
  PaymentRecord,
  RecordPaymentInput,
  ApiResponse,
} from '@/types';

export const paymentService = {
  /**
   * Record bank disbursement, transaction reference (UTR/Cheque), and payment details
   */
  async recordPayment(requestId: string, data: RecordPaymentInput): Promise<PaymentRecord> {
    const payload = {
      actual_amount: data.actualAmount ?? data.amountPaid,
      actualAmount: data.actualAmount ?? data.amountPaid,
      amountPaid: data.amountPaid ?? data.actualAmount,
      payment_mode: data.paymentMode,
      paymentMode: data.paymentMode,
      payment_date: data.paymentDate,
      paymentDate: data.paymentDate,
      utr_number: data.utrNumber,
      utrNumber: data.utrNumber,
      bank_account: data.bankAccount ?? data.bankAccountId,
      bankAccount: data.bankAccount ?? data.bankAccountId,
      payment_remarks: data.paymentRemarks ?? data.remarks,
      remarks: data.remarks ?? data.paymentRemarks,
      cheque_number: data.chequeNumber,
      transaction_id: data.transactionId,
      transactionReference: data.transactionReference,
    };
    const response = await api.post<ApiResponse<PaymentRecord> | PaymentRecord>(
      `/payments/${requestId}/record`,
      payload
    );

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as PaymentRecord;
  },

  /**
   * Mark payment as completed and transition request status to PAID
   */
  async markCompleted(requestId: string): Promise<PaymentRecord> {
    const response = await api.post<ApiResponse<PaymentRecord> | PaymentRecord>(
      `/payments/${requestId}/complete`
    );

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as PaymentRecord;
  },

  /**
   * Retrieve disbursement record and payment settlement details for a request
   */
  async getPaymentRecord(requestId: string): Promise<PaymentRecord> {
    const response = await api.get<ApiResponse<PaymentRecord> | PaymentRecord>(
      `/payments/${requestId}`
    );

    if ('data' in response.data && response.data.data) {
      return response.data.data;
    }
    return response.data as PaymentRecord;
  },
};

export default paymentService;
