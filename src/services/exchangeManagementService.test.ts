import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import exchangeManagementService from './exchangeManagementService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('exchangeManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getAll ====================

  describe('getAll', () => {
    it('should fetch all exchanges', async () => {
      const exchanges = [
        {
          id: 1,
          name: 'New York Stock Exchange',
          acronym: 'NYSE',
          micCode: 'XNYS',
          country: 'USA',
          currency: 'USD',
          timeZone: 'America/New_York',
          openTime: '09:30',
          closeTime: '16:00',
          isOpen: true,
        },
        {
          id: 2,
          name: 'NASDAQ',
          acronym: 'NASDAQ',
          micCode: 'XNAS',
          country: 'USA',
          currency: 'USD',
          timeZone: 'America/New_York',
          openTime: '09:30',
          closeTime: '16:00',
          isOpen: false,
        },
      ];
      mockedApi.get.mockResolvedValue({ data: exchanges });

      const result = await exchangeManagementService.getAll();

      expect(mockedApi.get).toHaveBeenCalledWith('/exchanges');
      expect(result).toEqual(exchanges);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no exchanges', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      const result = await exchangeManagementService.getAll();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Server error'));
      await expect(exchangeManagementService.getAll()).rejects.toThrow('Server error');
    });
  });

  // ==================== getByAcronym ====================

  describe('getByAcronym', () => {
    it('should fetch exchange by acronym', async () => {
      const exchange = {
        id: 1,
        name: 'New York Stock Exchange',
        acronym: 'NYSE',
        micCode: 'XNYS',
        country: 'USA',
        currency: 'USD',
        timeZone: 'America/New_York',
        openTime: '09:30',
        closeTime: '16:00',
        isOpen: true,
        testMode: false,
      };
      mockedApi.get.mockResolvedValue({ data: exchange });

      const result = await exchangeManagementService.getByAcronym('NYSE');

      expect(mockedApi.get).toHaveBeenCalledWith('/exchanges/NYSE');
      expect(result).toEqual(exchange);
    });

    it('should handle different acronyms', async () => {
      mockedApi.get.mockResolvedValue({ data: { acronym: 'BELEX', name: 'Beogradska berza' } });

      const result = await exchangeManagementService.getByAcronym('BELEX');

      expect(mockedApi.get).toHaveBeenCalledWith('/exchanges/BELEX');
      expect(result.acronym).toBe('BELEX');
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(exchangeManagementService.getByAcronym('INVALID')).rejects.toThrow('Not found');
    });
  });

  // ==================== setTestMode ====================

  describe('setTestMode', () => {
    it('should enable test mode', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await exchangeManagementService.setTestMode('NYSE', true);

      expect(mockedApi.patch).toHaveBeenCalledWith('/exchanges/NYSE/test-mode', { enabled: true });
    });

    it('should disable test mode', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await exchangeManagementService.setTestMode('NYSE', false);

      expect(mockedApi.patch).toHaveBeenCalledWith('/exchanges/NYSE/test-mode', { enabled: false });
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Forbidden'));
      await expect(exchangeManagementService.setTestMode('NYSE', true)).rejects.toThrow('Forbidden');
    });
  });
});
