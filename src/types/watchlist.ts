// ============================================================
// FE2 - Watchlist + cenovni alarmi | Developer: Antonije Ilic
//
// Tipovi za Watchlist feature: liste pracenja i njihove stavke sa trzisnim podacima.
// Spec: Zadaci_Frontend.pdf, FE2.
// ============================================================

import type { ListingType } from './celina3';

export type WatchlistOwnerType = 'CLIENT' | 'EMPLOYEE';

/**
 * Jedna lista pracenja (Watchlist) korisnika.
 * R1 811: polja oblikovana tacno po BE `WatchlistDto.java` (id/ownerId/ownerType/
 * name/itemCount/createdAt). Ranija phantom polja `description`/`updatedAt` BE
 * nikad ne salje — uklonjena.
 */
export interface WatchlistDto {
  id: number;
  ownerId: number;
  ownerType: WatchlistOwnerType;
  name: string;
  createdAt: string;
  itemCount?: number;
}

/**
 * Sirovi oblik BE odgovora (`WatchlistItemDto.java`) — kljucevi se razlikuju
 * od FE-friendly oblika (BE: `ticker`/`securityType`/`exchangeName`, NEMA
 * `dailyChangePercent` ni `currency`). `watchlistService` ga normalizuje u
 * {@link WatchlistItemDto} pre nego sto stigne do stranice.
 */
export interface WatchlistItemRawDto {
  id: number;
  watchlistId: number;
  listingId: number;
  ticker?: string;
  listingName?: string;
  securityType?: ListingType | string;
  exchangeName?: string;
  currentPrice?: number | null;
  dailyChange?: number | null;
  volume?: number | null;
  addedAt: string;
}

/** Stavka u listi pracenja (hartija + trzisni podaci) — FE-normalizovan oblik. */
export interface WatchlistItemDto {
  id: number;
  watchlistId: number;
  listingId: number;
  listingTicker: string;
  listingType: ListingType | string;
  listingName?: string;
  exchange?: string;
  currentPrice?: number | null;
  dailyChange?: number | null;
  dailyChangePercent?: number | null;
  volume?: number | null;
  currency?: string;
  addedAt: string;
}

/** Payload za POST /watchlists. */
export interface CreateWatchlistRequest {
  name: string;
}

/** Payload za PATCH /watchlists/{id}. */
export interface RenameWatchlistRequest {
  name: string;
}

/** Payload za POST /watchlists/{id}/items. */
export interface AddWatchlistItemRequest {
  listingId: number;
}

/** Union za filter dropdown na WatchlistPage tabeli. */
export type WatchlistFilterType = 'ALL' | 'STOCK' | 'FUTURES' | 'FOREX' | 'OPTION';

/** Srpske labele za filter dropdown. */
export const WATCHLIST_FILTER_LABELS: Record<WatchlistFilterType, string> = {
  ALL: 'Sve',
  STOCK: 'Akcije',
  FUTURES: 'Fjucersi',
  FOREX: 'Valute',
  OPTION: 'Opcije',
};
