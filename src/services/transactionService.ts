import api from './api';
import type {
  Transaction,
  Transfer,
  NewPaymentRequest,
  TransferRequest,
  TransactionFilters,
} from '../types/celina2';
import type { PaginatedResponse } from '../types';

function mapTransferResponse(data: Record<string, unknown>): Transfer {
  return {
    id: data.id as number,
    fromAccountNumber: data.fromAccountNumber as string,
    toAccountNumber: data.toAccountNumber as string,
    amount: data.amount as number,
    fromCurrency: data.fromCurrency as Transfer['fromCurrency'],
    toCurrency: data.toCurrency as Transfer['toCurrency'],
    exchangeRate: (data.exchangeRate as number) ?? undefined,
    convertedAmount: (data.toAmount as number) ?? (data.convertedAmount as number) ?? undefined,
    commission: (data.commission as number) ?? undefined,
    status: data.status as Transfer['status'],
    createdAt: data.createdAt as string,
  };
}

export const transactionService = {
  // --- Placanja ---

  createPayment: async (data: NewPaymentRequest, otpCode?: string): Promise<Transaction> => {
    const payload = {
      fromAccount: data.fromAccountNumber,
      toAccount: data.toAccountNumber,
      amount: data.amount,
      paymentCode: data.paymentCode,
      description: data.paymentPurpose,
      referenceNumber: data.referenceNumber,
      recipientName: data.recipientName,
      model: data.model,
      callNumber: data.callNumber,
      otpCode: otpCode || '',
    };
    const response = await api.post<Transaction>('/payments', payload);
    return response.data;
  },

  requestOtp: async (): Promise<{ sent: boolean; message: string }> => {
    const response = await api.post<{ sent: boolean; message: string }>('/payments/request-otp');
    return response.data;
  },

  requestOtpViaEmail: async (): Promise<{ sent: boolean; message: string }> => {
    const response = await api.post<{ sent: boolean; message: string }>('/payments/request-otp-email');
    return response.data;
  },

  getActiveOtp: async (): Promise<{ active: boolean; code?: string; expiresInSeconds?: number; attempts?: number; maxAttempts?: number; message?: string }> => {
    const response = await api.get('/payments/my-otp');
    return response.data;
  },

  getAll: async (filters?: TransactionFilters): Promise<PaginatedResponse<Transaction>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.dateFrom) params.append('fromDate', filters.dateFrom);
    if (filters?.dateTo) params.append('toDate', filters.dateTo);
    if (filters?.amountMin !== undefined) params.append('minAmount', String(filters.amountMin));
    if (filters?.amountMax !== undefined) params.append('maxAmount', String(filters.amountMax));
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('size', String(filters.limit));

    const response = await api.get<PaginatedResponse<Transaction>>('/payments', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Transaction> => {
    const response = await api.get<Transaction>(`/payments/${id}`);
    return response.data;
  },

  // --- Prenosi ---

  createTransfer: async (data: TransferRequest, otpCode?: string): Promise<Transfer> => {
    const response = await api.post('/transfers/internal', { ...data, otpCode: otpCode || '' });
    return mapTransferResponse(response.data);
  },

  // R1 339: createFxTransfer (POST /transfers/fx) uklonjen — mrtav iz UI-ja.
  // Sve FE stranice koriste createTransfer (/transfers/internal), koji BE
  // auto-detektuje kao FX kad se valute racuna razlikuju. (BE /transfers/fx i
  // Mobile createFxTransfer ostaju — koriste se na svojim platformama.)

  getTransfers: async (filters?: { accountNumber?: string; dateFrom?: string; dateTo?: string }): Promise<Transfer[]> => {
    const params = new URLSearchParams();
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.dateFrom) params.append('fromDate', filters.dateFrom);
    if (filters?.dateTo) params.append('toDate', filters.dateTo);
    const response = await api.get('/transfers', { params });
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(mapTransferResponse);
  },

  getPaymentReceipt: async (paymentId: number): Promise<Blob> => {
    const response = await api.get(`/payments/${paymentId}/receipt`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
