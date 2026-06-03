import { describe, it, expect } from 'vitest';
import { computeCardUsage } from './cardLabels';
import type { Card } from '@/types/celina2';

// R1-548: LimitRing `used={0}` je bio hardkodiran (uvek 0% — lazni podatak).
// computeCardUsage vraca STVARNU iskoriscenost samo kad BE ima podatke (CREDIT/
// PREPAID), inace null (DEBIT nema spending tracker → prsten se ne renderuje).

const baseCard: Card = {
  id: 1,
  cardNumber: '5555444433332222',
  cardType: 'MASTERCARD',
  cardName: 'Mastercard Debit',
  accountNumber: '222000000000000001',
  holderName: 'Petar Petrovic',
  expirationDate: '2030-01-01',
  status: 'ACTIVE',
  limit: 100000,
  cardLimit: 100000,
  createdAt: '2026-01-01',
};

describe('computeCardUsage (R1-548 — no fake LimitRing data)', () => {
  it('returns null for DEBIT cards (no spending data → no ring, not fake 0%)', () => {
    expect(computeCardUsage({ ...baseCard, cardCategory: 'DEBIT' })).toBeNull();
  });

  it('returns null when cardCategory is undefined (treated as plain card)', () => {
    expect(computeCardUsage({ ...baseCard, cardCategory: undefined })).toBeNull();
  });

  it('returns real outstanding/credit-limit ratio for CREDIT cards', () => {
    const usage = computeCardUsage({
      ...baseCard,
      cardCategory: 'CREDIT',
      creditLimit: 200000,
      outstandingBalance: 50000,
    });
    expect(usage).toEqual({ used: 50000, total: 200000 });
  });

  it('falls back to 0 outstanding when CREDIT has no outstandingBalance', () => {
    const usage = computeCardUsage({
      ...baseCard,
      cardCategory: 'CREDIT',
      creditLimit: 200000,
      outstandingBalance: undefined,
    });
    expect(usage).toEqual({ used: 0, total: 200000 });
  });

  it('returns prepaid loaded ratio for INTERNET_PREPAID cards', () => {
    const usage = computeCardUsage({
      ...baseCard,
      cardCategory: 'INTERNET_PREPAID',
      cardLimit: 50000,
      prepaidBalance: 12500,
    });
    expect(usage).toEqual({ used: 12500, total: 50000 });
  });

  it('returns null for CREDIT card with no usable total (avoids div-by-zero / fake ring)', () => {
    const usage = computeCardUsage({
      ...baseCard,
      cardCategory: 'CREDIT',
      creditLimit: 0,
      cardLimit: 0,
      limit: 0,
      outstandingBalance: 10000,
    });
    expect(usage).toBeNull();
  });
});
