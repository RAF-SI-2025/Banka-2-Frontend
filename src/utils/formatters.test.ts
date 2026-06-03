import { describe, it, expect } from 'vitest';
import { asArray, formatAmount, formatDate, toIsoDateOnly, addDaysISO, isFutureDateOnly, formatVolumeCompact } from './formatters';

describe('asArray', () => {
  it('returns the same array when given an array', () => {
    const input = [1, 2, 3];
    expect(asArray(input)).toBe(input);
  });

  it('returns empty array for null', () => {
    expect(asArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(asArray(undefined)).toEqual([]);
  });

  it('returns empty array for a string', () => {
    expect(asArray('hello')).toEqual([]);
  });

  it('returns empty array for a number', () => {
    expect(asArray(42)).toEqual([]);
  });

  it('returns empty array for an object', () => {
    expect(asArray({ key: 'value' })).toEqual([]);
  });

  it('returns empty array for boolean', () => {
    expect(asArray(true)).toEqual([]);
    expect(asArray(false)).toEqual([]);
  });

  it('preserves typed array contents', () => {
    const input = [{ id: 1 }, { id: 2 }];
    const result = asArray<{ id: number }>(input);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns empty array for empty input (0)', () => {
    expect(asArray(0)).toEqual([]);
  });
});

describe('formatAmount', () => {
  it('formats a positive number with default decimals', () => {
    const result = formatAmount(1234.56);
    // sr-RS uses dot as thousands separator and comma as decimal
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('56');
  });

  it('formats zero', () => {
    const result = formatAmount(0);
    expect(result).toMatch(/0[,.]00/);
  });

  it('formats negative numbers', () => {
    const result = formatAmount(-500.5);
    expect(result).toContain('500');
    expect(result).toContain('50');
  });

  it('formats with custom decimal places', () => {
    const result = formatAmount(100, 0);
    expect(result).toContain('100');
  });

  it('formats with 4 decimal places', () => {
    const result = formatAmount(1.23456, 4);
    expect(result).toContain('2346'); // rounded
  });

  it('formats null as zero using sr-RS locale', () => {
    // Number(null) === 0, which is finite, so it goes through toLocaleString
    const result = formatAmount(null);
    expect(result).toMatch(/0[,.]00/);
  });

  it('returns fallback for undefined (NaN path)', () => {
    // Number(undefined) is NaN, which is not finite → falls through to toFixed
    const result = formatAmount(undefined);
    expect(result).toBe('0.00');
  });

  it('returns fallback with custom decimals for undefined', () => {
    const result = formatAmount(undefined, 3);
    expect(result).toBe('0.000');
  });

  it('formats large numbers', () => {
    const result = formatAmount(1000000);
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('formats very small numbers', () => {
    const result = formatAmount(0.01);
    expect(result).toContain('01');
  });

  it('handles Infinity by returning fallback', () => {
    const result = formatAmount(Infinity);
    expect(result).toBe('0.00');
  });

  it('handles -Infinity by returning fallback', () => {
    const result = formatAmount(-Infinity);
    expect(result).toBe('0.00');
  });

  it('handles NaN as a number input by returning fallback', () => {
    const result = formatAmount(NaN);
    expect(result).toBe('0.00');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2025-01-15');
    // sr-RS format: dd.mm.yyyy. or similar
    expect(result).not.toBe('-');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('formats a full ISO datetime string', () => {
    const result = formatDate('2025-06-20T14:30:00Z');
    expect(result).not.toBe('-');
    expect(result).toContain('2025');
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-');
  });

  it('returns dash for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('returns dash for garbage input', () => {
    expect(formatDate('abc123')).toBe('-');
  });

  it('formats date at year boundary', () => {
    const result = formatDate('2025-12-31');
    expect(result).not.toBe('-');
    expect(result).toContain('31');
  });

  it('formats date at start of year', () => {
    const result = formatDate('2025-01-01');
    expect(result).not.toBe('-');
  });
});

describe('toIsoDateOnly (UTC off-by-one — [P1-i18n-1 / 1856])', () => {
  it('returns the LOCAL calendar date, not the UTC date', () => {
    // 23:30 local on 2025-06-15. In any timezone east of UTC (Belgrade is
    // UTC+1/+2) toISOString() would roll this back to 2025-06-15 anyway, but
    // for a time that is past midnight local yet still the previous day in UTC
    // the old toISOString().slice(0,10) returned the WRONG (earlier) date.
    const date = new Date(2025, 5, 15, 23, 30, 0); // local time, month is 0-based
    expect(toIsoDateOnly(date)).toBe('2025-06-15');
  });

  it('matches the local getFullYear/getMonth/getDate components exactly', () => {
    const date = new Date(2025, 0, 5, 0, 30, 0); // 00:30 local, Jan 5 2025
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(toIsoDateOnly(date)).toBe(expected);
    expect(toIsoDateOnly(date)).toBe('2025-01-05');
  });

  it('zero-pads single-digit month and day', () => {
    const date = new Date(2025, 2, 7, 12, 0, 0); // March 7 2025
    expect(toIsoDateOnly(date)).toBe('2025-03-07');
  });
});

describe('addDaysISO (UTC off-by-one — [P1-i18n-1 / 1857])', () => {
  it('returns todays local date for 0 days', () => {
    const now = new Date();
    const expected = toIsoDateOnly(now);
    expect(addDaysISO(0)).toBe(expected);
  });

  it('adds N days relative to the local calendar date', () => {
    const expected = toIsoDateOnly(
      new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 7),
    );
    expect(addDaysISO(7)).toBe(expected);
  });

  it('returns an ISO date-only string (yyyy-mm-dd)', () => {
    expect(addDaysISO(1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isFutureDateOnly (R1 860 — OTC settlement future-date guard)', () => {
  it('returns true for tomorrow', () => {
    expect(isFutureDateOnly(addDaysISO(1))).toBe(true);
  });

  it('returns false for today (strictly-future only)', () => {
    expect(isFutureDateOnly(addDaysISO(0))).toBe(false);
  });

  it('returns false for yesterday', () => {
    expect(isFutureDateOnly(addDaysISO(-1))).toBe(false);
  });

  it('returns false for empty / null / undefined', () => {
    expect(isFutureDateOnly('')).toBe(false);
    expect(isFutureDateOnly(null)).toBe(false);
    expect(isFutureDateOnly(undefined)).toBe(false);
  });

  it('returns false for an unparseable string', () => {
    expect(isFutureDateOnly('not-a-date')).toBe(false);
  });
});

describe('formatVolumeCompact (R4-1803 — sr-RS decimal separator)', () => {
  it('returns "-" for null/undefined', () => {
    expect(formatVolumeCompact(null)).toBe('-');
    expect(formatVolumeCompact(undefined)).toBe('-');
  });

  it('uses sr-RS comma (not dot) for the K decimal', () => {
    // 1500 → "1,5K" (zarez, NE "1.5K")
    expect(formatVolumeCompact(1500)).toBe('1,5K');
    expect(formatVolumeCompact(1500)).not.toContain('.');
  });

  it('uses sr-RS comma for the M decimal', () => {
    expect(formatVolumeCompact(2_500_000)).toBe('2,5M');
  });

  it('uses sr-RS comma for the B decimal', () => {
    expect(formatVolumeCompact(3_200_000_000)).toBe('3,2B');
  });

  it('formats sub-1000 values via sr-RS locale (no suffix)', () => {
    expect(formatVolumeCompact(999)).toBe('999');
    expect(formatVolumeCompact(0)).toBe('0');
  });
});
