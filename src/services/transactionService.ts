import api from './api';
import type {
  Transaction,
  Transfer,
  NewPaymentRequest,
  TransferRequest,
  TransactionFilters,
  VerificationRequest,
} from '../types/celina2';
import type { PaginatedResponse } from '../types';

export const transactionService = {
  // --- Placanja ---

  createPayment: async (data: NewPaymentRequest): Promise<Transaction> => {
    // Mapiranje FE polja -> BE polja
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
    };
    const response = await api.post<Transaction>('/payments', payload);
    return response.data;
  },

  requestOtp: async (): Promise<{ sent: boolean; message: string }> => {
    const response = await api.post<{ sent: boolean; message: string }>('/payments/request-otp');
    return response.data;
  },

  verifyPayment: async (data: VerificationRequest): Promise<{ verified: boolean; blocked?: boolean; message: string }> => {
    const response = await api.post<{ verified: boolean; blocked?: boolean; message: string }>('/payments/verify', data);
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

  createTransfer: async (data: TransferRequest): Promise<Transfer> => {
    const response = await api.post<Transfer>('/transfers/internal', data);
    return response.data;
  },

  createFxTransfer: async (data: TransferRequest): Promise<Transfer> => {
    const response = await api.post<Transfer>('/transfers/fx', data);
    return response.data;
  },

  getTransfers: async (filters?: { accountNumber?: string; dateFrom?: string; dateTo?: string }): Promise<Transfer[]> => {
    const params = new URLSearchParams();
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.dateFrom) params.append('fromDate', filters.dateFrom);
    if (filters?.dateTo) params.append('toDate', filters.dateTo);
    const response = await api.get<Transfer[]>('/transfers', { params });
    return response.data;
  },
};
