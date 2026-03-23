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
  createdAt: string;
  lastModification: string;
}

export interface CreateOrderRequest {
  listingId: number;
  orderType: string;
  quantity: number;
  direction: string;
  limitValue?: number;
  stopValue?: number;
  allOrNone: boolean;
  margin: boolean;
  accountId: number;
}

// --- Aktuari ---

export interface ActuaryInfo {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
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
}

export interface PortfolioSummary {
  totalValue: number;
  totalProfit: number;
  paidTaxThisYear: number;
  unpaidTaxThisMonth: number;
}

// --- Porez ---

export interface TaxRecord {
  userId: number;
  userName: string;
  userType: string; // 'CLIENT' | 'EMPLOYEE'
  totalProfit: number;
  taxOwed: number;
  taxPaid: number;
  currency: string;
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
  isOpen: boolean;
}

// --- Opcije ---

export interface StockOption {
  id: number;
  ticker: string;
  stockTicker: string;
  optionType: 'CALL' | 'PUT';
  strikePrice: number;
  impliedVolatility: number;
  openInterest: number;
  settlementDate: string;
  price: number;
  ask: number;
  bid: number;
  volume: number;
}

// --- Paginated response ---

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
