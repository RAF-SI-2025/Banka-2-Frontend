/**
 * Mape za status kartice + Badge variant + tip kartice. Bili duplirani izmedju
 * CardListPage (inline funkcije) i AccountCardsPage (Record-i).
 *
 * Gradijenti za karticu se NE deli ovde — CardListPage koristi dramaticnije
 * via->slate-900 verzije za Liquid Glass dizajn 3D-tilted card-a, dok
 * AccountCardsPage koristi lakse dvo-stop gradijente za listu. Razlicit visual
 * intent.
 */

import type { Card } from '@/types/celina2';

type CardBadgeVariant = 'success' | 'warning' | 'secondary';

/**
 * R1-548: Realni "iskorisceno" odnos za LimitRing — SAMO kada BE vraca stvarne
 * podatke. Za DEBIT kartice ne postoji polje potrosnje (nema spending tracker-a),
 * pa bi `used={0}` bio lazni podatak (uvek 0%) — krsi pravilo "ne lazni podaci".
 *  - CREDIT: outstandingBalance / (creditLimit || cardLimit) — iskoriscenost kreditne linije
 *  - INTERNET_PREPAID: prepaidBalance / cardLimit — koliko je napunjeno na kartici
 *  - DEBIT / nepoznato: null → prsten se NE renderuje (nema lazne nule).
 */
export function computeCardUsage(card: Card): { used: number; total: number } | null {
  if (card.cardCategory === 'CREDIT') {
    const total = card.creditLimit ?? card.cardLimit ?? card.limit ?? 0;
    if (total > 0) return { used: card.outstandingBalance ?? 0, total };
    return null;
  }
  if (card.cardCategory === 'INTERNET_PREPAID') {
    const total = card.cardLimit ?? card.limit ?? 0;
    if (total > 0) return { used: card.prepaidBalance ?? 0, total };
    return null;
  }
  // DEBIT i ostalo: nema stvarne potrosnje → bez prstena.
  return null;
}

export const CARD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktivna',
  BLOCKED: 'Blokirana',
  DEACTIVATED: 'Deaktivirana',
};

export const CARD_STATUS_BADGE_VARIANT: Record<string, CardBadgeVariant> = {
  ACTIVE: 'success',
  BLOCKED: 'warning',
  DEACTIVATED: 'secondary',
};

/** Boja tackice/dot indikatora pored statusa kartice u listama. */
export const CARD_STATUS_DOTS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  BLOCKED: 'bg-red-500',
  DEACTIVATED: 'bg-gray-400 dark:bg-gray-500',
};

export const CARD_TYPE_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  DINACARD: 'DinaCard',
  AMERICAN_EXPRESS: 'American Express',
};
