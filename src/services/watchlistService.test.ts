import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { watchlistService } from './watchlistService';
import type { WatchlistDto, WatchlistItemDto } from '../types/watchlist';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('watchlistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listMyWatchlists', () => {
    it('GET /watchlists and returns list', async () => {
      const lists: WatchlistDto[] = [
        {
          id: 1,
          ownerId: 10,
          ownerType: 'CLIENT',
          name: 'Favoriti',
          createdAt: '2026-05-25T10:00:00Z',
        },
      ];
      mockedApi.get.mockResolvedValue({ data: lists });

      const result = await watchlistService.listMyWatchlists();

      expect(mockedApi.get).toHaveBeenCalledWith('/watchlists');
      expect(result).toEqual(lists);
    });

    it('propagates errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));
      await expect(watchlistService.listMyWatchlists()).rejects.toThrow('Network error');
    });
  });

  describe('createWatchlist', () => {
    it('POST /watchlists with name payload', async () => {
      const created: WatchlistDto = {
        id: 2,
        ownerId: 10,
        ownerType: 'CLIENT',
        name: 'Tech',
        createdAt: '2026-05-25T10:00:00Z',
      };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await watchlistService.createWatchlist({ name: 'Tech' });

      expect(mockedApi.post).toHaveBeenCalledWith('/watchlists', { name: 'Tech' });
      expect(result).toEqual(created);
    });
  });

  describe('renameWatchlist', () => {
    it('PATCH /watchlists/{id} with new name', async () => {
      const renamed: WatchlistDto = {
        id: 1,
        ownerId: 10,
        ownerType: 'CLIENT',
        name: 'New name',
        createdAt: '2026-05-25T10:00:00Z',
      };
      mockedApi.patch.mockResolvedValue({ data: renamed });

      const result = await watchlistService.renameWatchlist(1, { name: 'New name' });

      expect(mockedApi.patch).toHaveBeenCalledWith('/watchlists/1', { name: 'New name' });
      expect(result).toEqual(renamed);
    });
  });

  describe('deleteWatchlist', () => {
    it('DELETE /watchlists/{id}', async () => {
      mockedApi.delete.mockResolvedValue({ data: undefined });

      await watchlistService.deleteWatchlist(5);

      expect(mockedApi.delete).toHaveBeenCalledWith('/watchlists/5');
    });
  });

  describe('listItems', () => {
    // P1-fe-contracts-1: BE salje `ticker`/`securityType`/`exchangeName`/
    // `dailyChange` — servis ih normalizuje u FE-friendly oblik.
    it('GET /watchlists/{id}/items and maps BE field names', async () => {
      const beItems = [
        {
          id: 10,
          watchlistId: 1,
          listingId: 100,
          ticker: 'AAPL',
          securityType: 'STOCK',
          exchangeName: 'NASDAQ',
          currentPrice: 180,
          dailyChange: 5,
          volume: 1000,
          addedAt: '2026-05-25T10:00:00Z',
        },
      ];
      mockedApi.get.mockResolvedValue({ data: beItems });

      const result = await watchlistService.listItems(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/watchlists/1/items');
      expect(result[0].listingTicker).toBe('AAPL');
      expect(result[0].listingType).toBe('STOCK');
      expect(result[0].exchange).toBe('NASDAQ');
      expect(result[0].dailyChange).toBe(5);
      // dailyChangePercent = 5 / (180 - 5) * 100 ≈ 2.857
      expect(result[0].dailyChangePercent).toBeCloseTo(2.857, 2);
      expect(result[0].volume).toBe(1000);
    });

    it('handles null/empty item list', async () => {
      mockedApi.get.mockResolvedValue({ data: null });
      const result = await watchlistService.listItems(1);
      expect(result).toEqual([]);
    });
  });

  describe('addItem', () => {
    it('POST /watchlists/{id}/items with listingId and maps response', async () => {
      const beItem = {
        id: 11,
        watchlistId: 1,
        listingId: 101,
        ticker: 'MSFT',
        securityType: 'STOCK',
        addedAt: '2026-05-25T10:00:00Z',
      };
      mockedApi.post.mockResolvedValue({ data: beItem });

      const result: WatchlistItemDto = await watchlistService.addItem(1, { listingId: 101 });

      expect(mockedApi.post).toHaveBeenCalledWith('/watchlists/1/items', { listingId: 101 });
      expect(result.listingTicker).toBe('MSFT');
      expect(result.listingType).toBe('STOCK');
    });

    it('propagates 409 conflict', async () => {
      mockedApi.post.mockRejectedValue(new Error('Conflict'));
      await expect(watchlistService.addItem(1, { listingId: 1 })).rejects.toThrow('Conflict');
    });
  });

  describe('removeItem', () => {
    // P1-fe-contracts-1: BE path var je listingId (ne item PK).
    it('DELETE /watchlists/{id}/items/{listingId}', async () => {
      mockedApi.delete.mockResolvedValue({ data: undefined });

      await watchlistService.removeItem(1, 100);

      expect(mockedApi.delete).toHaveBeenCalledWith('/watchlists/1/items/100');
    });
  });
});
