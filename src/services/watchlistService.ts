// ============================================================
// FE2 - Watchlist + cenovni alarmi | Developer: Antonije Ilic
//
// Servis za CRUD operacije nad listama pracenja i njihovim stavkama.
// Koristi `api` klijent (axios instanca sa JWT interceptorima).
//
// Spec: Zadaci_Frontend.pdf, FE2.
// ============================================================

import api from './api';
import type {
  WatchlistDto,
  WatchlistItemDto,
  WatchlistItemRawDto,
  CreateWatchlistRequest,
  RenameWatchlistRequest,
  AddWatchlistItemRequest,
} from '../types/watchlist';

/**
 * P1-fe-contracts-1: BE `WatchlistItemDto` koristi `ticker`/`securityType`/
 * `exchangeName`/`dailyChange` i NEMA `dailyChangePercent` ni `currency`.
 * Stranica renderuje `listingTicker`/`listingType`/`dailyChangePercent` — bez
 * ovog mapiranja ticker/tip/promena su bili prazni. `dailyChangePercent`
 * izvodimo iz `dailyChange` i prethodne cene (currentPrice - dailyChange).
 */
function mapWatchlistItem(raw: WatchlistItemRawDto): WatchlistItemDto {
  const current = raw.currentPrice ?? null;
  const change = raw.dailyChange ?? null;
  let dailyChangePercent: number | null = null;
  if (current != null && change != null) {
    const prevClose = current - change;
    if (prevClose > 0) dailyChangePercent = (change / prevClose) * 100;
  }
  return {
    id: raw.id,
    watchlistId: raw.watchlistId,
    listingId: raw.listingId,
    listingTicker: raw.ticker ?? '',
    listingType: raw.securityType ?? '',
    listingName: raw.listingName,
    exchange: raw.exchangeName,
    currentPrice: current,
    dailyChange: change,
    dailyChangePercent,
    volume: raw.volume ?? null,
    addedAt: raw.addedAt,
  };
}

export const watchlistService = {
  listMyWatchlists: async (): Promise<WatchlistDto[]> => {
    const { data } = await api.get<WatchlistDto[]>('/watchlists');
    return data;
  },

  createWatchlist: async (request: CreateWatchlistRequest): Promise<WatchlistDto> => {
    const { data } = await api.post<WatchlistDto>('/watchlists', request);
    return data;
  },

  renameWatchlist: async (id: number, request: RenameWatchlistRequest): Promise<WatchlistDto> => {
    const { data } = await api.patch<WatchlistDto>(`/watchlists/${id}`, request);
    return data;
  },

  deleteWatchlist: async (id: number): Promise<void> => {
    await api.delete(`/watchlists/${id}`);
  },

  listItems: async (watchlistId: number): Promise<WatchlistItemDto[]> => {
    const { data } = await api.get<WatchlistItemRawDto[]>(`/watchlists/${watchlistId}/items`);
    return (data ?? []).map(mapWatchlistItem);
  },

  addItem: async (
    watchlistId: number,
    request: AddWatchlistItemRequest
  ): Promise<WatchlistItemDto> => {
    const { data } = await api.post<WatchlistItemRawDto>(
      `/watchlists/${watchlistId}/items`,
      request
    );
    return mapWatchlistItem(data);
  },

  /**
   * P1-fe-contracts-1: BE ruta je `DELETE /watchlists/{id}/items/{listingId}`
   * (path var je listingId, NE item PK) — ranije je FE slao item.id pa je
   * brisao pogresnu stavku ili dobijao 404.
   */
  removeItem: async (watchlistId: number, listingId: number): Promise<void> => {
    await api.delete(`/watchlists/${watchlistId}/items/${listingId}`);
  },
};

export default watchlistService;
