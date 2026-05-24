export interface WatchlistDto {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface WatchlistItemDto {
  id: number;
  watchlistId: number;
  listingId: number;
  ticker: string;
  name: string;
  exchange: string;
  listingType: string;
  currentPrice: number | null;
  priceChange: number | null;
  priceChangePct: number | null;
  volume: number | null;
  currency: string;
  addedAt: string;
}

export interface CreateWatchlistRequest {
  name: string;
  description?: string;
}

export interface RenameWatchlistRequest {
  name: string;
}

export interface AddToWatchlistRequest {
  listingId: number;
}

export type WatchlistFilterType = 'ALL' | 'STOCK' | 'FUTURE' | 'OPTION' | 'FOREX';

export const WATCHLIST_FILTER_LABELS: Record<WatchlistFilterType, string> = {
  ALL: 'Sve',
  STOCK: 'Akcije',
  FUTURE: 'Fjucersi',
  OPTION: 'Opcije',
  FOREX: 'Valute',
};

export function matchesWatchlistFilter(listingType: string, filter: WatchlistFilterType): boolean {
  if (filter === 'ALL') return true;
  const t = listingType.toUpperCase();
  if (filter === 'STOCK') return t === 'STOCK';
  if (filter === 'FUTURE') return t === 'FUTURE' || t === 'FUTURES';
  if (filter === 'OPTION') return t === 'OPTION' || t === 'OPTIONS';
  if (filter === 'FOREX') return t === 'FOREX';
  return true;
}
