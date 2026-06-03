import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockujem api modul pre fund statistics service import-a
vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import fundStatisticsService from './fundStatisticsService';
import api from './api';
import type { FundStatisticsRawDto } from '../types/fundStatistics';

const mockGet = api.get as ReturnType<typeof vi.fn>;

// P1-fe-contracts-1: BE salje `annualizedReturn`/`volatility`/`maxDrawdown`/
// `rewardToVariability` (bez `Percent`/`Ratio`) — servis ih normalizuje.
const sampleBeStats: FundStatisticsRawDto = {
  fundId: 7,
  fundName: 'Alpha Growth',
  snapshotCount: 90,
  annualizedReturn: 12.34,
  volatility: 4.2,
  maxDrawdown: -8.5,
  rewardToVariability: 2.94,
  sufficientHistory: true,
};

describe('fundStatisticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFundStatistics', () => {
    it('šalje GET /funds/{fundId}/statistics', async () => {
      mockGet.mockResolvedValue({ data: sampleBeStats });

      await fundStatisticsService.getFundStatistics(7);

      expect(mockGet).toHaveBeenCalledWith('/funds/7/statistics');
    });

    it('mapira BE kljuceve u FE *Percent/*Ratio polja', async () => {
      mockGet.mockResolvedValue({ data: sampleBeStats });

      const result = await fundStatisticsService.getFundStatistics(7);

      expect(result.annualizedReturnPercent).toBe(12.34);
      expect(result.volatilityPercent).toBe(4.2);
      expect(result.maxDrawdownPercent).toBe(-8.5);
      expect(result.rewardToVariabilityRatio).toBe(2.94);
      expect(result.sufficientHistory).toBe(true);
    });

    it('podržava DTO sa null metrikama (nedovoljno istorije)', async () => {
      const insufficient: FundStatisticsRawDto = {
        fundId: 9,
        fundName: 'Novi fond',
        snapshotCount: 5,
        annualizedReturn: null,
        volatility: null,
        maxDrawdown: null,
        rewardToVariability: null,
        sufficientHistory: false,
      };
      mockGet.mockResolvedValue({ data: insufficient });

      const result = await fundStatisticsService.getFundStatistics(9);

      expect(result.sufficientHistory).toBe(false);
      expect(result.annualizedReturnPercent).toBeNull();
    });

    it('propagira grešku ako api odbije zahtev (npr. 404 dok B12 nije aktivan)', async () => {
      mockGet.mockRejectedValue(new Error('404 not found'));

      await expect(fundStatisticsService.getFundStatistics(7)).rejects.toThrow(
        '404 not found',
      );
    });
  });
});
