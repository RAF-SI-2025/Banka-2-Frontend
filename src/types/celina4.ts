/**
 * TypeScript tipovi za Celinu 4 (fondovi + OTC + Profit Banke + inter-bank placanja).
 * Polja odgovaraju 1-na-1 odgovarajucim BE DTO recordima.
 *
 * Spec ref: Celina 4 (investicioni fondovi 160-351, inter-bank OTC 438-519,
 * placanja 368-437, Profit Banke 353-364).
 */

// ── INVESTICIONI FONDOVI ──────────────────────────────────────────────────

export interface InvestmentFundSummary {
  id: number;
  name: string;
  description: string;
  minimumContribution: number;
  fundValue: number;
  profit: number;
  managerName: string;
  inceptionDate: string; // ISO date
}

export interface InvestmentFundDetail {
  id: number;
  name: string;
  description: string;
  managerName: string;
  managerEmployeeId: number;
  fundValue: number;
  liquidAmount: number;
  profit: number;
  minimumContribution: number;
  accountNumber: string;
  holdings: FundHolding[];
  performance: FundPerformancePoint[];
  inceptionDate: string;
}

export interface FundHolding {
  listingId: number;
  ticker: string;
  name: string;
  quantity: number;
  currentPrice: number;
  change: number;
  volume: number;
  initialMarginCost: number;
  acquisitionDate: string;
}

export interface FundPerformancePoint {
  date: string;
  fundValue: number;
  profit: number;
}

export interface CreateFundRequest {
  name: string;
  description: string;
  minimumContribution: number;
}

export interface InvestFundRequest {
  amount: number;
  currency: string;
  sourceAccountId: number;
}

export interface WithdrawFundRequest {
  /** null / undefined znaci "povuci celu poziciju" (spec linija 342) */
  amount?: number;
  destinationAccountId: number;
}

export interface ClientFundPosition {
  id: number;
  fundId: number;
  fundName: string;
  userId: number;
  userRole: 'CLIENT' | 'BANK';
  userName: string;
  totalInvested: number;
  currentValue: number;
  percentOfFund: number;
  profit: number;
  lastModifiedAt: string;
}

export type ClientFundTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface ClientFundTransaction {
  id: number;
  fundId: number;
  fundName: string;
  userId: number;
  userName: string;
  amountRsd: number;
  sourceAccountNumber: string;
  inflow: boolean;
  status: ClientFundTransactionStatus;
  createdAt: string;
  completedAt?: string | null;
  failureReason?: string | null;
}


// ── OTC INTER-BANK ────────────────────────────────────────────────────────

export interface OtcInterbankListing {
  bankCode: string;
  sellerPublicId: string;
  sellerName: string;
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  currentPrice: number;
  availableQuantity: number;
  /**
   * Spec Celina 5 (Nova) §840-848: "Klijenti vide ponude Klijenata, Aktuari
   * vide ponude Aktuara." Polje je opciono jer profesorov bank-to-bank protokol
   * §3.1 (`GET /public-stock`) ne nudi role discovery — partner banke koje
   * dodaju ovo polje kao extension nas FE moze precizno filtrirati. Ako polje
   * nije prisutno, FE prikazuje listing (defensive fallback) i oslanja se na
   * BE acceptOffer guard koji vraca 400 za cross-role pokusaje.
   */
  sellerRole?: 'CLIENT' | 'EMPLOYEE';
}

export type OtcInterbankOfferStatus = 'ACTIVE' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type OtcInterbankContractStatus = 'ACTIVE' | 'EXERCISED' | 'EXPIRED';

export interface OtcInterbankOffer {
  offerId: string; // UUID, isti kod obe banke
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  currentPrice: number;

  buyerBankCode: string;
  buyerUserId: string;
  buyerName: string;

  sellerBankCode: string;
  sellerUserId: string;
  sellerName: string;

  quantity: number;
  pricePerStock: number;
  premium: number;
  settlementDate: string;

  waitingOnBankCode: string;
  waitingOnUserId: string;
  myTurn: boolean;

  status: OtcInterbankOfferStatus;
  lastModifiedAt: string;
  lastModifiedByName: string;
}

