import api from './api';
import type { TaxRecord } from '../types/celina3';

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
   * GET /tax/my
   * Vraca poreski zapis za autentifikovanog korisnika.
   */
  getMyTaxRecord: async (): Promise<TaxRecord> => {
    const response = await api.get('/tax/my');
    return response.data;
  },

  /**
   * POST /tax/calculate
   * Pokreni obracun poreza za tekuci mesec.
   */
  triggerCalculation: async (): Promise<void> => {
    await api.post('/tax/calculate');
  },
};

export default taxService;
