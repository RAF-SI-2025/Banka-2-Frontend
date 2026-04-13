/**
 * Shared formatting and type-guard utilities used across multiple pages.
 */

/** Safely coerce an unknown value to a typed array. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Format a numeric amount for display using sr-RS locale. */
export function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num)
    ? num.toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : (0).toFixed(decimals);
}

/** Format a date string for display using sr-RS locale. Returns '-' for invalid/empty values. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS');
}

/** Format a date-time string for display using sr-RS locale. Returns '-' for invalid/empty values. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('sr-RS');
}

/** Format a date string as short (day + abbreviated month) using sr-RS locale. */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' });
}

/** Format a balance with currency suffix. */
export function formatBalance(amount: number | null | undefined, currency: string): string {
  return formatAmount(amount) + ' ' + currency;
}

/** Format an 18-digit account number with dashes (xxx-xxxxxxxxxxxxx-xx). */
export function formatAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length !== 18) return accountNumber || '';
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

/** Format a price for display using sr-RS locale with 2 decimal places. Returns '-' for null/undefined. */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a volume for display using sr-RS locale. Returns '-' for null/undefined. */
export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('sr-RS');
}

/** Format a volume in compact form (K/M/B suffixes). */
export function formatVolumeCompact(v: number | null | undefined): string {
  if (v === null || v === undefined) return '-';
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return String(v);
}

/** Extract a user-friendly error message from an unknown error. */
export function getErrorMessage(error: unknown, fallback?: string): string {
  // Try to extract message from axios-style response
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback ?? 'Doslo je do greske. Pokusajte ponovo.';
}
