/*
================================================================================
 TODO — TYPESCRIPT TIPOVI ZA CELINU 4 (FONDOVI + INTER-BANK)
 Zaduzeni (podela):
   - Investicioni fondovi (InvestmentFund*, ClientFundPosition*, Transaction) → jkrunic
   - OTC inter-bank (OtcInterbank*) → ekalajdzic13322
   - Profit banke (ActuaryProfit, BankFundPosition) → sssmarta
   - Inter-bank placanje (InterbankPayment*) → antonije3
 Spec referenca: Celina 4 (investicioni fondovi linije 160-351, inter-bank
                  OTC 438-519, placanja 368-437, Profit Banke 353-364)
--------------------------------------------------------------------------------
 Tim napomena:
  - Svaki tim (FE) popunjava svoj segment. Backend DTO vec postoji kao
    referenca u `Banka-2-Backend/.../dto/...`. Polja ispod odgovaraju 1-na-1.
  - Pre popunjavanja, uskladjuje se sa BE tim-om da se polja poklope.
================================================================================
*/

// ── INVESTICIONI FONDOVI (Zaduzen: jkrunic) ───────────────────────────────

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


// ── OTC INTER-BANK (Zaduzen: ekalajdzic13322) ─────────────────────────────

export interface OtcInterbankListing {
  bankCode: string;
  sellerPublicId: string;
  sellerName: string;
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  currentPrice: number;
  availableQuantity: number;
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
  failureReason?: string | null;
}


// ── INTER-BANK PLACANJE (Zaduzen: antonije3) ──────────────────────────────

export type InterbankPaymentStatus =
  | 'INITIATED'
  | 'PREPARING'
  | 'PREPARED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'ABORTING'
  | 'ABORTED'
  | 'STUCK';

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


// ── PROFIT BANKE (Zaduzen: sssmarta) ──────────────────────────────────────

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
