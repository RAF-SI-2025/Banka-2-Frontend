import api from './api';
import type { Branch, BranchFilters } from '@/types/branches';

export const branchService = {
  /**
   * Vraca filtrirane lokacije (BRANCH + ATM). Svi filteri su opcionalni.
   * BE endpoint: GET /branches?type=&has24h=&hasDriveThrough=&search=
   *
   * R1-740: `BranchesPage` trenutno zove `list()` BEZ filtera i filtrira
   * client-side (samo ~72 redova → client-side je primereno, bez round-trip-a).
   * Server-side filter parametri su NAMERNO zadrzani (BE ih podrzava i pokriveni su
   * testovima) kao forward-compat API za eventualni veci dataset / drugu stranicu —
   * nisu mrtav kod nego nekoriscena (ali validna) sposobnost.
   */
  list: async (filters: BranchFilters = {}): Promise<Branch[]> => {
    const params: Record<string, string> = {};
    if (filters.type) params.type = filters.type;
    if (filters.has24h) params.has24h = 'true';
    if (filters.hasDriveThrough) params.hasDriveThrough = 'true';
    if (filters.search && filters.search.trim()) params.search = filters.search.trim();
    const response = await api.get<Branch[]>('/branches', { params });
    return response.data;
  },
};
