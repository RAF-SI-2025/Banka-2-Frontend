import api from './api';
import type {
  Loan,
  LoanApplicationRequest,
  LoanFilters,
  Installment,
  LoanRequest,
} from '../types/celina2';
import type { PaginatedResponse } from '../types';

// BE -> FE loan type mapping
const loanTypeFromBE: Record<string, string> = {
  CASH: 'GOTOVINSKI', MORTGAGE: 'STAMBENI', AUTO: 'AUTO',
  STUDENT: 'STUDENTSKI', REFINANCING: 'REFINANSIRAJUCI',
};

// FE -> BE loan type mapping
const loanTypeToBE: Record<string, string> = {
  GOTOVINSKI: 'CASH', STAMBENI: 'MORTGAGE', AUTO: 'AUTO',
  STUDENTSKI: 'STUDENT', REFINANSIRAJUCI: 'REFINANCING',
  CASH: 'CASH', MORTGAGE: 'MORTGAGE', REFINANCING: 'REFINANCING', STUDENT: 'STUDENT',
};

// BE -> FE interest type mapping
const interestTypeFromBE: Record<string, string> = {
  FIXED: 'FIKSNI', VARIABLE: 'VARIJABILNI',
};

const interestTypeToBE: Record<string, string> = {
  FIKSNI: 'FIXED', VARIJABILNI: 'VARIABLE', FIXED: 'FIXED', VARIABLE: 'VARIABLE',
};

function mapLoanFromBE(loan: Loan): Loan {
  const rawInterestType = (loan as unknown as Record<string, unknown>).interestType as string | undefined;
  return {
    ...loan,
    loanType: (loanTypeFromBE[loan.loanType] || loan.loanType) as Loan['loanType'],
    interestRateType: (interestTypeFromBE[rawInterestType ?? loan.interestRateType ?? ''] || rawInterestType || loan.interestRateType) as Loan['interestRateType'],
  };
}

function mapLoanRequestFromBE(req: LoanRequest): LoanRequest {
  const rawInterestType = (req as unknown as Record<string, unknown>).interestType as string | undefined;
  return {
    ...req,
    loanType: (loanTypeFromBE[req.loanType] || req.loanType) as LoanRequest['loanType'],
    interestRateType: (interestTypeFromBE[rawInterestType ?? req.interestRateType ?? ''] || rawInterestType || req.interestRateType) as LoanRequest['interestRateType'],
  };
}

export const creditService = {
  getMyLoans: async (): Promise<Loan[]> => {
    const response = await api.get<PaginatedResponse<Loan>>('/loans/my');
    const raw = Array.isArray(response.data) ? response.data : (response.data?.content ?? []);
    return raw.map(mapLoanFromBE);
  },

  getAll: async (filters?: LoanFilters): Promise<PaginatedResponse<Loan>> => {
    const params = new URLSearchParams();
    if (filters?.loanType) params.append('loanType', loanTypeToBE[filters.loanType] || filters.loanType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('size', String(filters.limit));

    const response = await api.get<PaginatedResponse<Loan>>('/loans', { params });
    const data = response.data;
    return {
      ...data,
      content: (data.content ?? []).map(mapLoanFromBE),
    };
  },

  getById: async (id: number): Promise<Loan> => {
    const response = await api.get<Loan>(`/loans/${id}`);
    return mapLoanFromBE(response.data);
  },

  apply: async (data: LoanApplicationRequest): Promise<LoanRequest> => {
    const { interestRateType, ...rest } = data;
    const payload = {
      ...rest,
      loanType: loanTypeToBE[data.loanType] || data.loanType,
      interestType: interestTypeToBE[interestRateType ?? ''] || interestRateType,
    };
    const response = await api.post<LoanRequest>('/loans', payload);
    return mapLoanRequestFromBE(response.data);
  },

  approve: async (requestId: number): Promise<void> => {
    await api.patch(`/loans/requests/${requestId}/approve`);
  },

  reject: async (requestId: number): Promise<void> => {
    await api.patch(`/loans/requests/${requestId}/reject`);
  },

  getInstallments: async (loanId: number): Promise<Installment[]> => {
    const response = await api.get<Installment[]>(`/loans/${loanId}/installments`);
    return response.data;
  },

  earlyRepayment: async (loanId: number): Promise<void> => {
    await api.post(`/loans/${loanId}/early-repayment`);
  },

  getMyRequests: async (): Promise<LoanRequest[]> => {
    const response = await api.get<LoanRequest[]>('/loans/requests/my');
    return Array.isArray(response.data) ? response.data : [];
  },

  getRequests: async (filters?: LoanFilters): Promise<PaginatedResponse<LoanRequest>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('size', String(filters.limit));

    const response = await api.get<PaginatedResponse<LoanRequest>>('/loans/requests', { params });
    const data = response.data;
    return {
      ...data,
      content: (data.content ?? []).map(mapLoanRequestFromBE),
    };
  },
};
