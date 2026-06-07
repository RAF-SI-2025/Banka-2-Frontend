/**
 * Mapa za OTC contract status (intra-bank + inter-bank, isti enum-set
 * ACTIVE/EXERCISED/EXPIRED) — Badge label. Bila duplirana u
 * OtcOffersAndContractsPage i OtcInterBankContractsTab.
 */

export const OTC_CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktivan',
  EXERCISED: 'Iskoriscen',
  EXPIRED: 'Istekao',
  // Inter-bank OTC: kupac moze da odbije ACTIVE ugovor pre dospeca.
  DECLINED: 'Odbijen',
};
