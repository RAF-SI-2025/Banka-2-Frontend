import api from './api';
import type {
  OtcInterbankListing,
  OtcInterbankOffer,
  CreateOtcInterbankOfferRequest,
  CounterOtcInterbankOfferRequest,
  OtcInterbankOfferStatus,
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
  /** TODO — GET /interbank/otc/listings */
  async listRemoteListings(): Promise<OtcInterbankListing[]> {
    const { data } = await api.get<OtcInterbankListing[]>('/interbank/otc/listings');
    return data;
  },

  /** TODO — POST /interbank/otc/offers */
  async createOffer(dto: CreateOtcInterbankOfferRequest): Promise<OtcInterbankOffer> {
    const { data } = await api.post<OtcInterbankOffer>('/interbank/otc/offers', dto);
    return data;
  },

  /** TODO — GET /interbank/otc/offers/my */
  async listMyOffers(): Promise<OtcInterbankOffer[]> {
    const { data } = await api.get<OtcInterbankOffer[]>('/interbank/otc/offers/my');
    return data;
  },

  /** TODO — PATCH /interbank/otc/offers/{offerId}/counter */
  async counterOffer(offerId: string, dto: CounterOtcInterbankOfferRequest): Promise<OtcInterbankOffer> {
    const { data } = await api.patch<OtcInterbankOffer>(`/interbank/otc/offers/${offerId}/counter`, dto);
    return data;
  },

  /** TODO — PATCH /interbank/otc/offers/{offerId}/decline */
  async declineOffer(offerId: string): Promise<OtcInterbankOffer> {
    const { data } = await api.patch<OtcInterbankOffer>(`/interbank/otc/offers/${offerId}/decline`);
    return data;
  },

  /** TODO — PATCH /interbank/otc/offers/{offerId}/accept?accountId=X */
  async acceptOffer(offerId: string, accountId: number): Promise<OtcInterbankOffer> {
    const { data } = await api.patch<OtcInterbankOffer>(`/interbank/otc/offers/${offerId}/accept`, null, {
      params: { accountId },
    });
    return data;
  },

  /** TODO — GET /interbank/otc/contracts/my[?status=...] */
  async listMyContracts(status?: OtcInterbankOfferStatus | 'ALL'): Promise<unknown[]> {
    const { data } = await api.get<unknown[]>('/interbank/otc/contracts/my', {
      params: status && status !== 'ALL' ? { status } : undefined,
    });
    return data;
  },

  /** TODO — POST /interbank/otc/contracts/{contractId}/exercise?buyerAccountId=X */
  async exerciseContract(contractId: string, buyerAccountId: number): Promise<unknown> {
    const { data } = await api.post<unknown>(`/interbank/otc/contracts/${contractId}/exercise`, null, {
      params: { buyerAccountId },
    });
    return data;
  },
};

export default interbankOtcService;
