import api from './api';

// P1-fe-contracts-1: uskladjeno sa STVARNIM BE `MarginAccountDto.java`.
// BE salje `accountId`/`accountNumber`/`userId`/`companyId`/`createdAt` i NE
// salje `linkedAccountNumber` ni `currency` (margin racuni su RSD po Marzni
// modelu) — ranija polja su uvek bila prazna na UI-u.
export interface MarginAccount {
  id: number;
  accountId: number;
  accountNumber: string;
  userId: number | null;
  companyId: number | null;
  status: 'ACTIVE' | 'BLOCKED';
  initialMargin: number;
  loanValue: number;
  maintenanceMargin: number;
  bankParticipation: number;
  createdAt?: string;
}

/** Margin racuni su RSD-denominirani (Marzni_Racuni.txt). BE ne salje valutu. */
export const MARGIN_CURRENCY = 'RSD';

/**
 * Tip margin transakcije — 1:1 sa BE `MarginTransactionType.java`.
 * DEPOSIT/WITHDRAWAL su rucne uplate/isplate; BUY/SELL su trgovinske transakcije
 * pokrenute kroz order engine. Ranije je FE poznavao samo DEPOSIT/WITHDRAWAL pa
 * su BUY/SELL padali u else-granu i prikazivali se kao "Isplata" sa minusom.
 */
export type MarginTransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'BUY' | 'SELL';

// BE `MarginTransactionDto.java` salje: id, marginAccountId, type (String),
// amount, description, createdAt. NEMA `currency` (margin racuni su RSD-only) —
// ranije renderovano `txn.currency` je uvek bilo undefined.
export interface MarginTransaction {
  id: number;
  marginAccountId: number;
  type: MarginTransactionType;
  amount: number;
  createdAt: string;
  description?: string;
}

const marginService = {
  /**
   * GET /margin-accounts/my
   * Dohvata marzne racune trenutnog korisnika.
   */
  getMyAccounts: async (): Promise<MarginAccount[]> => {
    const response = await api.get('/margin-accounts/my');
    return response.data;
  },

  /**
   * POST /margin-accounts/{id}/deposit
   * Uplata na marzni racun.
   */
  deposit: async (id: number, amount: number): Promise<void> => {
    await api.post(`/margin-accounts/${id}/deposit`, { amount });
  },

  /**
   * POST /margin-accounts/{id}/withdraw
   * Isplata sa marznog racuna.
   */
  withdraw: async (id: number, amount: number): Promise<void> => {
    await api.post(`/margin-accounts/${id}/withdraw`, { amount });
  },

  /**
   * GET /margin-accounts/{id}/transactions
   * Dohvata istoriju transakcija za marzni racun.
   */
  getTransactions: async (id: number): Promise<MarginTransaction[]> => {
    const response = await api.get(`/margin-accounts/${id}/transactions`);
    return response.data;
  },
};

export default marginService;
