// ============================================================
// Tipovi za Banka 2025 - Celina 3: Trgovina na berzi
// ============================================================

// --- Enum-like konstante + tipovi (kompatibilno sa erasableSyntaxOnly) ---

export const ListingType = {
  STOCK: 'STOCK',
  FUTURES: 'FUTURES',
  FOREX: 'FOREX',
} as const;

export type ListingType = (typeof ListingType)[keyof typeof ListingType];

export const OrderType = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT',
} as const;

export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderDirection = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;

export type OrderDirection = (typeof OrderDirection)[keyof typeof OrderDirection];

export const OrderStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  DONE: 'DONE',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ActuaryType = {
  AGENT: 'AGENT',
  SUPERVISOR: 'SUPERVISOR',
} as const;

export type ActuaryType = (typeof ActuaryType)[keyof typeof ActuaryType];

// --- Hartije od vrednosti ---

export interface Listing {
  id: number;
  ticker: string;
  name: string;
  exchangeAcronym: string;
  listingType: ListingType;
  price: number;
  ask: number;
  bid: number;
  volume: number;
  priceChange: number;
  changePercent: number;
  initialMarginCost: number;
  maintenanceMargin: number;
  // Stock-specific
  outstandingShares?: number;
  dividendYield?: number;
  marketCap?: number;
  // Forex-specific
  baseCurrency?: string;
  quoteCurrency?: string;
  liquidity?: string;
  // Futures-specific
  contractSize?: number;
  contractUnit?: string;
  settlementDate?: string;
  // True kad je berza u test modu — backend tada simulira cene umesto da
  // gadja Alpha Vantage / fixer.io, a FE pokazuje "SIMULIRANI PODACI" badge.
  isTestMode?: boolean;
}

export interface ListingDailyPrice {
  date: string;
  price: number;
  high: number;
  low: number;
  change: number;
  volume: number;
}

// --- Orderi ---

export interface Order {
  id: number;
  listingId: number;
  userName: string;
  userRole: string;
  listingTicker: string;
  listingName: string;
  listingType: string;
  orderType: OrderType;
  quantity: number;
  contractSize: number;
  pricePerUnit: number;
  limitValue?: number;
  stopValue?: number;
  direction: OrderDirection;
  status: OrderStatus;
  approvedBy: string;
  isDone: boolean;
  remainingPortions: number;
  afterHours: boolean;
  allOrNone: boolean;
  margin: boolean;
  approximatePrice: number;
  accountId?: number;
  createdAt: string;
  lastModification: string;
  listingSettlementDate?: string;
  /** Provizija menjacnice u valuti racuna (0 ili null ako nije bila primenjena). */
  fxCommission?: number;
  /** Srednji kurs listing->account currency u trenutku rezervacije. */
  exchangeRate?: number;
}

export interface CreateOrderRequest {
  listingId: number;
  fundId?: number;
  orderType: string;
  quantity: number;
  contractSize?: number;
  direction: string;
  limitValue?: number;
  stopValue?: number;
  allOrNone: boolean;
  margin: boolean;
  accountId?: number;
  otpCode?: string;
}

// --- Aktuari ---

export interface ActuaryInfo {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  employeePosition: string;
  actuaryType: ActuaryType;
  dailyLimit: number;
  usedLimit: number;
  needApproval: boolean;
}

export interface UpdateActuaryLimit {
  dailyLimit?: number;
  needApproval?: boolean;
}

// --- Portfolio ---

export interface PortfolioItem {
  id: number;
  listingId: number;
  listingTicker: string;
  listingName: string;
  listingType: ListingType;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  profit: number;
  profitPercent: number;
  publicQuantity: number;
  lastModified: string;
  settlementDate?: string;
  inTheMoney?: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  totalProfit: number;
  paidTaxThisYear: number;
  unpaidTaxThisMonth: number;
}

// --- Porez ---

export interface TaxRecord {
  id?: number;
  userId: number;
  userName: string;
  userType: string; // 'CLIENT' | 'EMPLOYEE'
  totalProfit: number;
  taxOwed: number;
  taxPaid: number;
  currency: string;
}

