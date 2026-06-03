import api from './api';
import type { FundStatisticsDto, FundStatisticsRawDto } from '../types/fundStatistics';

/**
 * P1-fe-contracts-1: BE `FundStatisticsDto.java` koristi `annualizedReturn`/
 * `volatility`/`maxDrawdown`/`rewardToVariability` — FE renderuje `*Percent`/
 * `*Ratio`. Bez ovog mapiranja sve metrike su prikazivane kao `—`.
 */
function mapFundStatistics(raw: FundStatisticsRawDto): FundStatisticsDto {
  return {
    fundId: raw.fundId,
    fundName: raw.fundName,
    snapshotCount: raw.snapshotCount,
    sufficientHistory: raw.sufficientHistory,
    annualizedReturnPercent: raw.annualizedReturn ?? null,
    volatilityPercent: raw.volatility ?? null,
    maxDrawdownPercent: raw.maxDrawdown ?? null,
    rewardToVariabilityRatio: raw.rewardToVariability ?? null,
  };
}

/**
 * Fund statistics API wrapper — odgovara `/funds/{id}/statistics` endpoint-u (B12).
 *
 * FE4, zadatak 7.2 — metrike performansi investicionih fondova
 * (anualizovani prinos, volatilnost, max drawdown, reward-to-variability).
 */
const fundStatisticsService = {
  /**
   * Statisticke metrike performansi jednog fonda.
   * BE endpoint: GET /funds/{fundId}/statistics
   */
  getFundStatistics: async (fundId: number): Promise<FundStatisticsDto> => {
    const { data } = await api.get<FundStatisticsRawDto>(`/funds/${fundId}/statistics`);
    return mapFundStatistics(data);
  },
};

export default fundStatisticsService;
