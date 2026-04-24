import api from './api';
import type {
  OtcListing,
  OtcOffer,
  OtcContract,
  OtcContractStatus,
  CreateOtcOfferRequest,
  CounterOtcOfferRequest,
} from '../types/celina3';

/**
 * OTC API wrapper — odgovara `/otc/**` endpoint-ima backend-a.
 *
 * Celina 4 (intra-bank): discovery javnih ponuda, pregovori sa
 * kontra-ponudama, prihvatanje sa prenosom premije, pregled sklopljenih
 * ugovora i iskoriscavanje opcije pre settlementDate-a.
 */
const otcService = {
  /** Diskaveri svih akcija koje drugi korisnici trenutno nude javno. */
  listDiscovery: async (): Promise<OtcListing[]> => {
    const { data } = await api.get<OtcListing[]>('/otc/listings');
    return data;
  },

  /** Moje aktivne pregovore (ACTIVE ponude u kojima sam buyer ili seller). */
  listMyActiveOffers: async (): Promise<OtcOffer[]> => {
    const { data } = await api.get<OtcOffer[]>('/otc/offers/active');
    return data;
  },

  /** Kreira inicijalnu ponudu za akcije drugog korisnika. Kreator je buyer. */
  createOffer: async (request: CreateOtcOfferRequest): Promise<OtcOffer> => {
    const { data } = await api.post<OtcOffer>('/otc/offers', request);
    return data;
  },

  /** Kontra-ponuda na postojecu ponudu. */
  counterOffer: async (offerId: number, request: CounterOtcOfferRequest): Promise<OtcOffer> => {
    const { data } = await api.post<OtcOffer>(`/otc/offers/${offerId}/counter`, request);
    return data;
  },

  /** Prihvata ponudu (moguce samo ako je red na trenutnog korisnika). */
  acceptOffer: async (offerId: number, buyerAccountId?: number): Promise<OtcOffer> => {
    const { data } = await api.post<OtcOffer>(`/otc/offers/${offerId}/accept`, null, {
      params: buyerAccountId != null ? { buyerAccountId } : undefined,
    });
    return data;
  },

  /** Otkazuje pregovor. */
  declineOffer: async (offerId: number): Promise<OtcOffer> => {
    const { data } = await api.post<OtcOffer>(`/otc/offers/${offerId}/decline`);
    return data;
  },

  /** Svi moji ugovori (sa opcionim filterom po statusu). */
  listMyContracts: async (status?: OtcContractStatus | 'ALL'): Promise<OtcContract[]> => {
    const { data } = await api.get<OtcContract[]>('/otc/contracts', {
      params: status ? { status } : undefined,
    });
    return data;
  },

  /** Iskoriscavanje opcije — kupac placa strike * qty i dobija akcije. */
  exerciseContract: async (contractId: number, buyerAccountId?: number): Promise<OtcContract> => {
    const { data } = await api.post<OtcContract>(`/otc/contracts/${contractId}/exercise`, null, {
      params: buyerAccountId != null ? { buyerAccountId } : undefined,
    });
    return data;
  },
};

export default otcService;
