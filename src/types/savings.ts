export type SavingsDepositStatus = 'ACTIVE' | 'MATURED' | 'WITHDRAWN_EARLY' | 'RENEWED';

export type SavingsTransactionType =
  | 'OPEN'
  | 'INTEREST_PAYMENT'
  | 'PRINCIPAL_RETURN'
  | 'EARLY_WITHDRAWAL_PRINCIPAL'
  | 'EARLY_WITHDRAWAL_PENALTY'
  | 'RENEWAL_OPEN';

export interface SavingsDepositDto {
  id: number;
  clientId: number;
  clientName: string;
  linkedAccountId: number;
  linkedAccountNumber: string;
  principalAmount: number;
  currencyCode: string;
  termMonths: number;
  annualInterestRate: number;
  startDate: string;
  maturityDate: string;
  nextInterestPaymentDate: string;
  totalInterestPaid: number;
  autoRenew: boolean;
  status: SavingsDepositStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsTransactionDto {
  id: number;
  depositId: number;
  type: SavingsTransactionType;
  amount: number;
  currencyCode: string;
  processedDate: string;
  resultingTransactionId: number | null;
  description: string;
  createdAt: string;
}

export interface SavingsRateDto {
  id: number;
  currencyCode: string;
  termMonths: number;
  annualRate: number;
  active: boolean;
  effectiveFrom: string;
}

export interface OpenDepositRequest {
  sourceAccountId: number;
  linkedAccountId: number;
  principalAmount: number;
  termMonths: number;
  autoRenew: boolean;
  otpCode: string;
}

export interface ToggleAutoRenewRequest {
  autoRenew: boolean;
}

export interface WithdrawEarlyRequest {
  otpCode: string;
}

export interface UpsertRateRequest {
  currencyCode: string;
  termMonths: number;
  annualRate: number;
}

export interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const MIN_DEPOSIT_AMOUNT: Record<string, number> = {
  RSD: 10000,
  JPY: 10000,
  EUR: 100,
  USD: 100,
  CHF: 100,
  GBP: 100,
  CAD: 100,
  AUD: 100,
};

export const TERM_OPTIONS = [3, 6, 12, 24, 36] as const;

export const STATUS_LABEL_SR: Record<SavingsDepositStatus, string> = {
  ACTIVE: 'Aktivan',
  MATURED: 'Dospelo',
  WITHDRAWN_EARLY: 'Raskinuto',
  RENEWED: 'Auto-obnovljen',
};

export const TRANSACTION_TYPE_LABEL_SR: Record<SavingsTransactionType, string> = {
  OPEN: 'Otvaranje',
  INTEREST_PAYMENT: 'Mesecna kamata',
  PRINCIPAL_RETURN: 'Glavnica vracena',
  EARLY_WITHDRAWAL_PRINCIPAL: 'Raskid — glavnica',
  EARLY_WITHDRAWAL_PENALTY: 'Penal raskida',
  RENEWAL_OPEN: 'Auto-obnova',
};
