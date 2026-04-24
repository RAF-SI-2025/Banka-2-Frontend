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

/*
================================================================================
 TODO — SERVICE WRAPPER ZA OTC INTER-BANK (PREGOVARANJE + SAGA)
 Zaduzen: ekalajdzic13322
 Spec referenca: Celina 4, linije 438-519
--------------------------------------------------------------------------------
 Paralelno sa intra-bank `otcService.ts`, ali gadja `/interbank/otc/**`
 endpointe. Koristi se na tabu "Iz drugih banaka" na OtcTrgovinaPage i
 OtcOffersAndContractsPage.

 Key endpointi:
   GET   /interbank/otc/listings
   POST  /interbank/otc/offers
   GET   /interbank/otc/offers/my
   PATCH /interbank/otc/offers/{offerId}/counter
   PATCH /interbank/otc/offers/{offerId}/decline
   PATCH /interbank/otc/offers/{offerId}/accept?accountId=X
   GET   /interbank/otc/contracts/my?status=...
   POST  /interbank/otc/contracts/{contractId}/exercise?buyerAccountId=X
================================================================================
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
