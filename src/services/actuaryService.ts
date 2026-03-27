import api from './api';
import type { ActuaryInfo, UpdateActuaryLimit } from '../types/celina3';

const actuaryService = {
  /**
   * GET /actuaries/agents?email=&firstName=&lastName=
   * Lista svih agenata (za supervizor portal).
   */
  getAgents: async (
    email?: string,
    firstName?: string,
    lastName?: string
  ): Promise<ActuaryInfo[]> => {
    const params: Record<string, string> = {};
    if (email) params.email = email;
    if (firstName) params.firstName = firstName;
    if (lastName) params.lastName = lastName;
    const response = await api.get('/actuaries/agents', { params });
    return response.data;
  },

  /**
   * GET /actuaries/{employeeId}
   * Aktuarski podaci za zaposlenog.
   */
  getInfo: async (employeeId: number): Promise<ActuaryInfo> => {
    const response = await api.get(`/actuaries/${employeeId}`);
    return response.data;
  },

  /**
   * PATCH /actuaries/{employeeId}/limit
   * Promena limita i needApproval za agenta.
   */
  updateLimit: async (employeeId: number, data: UpdateActuaryLimit): Promise<ActuaryInfo> => {
    const response = await api.patch(`/actuaries/${employeeId}/limit`, data);
    return response.data;
  },

  /**
   * PATCH /actuaries/{employeeId}/reset-limit
   * Reset usedLimit na 0.
   */
  resetLimit: async (employeeId: number): Promise<ActuaryInfo> => {
    const response = await api.patch(`/actuaries/${employeeId}/reset-limit`);
    return response.data;
  },
};

export default actuaryService;
