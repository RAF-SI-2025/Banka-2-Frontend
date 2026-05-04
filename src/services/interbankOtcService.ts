import api from './api';
import type {
  OtcInterbankListing,
  OtcInterbankOffer,
  CreateOtcInterbankOfferRequest,
  CounterOtcInterbankOfferRequest,
  OtcInterbankContractStatus,
  OtcInterbankContract,
  InterbankTransaction,
} from '@/types/celina4';

/**
 * OTC INTER-BANK — FE service wrapper (Spec ref: protokol §3 OTC negotiation).
 *
 * Arhitektura: klijent (FE) komunicira sa nasim BE-om kroz `/interbank/otc/*`
 * rute (vidi InterbankOtcWrapperController). BE wrapper-i interno koriste
 * OtcNegotiationService outbound putanju koja salje partner banci po §3.1-3.7.
 *
 * ID format: offerId u FE-u je serijalizacija "{routingNumber}:{idString}"
 * (npr. "222:abc-uuid"); BE parsira pri prijemu.
 */
const interbankOtcService = {
  /** Lista dostupnih OTC listinga iz drugih banaka. */
  async listRemoteListings(): Promise<OtcInterbankListing[]> {
    const { data } = await api.get<OtcInterbankListing[]>('/interbank/otc/listings');
    return data;
  },

  /** Kreira novu inter-bank OTC ponudu. */
  async createOffer(dto: CreateOtcInterbankOfferRequest): Promise<OtcInterbankOffer> {
    const { data } = await api.post<OtcInterbankOffer>('/interbank/otc/offers', dto);
    return data;
  },

  /** Moje inter-bank OTC ponude. */
  async listMyOffers(): Promise<OtcInterbankOffer[]> {
    const { data } = await api.get<OtcInterbankOffer[]>('/interbank/otc/offers/my');
    return data;
  },

  /** Kontraponuda na postojeći inter-bank OTC offer. */
  async counterOffer(offerId: string, dto: CounterOtcInterbankOfferRequest): Promise<OtcInterbankOffer> {
    const { data } = await api.patch<OtcInterbankOffer>(`/interbank/otc/offers/${offerId}/counter`, dto);
    return data;
  },

  /** Odbija postojeću inter-bank OTC ponudu. */
  async declineOffer(offerId: string): Promise<OtcInterbankOffer> {
    const { data } = await api.patch<OtcInterbankOffer>(`/interbank/otc/offers/${offerId}/decline`);
    return data;
  },

  /** Prihvata ponudu i prosleđuje račun sa kog se rezerviše premija. */
  async acceptOffer(offerId: string, accountId: number): Promise<OtcInterbankOffer> {
    const { data } = await api.patch<OtcInterbankOffer>(`/interbank/otc/offers/${offerId}/accept`, undefined, {
      params: { accountId },
    });
    return data;
  },

  /** Moji inter-bank OTC ugovori, opciono filtrirani po statusu. */
  async listMyContracts(status?: OtcInterbankContractStatus | 'ALL'): Promise<OtcInterbankContract[]> {
    const { data } = await api.get<OtcInterbankContract[]>('/interbank/otc/contracts/my', {
      params: status ? { status } : undefined,
    });
    return data;
  },

  /** Pokreće SAGA exercise za postojeći inter-bank OTC ugovor. */
  async exerciseContract(contractId: string, buyerAccountId: number): Promise<InterbankTransaction> {
    const { data } = await api.post<InterbankTransaction>(`/interbank/otc/contracts/${contractId}/exercise`, undefined, {
      params: { buyerAccountId },
    });
    return data;
  },
};

export default interbankOtcService;
