import api from './api';
import { TaxRecord } from '../types/celina3';

// FIXME: Svi endpointi cekaju backend implementaciju (post-Sprint 3)

const taxService = {
  /**
   * GET /tax?userType=&name=
   * Lista korisnika sa dugovanjima (za supervizor portal).
   * FIXME: Backend endpoint - GET /tax
   */
  getTaxRecords: async (userType?: string, name?: string): Promise<TaxRecord[]> => {
    const response = await api.get('/tax', {
      params: { userType, name },
    });
    return response.data;
  },

  /**
   * POST /tax/calculate
   * Pokreni obracun poreza za tekuci mesec.
   * FIXME: Backend endpoint - POST /tax/calculate
   */
  triggerCalculation: async (): Promise<void> => {
    await api.post('/tax/calculate');
  },
};

export default taxService;
