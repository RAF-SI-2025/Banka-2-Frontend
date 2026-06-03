import { OrderType } from '@/types/celina3';

/**
 * Provizija banke na klijentske ordere prema spec Celina 3:
 * - Market/Stop: `min(14% * price, $7)`
 * - Limit/Stop-Limit: `min(24% * price, $12)`
 * Zaposleni / aktuari trguju sa bankinih racuna pa nema neto provizije
 * (`isEmployee=true` vraca 0). Bila duplirana u CreateOrderPage i MyOrdersPage
 * pa ekstrahovana ovde kao jedan izvor istine.
 *
 * R1-844: `approximatePrice` i cap ($7/$12) su denominirani u VALUTI LISTINGA
 * (spec primeri su u USD jer su hartije listirane u USD). Cap nije konvertovan
 * u RSD ovde — pretpostavka je da pozivalac prosledjuje cenu i ocekuje rezultat
 * u istoj (listing) valuti. FE prikazni sloj odgovoran je za labeliranje valute.
 */
export function getOrderCommission(
  orderType: OrderType,
  approximatePrice: number,
  isEmployee: boolean = false,
): number {
  if (isEmployee || approximatePrice <= 0) return 0;
  const usesLimitPricing =
    orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
  const rate = usesLimitPricing ? 0.24 : 0.14;
  const cap = usesLimitPricing ? 12 : 7;
  return Math.min(approximatePrice * rate, cap);
}

/**
 * Detaljan breakdown provizije — koji je tip ordera, sta je primenjeno (rate vs
 * cap), i kako se cifra ispisuje. Spec Celina 3 trazi vidljivu razliku po tipu
 * (Market/Stop 14%/$7 vs Limit/Stop-Limit 24%/$12) — ovaj helper pruza sve
 * podatke za renderovanje "kalkulacije" linije u UI-ju.
 */
export interface OrderCommissionBreakdown {
  amount: number;
  /** "Market/Stop" ili "Limit/Stop-Limit" — koja formula je primenjena */
  formulaLabel: string;
  /** Procentualna stopa (0.14 ili 0.24) */
  rate: number;
  /** Apsolutni cap u valuti listinga ($7 ili $12) */
  cap: number;
  /** Da li je commission udario u cap (`true` znaci primenjen je $7/$12) */
  cappedByLimit: boolean;
  /** Sirovi izracun bez cap-a (rate * approximatePrice) */
  rawAmount: number;
}

export function getOrderCommissionBreakdown(
  orderType: OrderType,
  approximatePrice: number,
  isEmployee: boolean = false,
): OrderCommissionBreakdown | null {
  if (isEmployee || approximatePrice <= 0) return null;
  const usesLimitPricing =
    orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
  const rate = usesLimitPricing ? 0.24 : 0.14;
  const cap = usesLimitPricing ? 12 : 7;
  const rawAmount = approximatePrice * rate;
  const amount = Math.min(rawAmount, cap);
  return {
    amount,
    formulaLabel: usesLimitPricing ? 'Limit/Stop-Limit' : 'Market/Stop',
    rate,
    cap,
    cappedByLimit: rawAmount > cap,
    rawAmount,
  };
}
