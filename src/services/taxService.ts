import api from './api';
import type { TaxRecord, TaxBreakdownResponse, TaxBreakdownItemDto } from '../types/celina3';

const taxService = {
  /**
   * GET /tax?userType=&name=
   * Lista korisnika sa dugovanjima (za supervizor portal).
   */
  getTaxRecords: async (userType?: string, name?: string): Promise<TaxRecord[]> => {
    const params: Record<string, string> = {};
    if (userType) params.userType = userType;
    if (name) params.name = name;
    const response = await api.get('/tax', { params });
    return response.data;
  },

  /**
   * POST /tax/calculate
   * Pokreni obracun poreza za tekuci mesec.
   */
  triggerCalculation: async (): Promise<void> => {
    await api.post('/tax/calculate');
  },

  /**
   * GET /tax/{userId}/details?userType=CLIENT|EMPLOYEE
   * Spec Celina 3: detaljan prikaz poreske obaveze (koje transakcije su
   * doprinele profitu/gubitku) za pojedinacnog korisnika.
   *
   * Ako BE endpoint nije implementiran, hvataju se 404/501 i baca posebna
   * exception klasa kako bi UI mogao gracefully da prikaze placeholder.
   */
  getTaxBreakdown: async (
    userId: number,
    userType: string,
    year?: number,
    month?: number,
  ): Promise<TaxBreakdownResponse> => {
    const params: Record<string, string> = { userType };
    if (year !== undefined) params.year = String(year);
    if (month !== undefined) params.month = String(month);
    const response = await api.get(`/tax/${userId}/details`, { params });
    return response.data;
  },

  /**
   * GET /tax/{userId}/{userType}/breakdown
   * Spec Celina 3 §516-518 — per-listing aggregisani breakdown (P2.4 BE endpoint).
   * Supervizor only, vraca List<TaxBreakdownItemDto> sortirano po taxOwed DESC.
   */
  getPerListingBreakdown: async (
    userId: number,
    userType: string,
  ): Promise<TaxBreakdownItemDto[]> => {
    const response = await api.get<TaxBreakdownItemDto[]>(`/tax/${userId}/${userType}/breakdown`);
    return response.data;
  },

  /**
   * GET /tax/my/breakdown
   * Per-listing breakdown za trenutno autentifikovanog korisnika.
   * Sortirano po taxOwed DESC.
   */
  getMyPerListingBreakdown: async (): Promise<TaxBreakdownItemDto[]> => {
    const response = await api.get<TaxBreakdownItemDto[]>('/tax/my/breakdown');
    return response.data;
  },
};

export default taxService;
