import type { Transaction } from '@/types/celina2';

/**
 * R1-832: BE transakcija stize sa nekonzistentnim imenima polja (legacy
 * `fromAccount`/`toAccount`/`description` vs novi `fromAccountNumber`/
 * `toAccountNumber`/`paymentPurpose`), pa je isti `as unknown as Record<...>`
 * merge blok bio dupliran u 3+ stranice (AccountListPage, AccountDetailsPage,
 * PaymentHistoryPage). Ovde je objedinjen u jedan izvor istine.
 *
 * Normalizuje:
 * - `fromAccountNumber` <- `fromAccount` fallback
 * - `toAccountNumber`   <- `toAccount` fallback
 * - `paymentPurpose`    <- `description` fallback
 * - `currency`          <- `fromCurrency` fallback, pa `currencyFallback`
 * - `amount`            <- numericka koercija (BE ume da posalje string)
 *
 * @param tx sirova BE transakcija (labavog tipa)
 * @param currencyFallback default valuta kad BE ne posalje nijednu (default '')
 */
export function normalizeTransaction(
  tx: Transaction,
  currencyFallback = '',
): Transaction {
  const t = tx as unknown as Record<string, unknown>;
  return {
    ...tx,
    fromAccountNumber: tx.fromAccountNumber || (t.fromAccount as string) || '',
    toAccountNumber: tx.toAccountNumber || (t.toAccount as string) || '',
    paymentPurpose: tx.paymentPurpose || (t.description as string) || '',
    currency:
      tx.currency ||
      (t.currency as Transaction['currency']) ||
      (t.fromCurrency as Transaction['currency']) ||
      (currencyFallback as Transaction['currency']),
    amount: typeof tx.amount === 'number' ? tx.amount : Number(tx.amount),
  };
}
