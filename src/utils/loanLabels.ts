import type { LoanStatus } from '@/types/celina2';

/**
 * Mape za status kredita + Badge variant. Bili duplirani u 3 fajla:
 * LoanListPage (klijent view), AllLoansPage (admin view), LoanRequestsPage
 * (zahtevi). Svaki je imao if/else lance umesto Record-a.
 */

type BadgeVariant = 'warning' | 'success' | 'info' | 'destructive' | 'secondary';

export const LOAN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Na cekanju',
  APPROVED: 'Odobren',
  ACTIVE: 'Aktivan',
  REJECTED: 'Odbijen',
  LATE: 'Kasnjenje',
  PAID: 'Otplacen',
  PAID_OFF: 'Prevremeno otplacen',
  CLOSED: 'Zatvoren',
};

export const LOAN_STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  ACTIVE: 'success',
  REJECTED: 'destructive',
  LATE: 'destructive',
  PAID: 'secondary',
  PAID_OFF: 'secondary',
  CLOSED: 'secondary',
};

/** Boja leve granice u list/card prikazu kredita po statusu. */
export const LOAN_STATUS_ROW_BORDER: Record<string, string> = {
  ACTIVE: 'border-l-emerald-500',
  PENDING: 'border-l-amber-500',
  APPROVED: 'border-l-blue-500',
  REJECTED: 'border-l-red-500',
  LATE: 'border-l-red-500',
  PAID: 'border-l-gray-400',
  PAID_OFF: 'border-l-gray-400',
  CLOSED: 'border-l-gray-300',
};

export function getLoanStatusBadgeVariant(status: LoanStatus): BadgeVariant {
  return LOAN_STATUS_BADGE_VARIANT[status] ?? 'secondary';
}

export function getLoanStatusLabel(status: LoanStatus): string {
  return LOAN_STATUS_LABELS[status] ?? status;
}

/**
 * R1-657/R1-658: orijentaciona FE procena kamatne stope kredita. Mirror BE
 * {@code LoanServiceImpl.getBaseRate} (tranše po RSD iznosu) + {@code LoanType.getMargin}
 * (marža po tipu). Pre su band-tabela i marža bili inline magic literali u
 * LoanApplicationPage; sad su centralizovani ovde (jedan izvor istine na FE-u).
 *
 * NB: ovo je SAMO klijentska procena u kalkulatoru — pravu stopu obracunava BE pri
 * odobrenju (BE je merodavan). Rezultat je EFEKTIVNA stopa (base + marža), isto što
 * BE čuva u {@code effectiveRate}; {@code nominalRate} (samo base) BE čuva odvojeno.
 */
const LOAN_BASE_RATE_BANDS: ReadonlyArray<{ maxAmount: number; rate: number }> = [
  { maxAmount: 500000, rate: 6.25 },
  { maxAmount: 1000000, rate: 6.0 },
  { maxAmount: 2000000, rate: 5.75 },
  { maxAmount: 5000000, rate: 5.5 },
  { maxAmount: 10000000, rate: 5.25 },
  { maxAmount: 20000000, rate: 5.0 },
];
const LOAN_BASE_RATE_TOP = 4.75;

const LOAN_TYPE_MARGINS: Record<string, number> = {
  GOTOVINSKI: 1.75,
  STAMBENI: 1.5,
  AUTO: 1.25,
  REFINANSIRAJUCI: 1.0,
  STUDENTSKI: 0.75,
};
const LOAN_DEFAULT_MARGIN = 1.75;

/** Base (nominalna) stopa po RSD iznosu — mirror BE getBaseRate tranši. */
export function estimateLoanBaseRate(amount: number): number {
  const band = LOAN_BASE_RATE_BANDS.find((b) => amount <= b.maxAmount);
  return band ? band.rate : LOAN_BASE_RATE_TOP;
}

/** Marža banke po tipu kredita — mirror BE LoanType.getMargin. */
export function getLoanTypeMargin(loanType: string): number {
  return LOAN_TYPE_MARGINS[loanType] ?? LOAN_DEFAULT_MARGIN;
}

/** Efektivna (godišnja) stopa = base + marža. */
export function estimateLoanEffectiveRate(amount: number, loanType: string): number {
  return estimateLoanBaseRate(amount) + getLoanTypeMargin(loanType);
}
