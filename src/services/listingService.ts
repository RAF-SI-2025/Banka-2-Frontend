import api from './api';
import { Listing, ListingDailyPrice, PaginatedResponse } from '../types/celina3';

// FIXME: Svi endpointi cekaju backend implementaciju iz Sprint 3
// Kada backend bude spreman, proveriti da li se polja poklapaju

const listingService = {
  /**
   * GET /listings?type=STOCK&search=&page=0&size=20
   * Dohvata stranicu hartija od vrednosti filtrirano po tipu.
   * FIXME: Backend endpoint - GET /listings
   */
  getAll: async (
    type: string = 'STOCK',
    search: string = '',
    page: number = 0,
    size: number = 20
  ): Promise<PaginatedResponse<Listing>> => {
    const response = await api.get('/listings', {
      params: { type, search, page, size },
    });
    return response.data;
  },

  /**
   * GET /listings/{id}
   * Dohvata detalje jedne hartije sa izvedenim podacima.
   * FIXME: Backend endpoint - GET /listings/{id}
   */
  getById: async (id: number): Promise<Listing> => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  /**
   * GET /listings/{id}/history?period=MONTH
   * Dohvata istorijske cene za grafik.
   * Periodi: DAY, WEEK, MONTH, YEAR, FIVE_YEARS, ALL
   * FIXME: Backend endpoint - GET /listings/{id}/history
   */
  getHistory: async (id: number, period: string = 'MONTH'): Promise<ListingDailyPrice[]> => {
    const response = await api.get(`/listings/${id}/history`, {
      params: { period },
    });
    return response.data;
  },

  /**
   * POST /listings/refresh
   * Rucno osvezavanje cena hartija.
   * FIXME: Backend endpoint - POST /listings/refresh
   */
  refresh: async (): Promise<void> => {
    await api.post('/listings/refresh');
  },
};

export default listingService;
