import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import listingService from './listingService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('listingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getAll ====================

  describe('getAll', () => {
    it('should fetch listings with default params', async () => {
      const mockResponse = {
        content: [{ id: 1, ticker: 'AAPL', name: 'Apple Inc', price: 175.5 }],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 0,
      };
      mockedApi.get.mockResolvedValue({ data: mockResponse });

      const result = await listingService.getAll();

      expect(mockedApi.get).toHaveBeenCalledWith('/listings', {
        params: { type: 'STOCK', search: '', page: 0, size: 20 },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should pass custom params', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: [] } });

      await listingService.getAll('FUTURES', 'oil', 2, 10);

      expect(mockedApi.get).toHaveBeenCalledWith('/listings', {
        params: { type: 'FUTURES', search: 'oil', page: 2, size: 10 },
      });
    });

    it('should fetch FOREX type', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: [] } });

      await listingService.getAll('FOREX', 'EUR', 0, 50);

      expect(mockedApi.get).toHaveBeenCalledWith('/listings', {
        params: { type: 'FOREX', search: 'EUR', page: 0, size: 50 },
      });
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Server error'));
      await expect(listingService.getAll()).rejects.toThrow('Server error');
    });
  });

  // ==================== getById ====================

  describe('getById', () => {
    it('should fetch listing by id', async () => {
      const listing = {
        id: 42,
        ticker: 'MSFT',
        name: 'Microsoft Corp',
        price: 420.0,
        listingType: 'STOCK',
        volume: 15000000,
      };
      mockedApi.get.mockResolvedValue({ data: listing });

      const result = await listingService.getById(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/listings/42');
      expect(result).toEqual(listing);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(listingService.getById(999)).rejects.toThrow('Not found');
    });
  });

  // ==================== getHistory ====================

  describe('getHistory', () => {
    it('should fetch history with default period MONTH', async () => {
      const history = [
        { date: '2026-03-01', price: 170, high: 175, low: 168, change: 2.5, volume: 1000000 },
        { date: '2026-03-02', price: 172, high: 174, low: 169, change: 1.2, volume: 900000 },
      ];
      mockedApi.get.mockResolvedValue({ data: history });

      const result = await listingService.getHistory(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/listings/42/history', {
        params: { period: 'MONTH' },
      });
      expect(result).toEqual(history);
    });

    it('should pass custom period', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await listingService.getHistory(42, 'YEAR');

      expect(mockedApi.get).toHaveBeenCalledWith('/listings/42/history', {
        params: { period: 'YEAR' },
      });
    });

    it('should handle DAY period', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await listingService.getHistory(1, 'DAY');

      expect(mockedApi.get).toHaveBeenCalledWith('/listings/1/history', {
        params: { period: 'DAY' },
      });
    });

    it('should handle FIVE_YEARS period', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await listingService.getHistory(1, 'FIVE_YEARS');

      expect(mockedApi.get).toHaveBeenCalledWith('/listings/1/history', {
        params: { period: 'FIVE_YEARS' },
      });
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('History not available'));
      await expect(listingService.getHistory(999)).rejects.toThrow('History not available');
    });
  });

  // ==================== refresh ====================

  describe('refresh', () => {
    it('should call POST /listings/refresh', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await listingService.refresh();

      // Servis salje null body i poseban timeout (do 5min) za refresh
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/listings/refresh',
        null,
        expect.objectContaining({ timeout: expect.any(Number) }),
      );
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Refresh failed'));
      await expect(listingService.refresh()).rejects.toThrow('Refresh failed');
    });
  });

  // ==================== getOptions ====================

  describe('getOptions', () => {
    it('should fetch options chain for a listing', async () => {
      const options = [
        {
          settlementDate: '2026-06-20',
          calls: [{ id: 1, strikePrice: 180, bid: 5.0, ask: 5.5, price: 5.25, volume: 1000, openInterest: 500, impliedVolatility: 0.3, inTheMoney: true }],
          puts: [{ id: 2, strikePrice: 180, bid: 3.0, ask: 3.5, price: 3.25, volume: 800, openInterest: 400, impliedVolatility: 0.25, inTheMoney: false }],
          currentStockPrice: 175.5,
        },
      ];
      mockedApi.get.mockResolvedValue({ data: options });

      const result = await listingService.getOptions(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/options', {
        params: { stockListingId: 42 },
      });
      expect(result).toEqual(options);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Options not available'));
      await expect(listingService.getOptions(999)).rejects.toThrow('Options not available');
    });
  });

  // ==================== exerciseOption ====================

  describe('exerciseOption', () => {
    it('should exercise an option', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await listingService.exerciseOption(15);

      expect(mockedApi.post).toHaveBeenCalledWith('/options/15/exercise');
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Exercise failed'));
      await expect(listingService.exerciseOption(999)).rejects.toThrow('Exercise failed');
    });
  });
});
