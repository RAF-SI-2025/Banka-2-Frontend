export type PriceAlertCondition = 'ABOVE' | 'BELOW';

export type PriceAlertStatus = 'ACTIVE' | 'TRIGGERED' | 'DISABLED';

export interface PriceAlertDto {
  id: number;
  listingId: number;
  ticker: string;
  listingName: string;
  condition: PriceAlertCondition;
  threshold: number;
  currency: string;
  currentPrice: number | null;
  status: PriceAlertStatus;
  note?: string;
  createdAt: string;
  triggeredAt: string | null;
}

export interface CreatePriceAlertRequest {
  listingId: number;
  condition: PriceAlertCondition;
  threshold: number;
  note?: string;
}

export interface UpdatePriceAlertRequest {
  condition?: PriceAlertCondition;
  threshold?: number;
  note?: string;
  status?: PriceAlertStatus;
}

export const PRICE_ALERT_CONDITION_LABELS: Record<PriceAlertCondition, string> = {
  ABOVE: 'Cena iznad',
  BELOW: 'Cena ispod',
};

export const PRICE_ALERT_STATUS_LABELS: Record<PriceAlertStatus, string> = {
  ACTIVE: 'Aktivan',
  TRIGGERED: 'Okidan',
  DISABLED: 'Onemogucen',
};

export type PriceAlertStatusBadgeVariant = 'success' | 'warning' | 'secondary';

export const PRICE_ALERT_STATUS_VARIANT: Record<PriceAlertStatus, PriceAlertStatusBadgeVariant> = {
  ACTIVE: 'success',
  TRIGGERED: 'warning',
  DISABLED: 'secondary',
};

export type PriceAlertFilterTab = 'ALL' | PriceAlertStatus;

export const PRICE_ALERT_FILTER_LABELS: Record<PriceAlertFilterTab, string> = {
  ALL: 'Svi',
  ACTIVE: 'Aktivni',
  TRIGGERED: 'Okidani',
  DISABLED: 'Onemoguceni',
};

export function priceAlertDistancePct(
  currentPrice: number | null | undefined,
  threshold: number
): number | null {
  if (currentPrice == null || !Number.isFinite(currentPrice) || threshold <= 0) return null;
  return ((currentPrice - threshold) / threshold) * 100;
}
