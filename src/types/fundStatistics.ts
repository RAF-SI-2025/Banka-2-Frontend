// ============================================================
// FE4 — Statistika fondova (zadatak 7.2, Developer: Jovan Krunic)
//
// Tipovi odgovaraju B12 backend ugovoru (FundStatisticsDto / GET /funds/{id}/statistics).
// ============================================================

/**
 * Statisticke metrike performansi jednog investicionog fonda — odgovor sa
 * GET /funds/{fundId}/statistics. Mapira se 1:1 iz BE FundStatisticsDto.
 *
 * Metrike su `null` kada nema dovoljno istorijskih snimaka da bi bile
 * smislene (BE prag: MIN_SNAPSHOTS_REQUIRED = 30).
 */
/**
 * P1-fe-contracts-1: sirovi BE odgovor (`FundStatisticsDto.java`). BE kljucevi
 * su `annualizedReturn`/`volatility`/`maxDrawdown`/`rewardToVariability` (bez
 * `Percent`/`Ratio` sufiksa) — `fundStatisticsService` ih normalizuje u
 * FE-friendly {@link FundStatisticsDto}. Bez mapiranja sve metrike su bile `—`.
 */
export interface FundStatisticsRawDto {
  fundId: number;
  fundName: string;
  snapshotCount: number;
  sufficientHistory: boolean;
  annualizedReturn: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  rewardToVariability: number | null;
}

export interface FundStatisticsDto {
  fundId: number;
  fundName: string;
  /** Ukupan broj dnevnih snimaka vrednosti koriscenih za obracun. */
  snapshotCount: number;
  /** Anualizovani (godisnji) prinos u %. null ako nema dovoljno snimaka. */
  annualizedReturnPercent: number | null;
  /** Standardna devijacija mesecnih prinosa u %. null ako nema dovoljno tacaka. */
  volatilityPercent: number | null;
  /** Maksimalni pad od vrha do dna u % (negativna vrednost ili 0). null ako nema dovoljno. */
  maxDrawdownPercent: number | null;
  /** Sharpe-like racio: annualizedReturn / volatility. null ako volatilnost nije dostupna ili je 0. */
  rewardToVariabilityRatio: number | null;
  /** true ako je snapshotCount >= BE prag (dovoljno istorije za pouzdane metrike). */
  sufficientHistory: boolean;
}
