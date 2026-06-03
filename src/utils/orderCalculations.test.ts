import { describe, it, expect } from 'vitest';
import { getOrderCommission, getOrderCommissionBreakdown } from './orderCalculations';
import { OrderType } from '@/types/celina3';

describe('getOrderCommission', () => {
  it('returns 0 for employee regardless of order type', () => {
    expect(getOrderCommission(OrderType.MARKET, 1000, true)).toBe(0);
    expect(getOrderCommission(OrderType.LIMIT, 1000, true)).toBe(0);
  });

  it('returns 0 for non-positive price', () => {
    expect(getOrderCommission(OrderType.MARKET, 0, false)).toBe(0);
    expect(getOrderCommission(OrderType.LIMIT, -100, false)).toBe(0);
  });

  it('caps Market commission at $7', () => {
    // 14% * 1000 = 140 → cap 7
    expect(getOrderCommission(OrderType.MARKET, 1000, false)).toBe(7);
  });

  it('caps Stop commission at $7', () => {
    expect(getOrderCommission(OrderType.STOP, 1000, false)).toBe(7);
  });

  it('caps Limit commission at $12', () => {
    // 24% * 1000 = 240 → cap 12
    expect(getOrderCommission(OrderType.LIMIT, 1000, false)).toBe(12);
  });

  it('caps Stop-Limit commission at $12', () => {
    expect(getOrderCommission(OrderType.STOP_LIMIT, 1000, false)).toBe(12);
  });

  it('uses 14% rate when below cap for Market', () => {
    // 14% * 30 = 4.2, ispod cap-a 7
    expect(getOrderCommission(OrderType.MARKET, 30, false)).toBeCloseTo(4.2);
  });

  it('uses 24% rate when below cap for Limit', () => {
    // 24% * 40 = 9.6, ispod cap-a 12
    expect(getOrderCommission(OrderType.LIMIT, 40, false)).toBeCloseTo(9.6);
  });

  it('R1-844: cap je denominiran u valuti listinga, ne konvertuje se po valuti', () => {
    // Cap ($7/$12) se primenjuje na cenu BEZ obzira na valutu listinga —
    // pretpostavka je da je cena vec u listing valuti (spec: USD). Ovaj test
    // fiksira to dokumentovano ponasanje: visoka cena uvek udari u isti cap.
    expect(getOrderCommission(OrderType.MARKET, 999999, false)).toBe(7);
    expect(getOrderCommission(OrderType.LIMIT, 999999, false)).toBe(12);
  });
});

describe('getOrderCommissionBreakdown', () => {
  it('returns null for employee', () => {
    expect(getOrderCommissionBreakdown(OrderType.MARKET, 1000, true)).toBeNull();
  });

  it('returns null for non-positive price', () => {
    expect(getOrderCommissionBreakdown(OrderType.MARKET, 0, false)).toBeNull();
    expect(getOrderCommissionBreakdown(OrderType.LIMIT, -50, false)).toBeNull();
  });

  it('flags cappedByLimit when rate * price > cap (Market)', () => {
    const breakdown = getOrderCommissionBreakdown(OrderType.MARKET, 1000, false);
    expect(breakdown).toEqual({
      amount: 7,
      formulaLabel: 'Market/Stop',
      rate: 0.14,
      cap: 7,
      cappedByLimit: true,
      rawAmount: 140,
    });
  });

  it('flags cappedByLimit=false when rate * price <= cap (Market)', () => {
    const breakdown = getOrderCommissionBreakdown(OrderType.MARKET, 30, false);
    expect(breakdown?.cappedByLimit).toBe(false);
    expect(breakdown?.amount).toBeCloseTo(4.2);
    expect(breakdown?.formulaLabel).toBe('Market/Stop');
  });

  it('uses Limit/Stop-Limit formula label for LIMIT order', () => {
    const breakdown = getOrderCommissionBreakdown(OrderType.LIMIT, 1000, false);
    expect(breakdown?.formulaLabel).toBe('Limit/Stop-Limit');
    expect(breakdown?.rate).toBe(0.24);
    expect(breakdown?.cap).toBe(12);
  });

  it('uses Limit/Stop-Limit formula label for STOP_LIMIT order', () => {
    const breakdown = getOrderCommissionBreakdown(OrderType.STOP_LIMIT, 1000, false);
    expect(breakdown?.formulaLabel).toBe('Limit/Stop-Limit');
  });

  it('uses Market/Stop formula label for STOP order', () => {
    const breakdown = getOrderCommissionBreakdown(OrderType.STOP, 30, false);
    expect(breakdown?.formulaLabel).toBe('Market/Stop');
    expect(breakdown?.rate).toBe(0.14);
    expect(breakdown?.cap).toBe(7);
  });

  it('matches getOrderCommission output for amount', () => {
    const cases: Array<[OrderType, number]> = [
      [OrderType.MARKET, 30],
      [OrderType.MARKET, 1000],
      [OrderType.LIMIT, 40],
      [OrderType.LIMIT, 1000],
      [OrderType.STOP, 50],
      [OrderType.STOP_LIMIT, 50],
    ];
    for (const [type, price] of cases) {
      const direct = getOrderCommission(type, price, false);
      const breakdown = getOrderCommissionBreakdown(type, price, false);
      expect(breakdown?.amount).toBeCloseTo(direct);
    }
  });
});
