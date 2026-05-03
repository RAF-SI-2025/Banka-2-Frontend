import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import taxService from './taxService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('taxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getTaxRecords ====================

  describe('getTaxRecords', () => {
    it('should fetch tax records without filters', async () => {
      const records = [
        { id: 1, userId: 10, userName: 'Marko Petrovic', userType: 'CLIENT', totalProfit: 50000, taxOwed: 7500, taxPaid: 5000, currency: 'RSD' },
      ];
      mockedApi.get.mockResolvedValue({ data: records });

      const result = await taxService.getTaxRecords();

      expect(mockedApi.get).toHaveBeenCalledWith('/tax', { params: {} });
      expect(result).toEqual(records);
    });

    it('should pass userType filter', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await taxService.getTaxRecords('CLIENT');

      expect(mockedApi.get).toHaveBeenCalledWith('/tax', {
        params: { userType: 'CLIENT' },
      });
    });

    it('should pass name filter', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await taxService.getTaxRecords(undefined, 'Marko');

      expect(mockedApi.get).toHaveBeenCalledWith('/tax', {
        params: { name: 'Marko' },
      });
    });

    it('should pass both filters', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await taxService.getTaxRecords('EMPLOYEE', 'Jovan');

      expect(mockedApi.get).toHaveBeenCalledWith('/tax', {
        params: { userType: 'EMPLOYEE', name: 'Jovan' },
      });
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Forbidden'));
      await expect(taxService.getTaxRecords()).rejects.toThrow('Forbidden');
    });
  });

  // ==================== triggerCalculation ====================

  describe('triggerCalculation', () => {
    it('should trigger tax calculation', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await taxService.triggerCalculation();

      expect(mockedApi.post).toHaveBeenCalledWith('/tax/calculate');
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Calculation failed'));
      await expect(taxService.triggerCalculation()).rejects.toThrow('Calculation failed');
    });
  });

  // ==================== getTaxBreakdown ====================

  describe('getTaxBreakdown', () => {
    it('should fetch breakdown bez year/month', async () => {
      const breakdown = {
        userId: 10,
        userType: 'CLIENT',
        totalProfit: 50000,
        taxOwed: 7500,
        items: [],
      };
      mockedApi.get.mockResolvedValue({ data: breakdown });

      const result = await taxService.getTaxBreakdown(10, 'CLIENT');

      expect(mockedApi.get).toHaveBeenCalledWith('/tax/10/details', {
        params: { userType: 'CLIENT' },
      });
      expect(result).toEqual(breakdown);
    });

    it('should pass year', async () => {
      mockedApi.get.mockResolvedValue({ data: {} });

      await taxService.getTaxBreakdown(10, 'CLIENT', 2026);

      expect(mockedApi.get).toHaveBeenCalledWith('/tax/10/details', {
        params: { userType: 'CLIENT', year: '2026' },
      });
    });

    it('should pass month', async () => {
      mockedApi.get.mockResolvedValue({ data: {} });

      await taxService.getTaxBreakdown(10, 'EMPLOYEE', undefined, 5);

      expect(mockedApi.get).toHaveBeenCalledWith('/tax/10/details', {
        params: { userType: 'EMPLOYEE', month: '5' },
      });
    });

    it('should pass both year and month', async () => {
      mockedApi.get.mockResolvedValue({ data: {} });

      await taxService.getTaxBreakdown(10, 'CLIENT', 2026, 3);

      expect(mockedApi.get).toHaveBeenCalledWith('/tax/10/details', {
        params: { userType: 'CLIENT', year: '2026', month: '3' },
      });
    });

    it('should propagate 404 errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not implemented'));
      await expect(taxService.getTaxBreakdown(10, 'CLIENT')).rejects.toThrow('Not implemented');
    });
  });
});
