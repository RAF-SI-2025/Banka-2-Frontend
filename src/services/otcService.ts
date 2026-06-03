import api from './api';
import type {
  OtcListing,
  OtcOffer,
  OtcContract,
  OtcContractStatus,
  OtcExerciseResult,
  CreateOtcOfferRequest,
  CounterOtcOfferRequest,
} from '../types/celina3';
import type {
  OtcNegotiationHistoryDto,
  OtcNegotiationHistoryPage,
  OtcNegotiationHistoryFilters,
} from '../types/otcHistory';

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

  /**
   * Moje sopstvene javne akcije — portfolio item-i koje sam stavio u javni
   * rezim. Discovery (`/otc/listings`) namerno iskljucuje sopstvene akcije
   * (user pravi ponude na tudje), pa ovaj endpoint daje vidljivost tome STA
   * SAM JA objavio za druge.
   */
  listMyPublicListings: async (): Promise<OtcListing[]> => {
    const { data } = await api.get<OtcListing[]>('/otc/listings/my');
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

  /**
   * Iskoriscavanje opcije — kupac placa strike * qty i dobija akcije.
   * BE sprovodi exercise kroz Model-B SAGA orkestrator i vraca terminalni
   * ishod (`OtcExerciseResult`), a NE pun `OtcContract`. UI svejedno re-fetch-uje
   * ugovore posle poziva da prikaze sveze stanje.
   */
  exerciseContract: async (contractId: number, buyerAccountId?: number): Promise<OtcExerciseResult> => {
    const { data } = await api.post<OtcExerciseResult>(`/otc/contracts/${contractId}/exercise`, null, {
      params: buyerAccountId != null ? { buyerAccountId } : undefined,
    });
    return data;
  },

  /**
   * Odustajanje od aktivnog ugovora — kupac potvrduje da ne zeli iskoristiti opciju.
   * Premija OSTAJE kod prodavca (vec je placena pri accept-u). Status → EXPIRED.
   */
  abandonContract: async (contractId: number): Promise<OtcContract> => {
    const { data } = await api.post<OtcContract>(`/otc/contracts/${contractId}/abandon`);
    return data;
  },

  /**
   * FE4 (7.3) — paginiran pregled istorije OTC pregovora sa opcionim filterima
   * (status, korisnik, opseg datuma). BE: GET /otc/negotiation-history (B10) —
   * dostupno samo ADMIN i SUPERVISOR ulogama.
   */
  getNegotiationHistory: async (
    filters: OtcNegotiationHistoryFilters = {},
  ): Promise<OtcNegotiationHistoryPage> => {
    const { data } = await api.get<OtcNegotiationHistoryPage>('/otc/negotiation-history', {
      params: filters,
    });
    return data;
  },

  /**
   * FE4 (7.3) — hronoloski lanac svih izmena (kontraponuda) za jedan pregovor.
   * BE: GET /otc/negotiation-history/{negotiationId} (B10).
   */
  getNegotiationHistoryById: async (
    negotiationId: number,
  ): Promise<OtcNegotiationHistoryDto[]> => {
    const { data } = await api.get<OtcNegotiationHistoryDto[]>(
      `/otc/negotiation-history/${negotiationId}`,
    );
    return data;
  },
};

export default otcService;
