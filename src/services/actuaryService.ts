import api from './api';
import type { ActuaryInfo, UpdateActuaryLimit } from '../types/celina3';

// FIXME: Svi endpointi cekaju backend implementaciju iz Sprint 3

const actuaryService = {
  /**
   * GET /actuaries/agents?email=&firstName=&lastName=
   * Lista svih agenata (za supervizor portal).
   * FIXME: Backend endpoint - GET /actuaries/agents
   */
  getAgents: async (
    email?: string,
    firstName?: string,
    lastName?: string
  ): Promise<ActuaryInfo[]> => {
    const response = await api.get('/actuaries/agents', {
      params: { email, firstName, lastName },
    });
    return response.data;
  },

  /**
   * GET /actuaries/{employeeId}
   * Aktuarski podaci za zaposlenog.
   * FIXME: Backend endpoint - GET /actuaries/{employeeId}
   */
  getInfo: async (employeeId: number): Promise<ActuaryInfo> => {
    const response = await api.get(`/actuaries/${employeeId}`);
    return response.data;
  },

  /**
   * PATCH /actuaries/{employeeId}/limit
   * Promena limita i needApproval za agenta.
   * FIXME: Backend endpoint - PATCH /actuaries/{employeeId}/limit
   */
  updateLimit: async (employeeId: number, data: UpdateActuaryLimit): Promise<ActuaryInfo> => {
    const response = await api.patch(`/actuaries/${employeeId}/limit`, data);
    return response.data;
  },

  /**
   * PATCH /actuaries/{employeeId}/reset-limit
   * Reset usedLimit na 0.
   * FIXME: Backend endpoint - PATCH /actuaries/{employeeId}/reset-limit
   */
  resetLimit: async (employeeId: number): Promise<ActuaryInfo> => {
    const response = await api.patch(`/actuaries/${employeeId}/reset-limit`);
    return response.data;
  },
};

export default actuaryService;
