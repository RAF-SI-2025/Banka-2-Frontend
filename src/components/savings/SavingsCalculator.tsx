import { useMemo } from 'react';
import { Card } from '@/components/ui/card';

// R1-664: imenovane konstante (paritet sa BE SavingsCalculator.java / Mobile SavingsMath.kt,
// gde su 1200 i 0.01 vec imenovani) — bez golih magic literala u proracunu.
/** annualRate% / 100 / 12 = annualRate / 1200 → mesecni faktor kamate. */
const MONTHLY_INTEREST_DIVISOR = 1200;
/** Penal pri raskidu pre dospeca = 1% glavnice. */
const EARLY_WITHDRAWAL_PENALTY_RATE = 0.01;

interface Props {
  principal: number;
  annualRate: number;
  termMonths: number;
  currencyCode: string;
}

function formatNumber(n: number, currencyCode: string): string {
  if (!Number.isFinite(n)) return '-';
  try {
    return new Intl.NumberFormat('sr-RS', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currencyCode}`;
  }
}

export function SavingsCalculator({ principal, annualRate, termMonths, currencyCode }: Props) {
  const monthlyInterest = useMemo(
    () => (principal && annualRate ? (principal * annualRate) / MONTHLY_INTEREST_DIVISOR : 0),
    [principal, annualRate]
  );
  const totalInterest = useMemo(() => monthlyInterest * termMonths, [monthlyInterest, termMonths]);
  const penalty = useMemo(() => principal * EARLY_WITHDRAWAL_PENALTY_RATE, [principal]);

  return (
    <Card className="p-6 sticky top-24" data-testid="savings-calculator">
      <h3 className="text-lg font-semibold mb-4">Pregled depozita</h3>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mesecna kamata</dt>
          <dd className="font-medium tabular-nums" data-testid="calc-monthly">
            {formatNumber(monthlyInterest, currencyCode)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Ukupno kamata u roku ({termMonths}m)</dt>
          <dd className="font-medium tabular-nums" data-testid="calc-total">
            {formatNumber(totalInterest, currencyCode)}
          </dd>
        </div>
        <div className="flex justify-between border-t pt-3">
          <dt className="text-muted-foreground">Iznos na dospece (bez auto-obnove)</dt>
          <dd className="font-medium tabular-nums" data-testid="calc-payout">
            {formatNumber(principal + totalInterest, currencyCode)}
          </dd>
        </div>
        <div className="flex justify-between text-amber-600 dark:text-amber-400">
          <dt>Penal pri raskidu (1%)</dt>
          <dd className="font-medium tabular-nums" data-testid="calc-penalty">
            -{formatNumber(penalty, currencyCode)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export default SavingsCalculator;