export interface CreateOtcInterbankOfferRequest {
  sellerBankCode: string;
  sellerUserId: string;
  listingTicker: string;
  quantity: number;
  pricePerStock: number;
  premium: number;
  settlementDate: string;
}

export interface CounterOtcInterbankOfferRequest {
  offerId: string;
  quantity: number;
  pricePerStock: number;
  premium: number;
  settlementDate: string;
}

/**
 * Privremeni FE tip za inter-bank OTC contract dok BE ne objavi eksplicitan
 * DTO. Polja su izvedena iz intra-bank contract oblika + inter-bank offer
 * identifikatora (`contractId`/user IDs kao string).
 */
export interface OtcInterbankContract {
  id: string;
  listingId: number;
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  buyerUserId: string;
  buyerBankCode: string;
  buyerName: string;
  sellerUserId: string;
  sellerBankCode: string;
  sellerName: string;
  quantity: number;
  strikePrice: number;
  premium: number;
  currentPrice: number;
  settlementDate: string;
  status: OtcInterbankContractStatus;
  createdAt: string;
  exercisedAt?: string | null;
}

export type InterbankTransactionType = 'PAYMENT' | 'OTC';

export interface InterbankTransaction {
  id: number;
  transactionId: string;
  type: InterbankTransactionType;
  status: InterbankPaymentStatus;
  currentPhase?: string | null;
  senderBankCode: string;
  receiverBankCode: string;
  amount?: number | null;
  currency?: string | null;
  convertedAmount?: number | null;
  convertedCurrency?: string | null;
  exchangeRate?: number | null;
  commissionAmount?: number | null;
  senderAccountNumber?: string | null;
  receiverAccountNumber?: string | null;
  reservedAmount?: number | null;
  listingTicker?: string | null;
  quantity?: number | null;
  strikePrice?: number | null;
  createdAt: string;
  preparedAt?: string | null;
  committedAt?: string | null;
  abortedAt?: string | null;
  lastRetryAt?: string | null;
  retryCount: number;
  // Spec Celina 5 (Nova): BE moze (opciono) da posalje strukturisani razlog
  // koji FE mapira kroz ERROR_CODE_MESSAGES (interbankPaymentService.ts).
  // Ako BE salje samo `failureReason` string, FE ga prosledjuje direktno.
  failureReason?: string | null;
  rejectionReason?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
}


// ── INTER-BANK PLACANJE ───────────────────────────────────────────────────

export type InterbankPaymentStatus =
  | 'INITIATED'
  | 'PREPARING'
  | 'PREPARED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'ABORTING'
  | 'ABORTED'
  | 'STUCK';

/** Statusi posle kojih nema vise tranzicija — koristi se za polling break-out
 *  i za "Zatvori" dugme u statusnom modal-u (Spec Celina 5 (Nova) §75-90). */
export const INTERBANK_TERMINAL_STATUSES: readonly InterbankPaymentStatus[] = [
  'COMMITTED',
  'ABORTED',
  'STUCK',
] as const;

export const isInterbankTerminalStatus = (status: InterbankPaymentStatus): boolean =>
  (INTERBANK_TERMINAL_STATUSES as readonly string[]).includes(status);

export interface InterbankPaymentInitiateRequest {
  senderAccountNumber: string;
  receiverAccountNumber: string;
  receiverName: string;
  amount: number;
  currency: string;
  description?: string;
  otpCode: string;
}

export interface InterbankPayment {
  id: number;
  transactionId: string;
  status: InterbankPaymentStatus;
  senderAccountNumber: string;
  receiverAccountNumber: string;
  amount: number;
  currency: string;
  convertedAmount?: number | null;
  convertedCurrency?: string | null;
  exchangeRate?: number | null;
  commissionAmount?: number | null;
  createdAt: string;
  preparedAt?: string | null;
  committedAt?: string | null;
  abortedAt?: string | null;
  failureReason?: string | null;
}


// ── PROFIT BANKE ──────────────────────────────────────────────────────────

export interface ActuaryProfit {
  employeeId: number;
  name: string;
  position: 'SUPERVISOR' | 'AGENT';
  totalProfitRsd: number;
  ordersDone: number;
}

export interface BankFundPosition {
  fundId: number;
  fundName: string;
  managerName: string;
  percentShare: number;
  rsdValue: number;
  profitRsd: number;
}
