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

/**
 * Format a Date as ISO date-only string (yyyy-mm-dd) using the LOCAL calendar
 * date.
 *
 * [P1-i18n-1 / 1856] NE koristiti `toISOString().slice(0,10)` — to konvertuje
 * lokalni `Date` u UTC pre slice-a, pa pre ponoci po UTC (npr. 00:30 u Beogradu
 * = 22:30 UTC prethodnog dana) vraca datum -1. Koristi se kao OTC settlement
 * default + `min` date-picker → korisnik bi mogao odabrati "juce" ili biti
 * blokiran za validan datum. Gradimo iz lokalnih komponenti (`getFullYear`/
 * `getMonth`/`getDate`) da datum uvek odgovara lokalnom kalendaru (sr-RS).
 */
export function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return today's date + N days as ISO date string (yyyy-mm-dd). Used for default settlement dates. */
export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIsoDateOnly(d);
}

/**
 * True ako je `dateOnly` (yyyy-mm-dd) striktno u buducnosti u odnosu na danasnji
 * lokalni datum (poredjenje po danu, ne po vremenu). Koristi se za OTC settlement
 * validaciju gde HTML `min` atribut nije dovoljan (korisnik moze prilepiti/ukucati
 * prosli datum, a `min` se ne forsira pri programskom submit-u). Prazan/nevalidan
 * string → false (poziva se posle provere obaveznosti polja).
 */
export function isFutureDateOnly(dateOnly: string | null | undefined): boolean {
  if (!dateOnly) return false;
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() > today.getTime();
}

/**
 * Pick the account whose currency matches `currency`, falling back to the
 * first account in the list. Used for OTC premium / strike payments where
 * the buyer should default to a same-currency account if available.
 */
export function getPreferredAccount<T extends { currency: string }>(
  accounts: T[],
  currency: string,
): T | undefined {
  return accounts.find((account) => account.currency === currency) ?? accounts[0];
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

/**
 * BE moze vratiti tip racuna kao "BUSINESS" (engleska forma) ili "POSLOVNI"
 * (srpska forma) zavisno od endpoint-a — DTO normalizacija nije konzistentna.
 * Helper objedinjuje proveru.
 */
export function isBusinessAccountType(accountType: string | null | undefined): boolean {
  return accountType === 'BUSINESS' || accountType === 'POSLOVNI';
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

/**
 * Format a volume in compact form (K/M/B suffixes).
 * R4-1803: jedan decimalni separator mora biti sr-RS zarez (npr. "1,5K"), ne
 * tacka iz `toFixed`. Koristimo `toLocaleString('sr-RS')` da prikaz bude
 * konzistentan sa ostalim formatter-ima (formatPrice/formatAmount).
 */
export function formatVolumeCompact(v: number | null | undefined): string {
  if (v === null || v === undefined) return '-';
  const compact = (scaled: number, suffix: string): string =>
    scaled.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + suffix;
  if (v >= 1_000_000_000) return compact(v / 1_000_000_000, 'B');
  if (v >= 1_000_000) return compact(v / 1_000_000, 'M');
  if (v >= 1_000) return compact(v / 1_000, 'K');
  return v.toLocaleString('sr-RS');
}

/**
 * Extract a user-friendly error message from an unknown error.
 *
 * Redosled:
 *  1. axios-style `response.data.error` (backend exception handler-i)
 *  2. axios-style `response.data.message` (Spring validation i default handleri)
 *  3. `Error.message`
 *  4. string error
 *  5. fallback (ili generic poruka)
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    // T2-010 fix: `response.data.message` ima konkretnu poruku iz BE-a
    // (npr. "Racun primaoca ne postoji."), dok `response.data.error` cesto
    // sadrzi samo Spring-ov generic status reason ("Bad Request"). Stoga
    // `message` ima prioritet, a `error` se koristi samo ako message fali ili
    // nije razlicit od generickih status reasona.
    const message = response?.data?.message;
    const errorField = response?.data?.error;
    const GENERIC_SPRING_ERRORS = new Set([
      'Bad Request', 'Unauthorized', 'Forbidden', 'Not Found',
      'Conflict', 'Internal Server Error',
    ]);
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
    if (typeof errorField === 'string' && errorField.trim().length > 0
        && !GENERIC_SPRING_ERRORS.has(errorField)) {
      return errorField;
    }
  }

  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback ?? 'Doslo je do greske. Pokusajte ponovo.';
}