/**
 * Detaljni breakdown poreske obaveze korisnika — koje SELL transakcije su
 * doprinele profitu/gubitku, sa profit per-pair (BUY-SELL) granularnoscu.
 * Spec Celina 3 linija ~525: "stranica ima detalje koje su transakcije doprinele".
 *
 * BE endpoint: GET /tax/{userId}/details?userType=CLIENT|EMPLOYEE&year=&month=
 * Ako BE jos ne implementira ovaj endpoint, FE handler hvata 404 i prikazuje
 * graceful "Detaljan prikaz nije dostupan" placeholder.
 */
export interface TaxBreakdownItem {
  orderId: number;
  listingTicker: string;
  listingType: string;
  source: 'STOCK_ORDER' | 'OTC_CONTRACT';
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  taxAmount: number;
  currency: string;
  executedAt: string;
}

export interface TaxBreakdownResponse {
  userId: number;
  userType: string;
  userName: string;
  year: number;
  month?: number;
  totalProfit: number;
  totalTax: number;
  items: TaxBreakdownItem[];
}

/**
 * Per-listing aggregisani breakdown poreske obaveze (P2.4 BE endpoint).
 * Razlika od `TaxBreakdownItem`: ova stavka je AGREGAT po listingu (ticker),
 * dok `TaxBreakdownItem` je per-transaction (orderId-level granularnost).
 *
 * BE endpoint: GET /tax/{userId}/{userType}/breakdown (supervizor only)
 *           ili GET /tax/my/breakdown (autentifikovani user)
 * Response: List<TaxBreakdownItemDto>, sortirano po taxOwed DESC.
 */
export interface TaxBreakdownItemDto {
  listingId: number;
  ticker: string;
  listingCurrency: string;
  profitNative: number;
  profitRsd: number;
  taxOwed: number;
}

// --- Berze ---

export interface Exchange {
  id: number;
  name: string;
  acronym: string;
  micCode: string;
  country: string;
  currency: string;
  timeZone: string;
  openTime: string;
  closeTime: string;
  isOpen?: boolean;
  isCurrentlyOpen?: boolean;
  currentlyOpen?: boolean;
  testMode?: boolean;
}

// --- Opcije ---

interface OptionItem {
  id: number;
  strikePrice: number;
  bid: number;
  ask: number;
  price: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionChain {
  settlementDate: string;
  calls: OptionItem[];
  puts: OptionItem[];
  currentStockPrice: number;
}

// Re-export PaginatedResponse from index to avoid duplication
export type { PaginatedResponse } from './index';

// ============================================================
// Celina 4 - OTC trgovina (intra-bank)
// ============================================================

export const OtcOfferStatus = {
  ACTIVE: 'ACTIVE',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;
export type OtcOfferStatus = (typeof OtcOfferStatus)[keyof typeof OtcOfferStatus];

export const OtcContractStatus = {
  ACTIVE: 'ACTIVE',
  EXERCISED: 'EXERCISED',
  EXPIRED: 'EXPIRED',
} as const;
export type OtcContractStatus = (typeof OtcContractStatus)[keyof typeof OtcContractStatus];

/** Akcija koju neko javno nudi na OTC tržištu unutar iste banke. */
export interface OtcListing {
  portfolioId: number;
  listingId: number;
  listingTicker: string;
  listingName: string;
  exchangeAcronym: string;
  listingCurrency: string;
  currentPrice: number;
  publicQuantity: number;
  availablePublicQuantity: number;
  sellerId: number;
  sellerRole: string;
  sellerName: string;
}

export interface OtcOffer {
  id: number;
  listingId: number;
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  quantity: number;
  pricePerStock: number;
  premium: number;
  /** Trenutna trzisna cena hartije — koristi se za bojenje odstupanja (±5 / ±20%). */
  currentPrice?: number;
  settlementDate: string;
  lastModifiedById: number;
  lastModifiedByName: string;
  waitingOnUserId: number;
  myTurn: boolean;
  status: OtcOfferStatus;
  createdAt: string;
  lastModifiedAt: string;
}

export interface OtcContract {
  id: number;
  listingId: number;
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  quantity: number;
  strikePrice: number;
  premium: number;
  currentPrice: number;
  settlementDate: string;
  status: OtcContractStatus;
  createdAt: string;
  exercisedAt?: string;
}

export interface CreateOtcOfferRequest {
  listingId: number;
  sellerId: number;
  quantity: number;
  pricePerStock: number;
  premium: number;
  settlementDate: string;
}

export interface CounterOtcOfferRequest {
  quantity: number;
  pricePerStock: number;
  premium: number;
  settlementDate: string;
}
