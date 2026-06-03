import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/types/celina2';
import { normalizeTransaction } from './transactionUtils';

describe('normalizeTransaction', () => {
  it('mapira legacy fromAccount/toAccount/description/fromCurrency na nove kljuceve', () => {
    const raw = {
      id: 1,
      fromAccount: '111',
      toAccount: '222',
      description: 'placanje',
      fromCurrency: 'EUR',
      amount: 100,
      status: 'COMPLETED',
      createdAt: '2026-01-01',
    } as unknown as Transaction;

    const out = normalizeTransaction(raw);
    expect(out.fromAccountNumber).toBe('111');
    expect(out.toAccountNumber).toBe('222');
    expect(out.paymentPurpose).toBe('placanje');
    expect(out.currency).toBe('EUR');
    expect(out.amount).toBe(100);
  });

  it('zadrzava nove kljuceve kad postoje (ne gazi ih legacy fallback-om)', () => {
    const raw = {
      id: 2,
      fromAccountNumber: 'AAA',
      toAccountNumber: 'BBB',
      paymentPurpose: 'svrha',
      currency: 'USD',
      fromAccount: 'legacy-from',
      toAccount: 'legacy-to',
      description: 'legacy-desc',
      amount: 50,
    } as unknown as Transaction;

    const out = normalizeTransaction(raw, 'RSD');
    expect(out.fromAccountNumber).toBe('AAA');
    expect(out.toAccountNumber).toBe('BBB');
    expect(out.paymentPurpose).toBe('svrha');
    expect(out.currency).toBe('USD');
  });

  it('koristi currencyFallback kad nema nijedne valute', () => {
    const raw = { id: 3, amount: 10 } as unknown as Transaction;
    expect(normalizeTransaction(raw, 'RSD').currency).toBe('RSD');
    expect(normalizeTransaction(raw).currency).toBe('');
  });

  it('koercira string amount u broj', () => {
    const raw = { id: 4, amount: '123.45' } as unknown as Transaction;
    expect(normalizeTransaction(raw).amount).toBeCloseTo(123.45);
  });

  it('prazne legacy vrednosti vode na prazan string, ne undefined', () => {
    const raw = { id: 5, amount: 0 } as unknown as Transaction;
    const out = normalizeTransaction(raw);
    expect(out.fromAccountNumber).toBe('');
    expect(out.toAccountNumber).toBe('');
    expect(out.paymentPurpose).toBe('');
  });
});
