import api from './api';
import type { PortfolioItem, PortfolioSummary } from '../types/celina3';

// FIXME: Svi endpointi cekaju backend implementaciju (post-Sprint 3)

const portfolioService = {
  /**
   * GET /portfolio/my
   * Lista hartija u vlasnistvu korisnika.
   * FIXME: Backend endpoint - GET /portfolio/my
   */
  getMyPortfolio: async (): Promise<PortfolioItem[]> => {
    const response = await api.get('/portfolio/my');
    return response.data;
  },

  /**
   * GET /portfolio/summary
   * Ukupna vrednost, profit, porez.
   * FIXME: Backend endpoint - GET /portfolio/summary
   */
  getSummary: async (): Promise<PortfolioSummary> => {
    const response = await api.get('/portfolio/summary');
    return response.data;
  },

  /**
   * PATCH /portfolio/{id}/public
   * Postavi broj akcija u javnom rezimu (za OTC trading).
   * FIXME: Backend endpoint - PATCH /portfolio/{id}/public
   */
  setPublicQuantity: async (id: number, quantity: number): Promise<PortfolioItem> => {
    const response = await api.patch(`/portfolio/${id}/public`, { quantity });
    return response.data;
  },
};

export default portfolioService;
