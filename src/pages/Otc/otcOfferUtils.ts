export type OfferDeviation = {
  percent: number;
  label: string;
  rowClass: string;
  badgeClass: string;
};

export function computeOfferDeviation(
  pricePerStock: number,
  currentPrice: number | null | undefined,
): OfferDeviation | null {
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  const pct = ((pricePerStock - currentPrice) / currentPrice) * 100;
  const abs = Math.abs(pct);
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
  const label = `${sign}${abs.toFixed(1)}%`;

  if (abs <= 5) {
    return {
      percent: pct,
      label,
      rowClass: 'bg-emerald-500/5 hover:bg-emerald-500/10',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    };
  }

  if (abs <= 20) {
    return {
      percent: pct,
      label,
      rowClass: 'bg-amber-500/5 hover:bg-amber-500/10',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }

  return {
    percent: pct,
    label,
    rowClass: 'bg-red-500/5 hover:bg-red-500/10',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  };
}
