/**
 * Mapiranja oznaka valute na UI elemente — gradijenti za kartice racuna,
 * simboli za prikaz iznosa, zastavice za kursnu listu. Prebaceno iz
 * HomePage/AccountListPage/AccountDetailsPage/ExchangePage gde su bile
 * duplirane (3-4× ista mapa).
 *
 * Mape su MODULE-PRIVATE: pristup ide ISKLJUCIVO preko `getCurrency*` helpera
 * koji centralizuju safe fallback (slate gradient / kod valute / 🏦). Tako se
 * fallback ne duplira po pozivnim mestima.
 */

const CURRENCY_GRADIENTS: Record<string, string> = {
  RSD: 'from-blue-500 to-blue-700',
  EUR: 'from-indigo-500 to-violet-700',
  USD: 'from-emerald-500 to-green-700',
  CHF: 'from-red-500 to-rose-700',
  GBP: 'from-purple-500 to-violet-700',
  JPY: 'from-orange-500 to-amber-700',
  CAD: 'from-rose-500 to-pink-700',
  AUD: 'from-teal-500 to-cyan-700',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RSD: 'RSD',
  EUR: '€',
  USD: '$',
  CHF: 'CHF',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

const CURRENCY_FLAGS: Record<string, string> = {
  RSD: '🇷🇸',
  EUR: '🇪🇺',
  USD: '🇺🇸',
  CHF: '🇨🇭',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
};

/** Vrati gradient klase za karticu racuna. Fallback na slate ako valuta nije poznata. */
export function getCurrencyGradient(currency: string): string {
  return CURRENCY_GRADIENTS[currency] ?? 'from-slate-500 to-slate-700';
}

/** Vrati simbol valute za prikaz uz iznos. Fallback na sam kod valute. */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** Vrati emoji zastavu za valutu. Fallback na bank emoji. */
export function getCurrencyFlag(currency: string): string {
  return CURRENCY_FLAGS[currency] ?? '🏦';
}
