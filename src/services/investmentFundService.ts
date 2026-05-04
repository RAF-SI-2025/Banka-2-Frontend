import api from './api';
import type {
  InvestmentFundSummary,
  InvestmentFundDetail,
  FundPerformancePoint,
  CreateFundRequest,
  InvestFundRequest,
  WithdrawFundRequest,
  ClientFundPosition,
  ClientFundTransaction,
} from '@/types/celina4';

const investmentFundService = {
  /** GET /funds?search=X&sort=Y&direction=Z — lista svih fondova za Discovery stranicu. */
  async list(params?: { search?: string; sort?: string; direction?: string }): Promise<InvestmentFundSummary[]> {
    const { data } = await api.get<InvestmentFundSummary[]>('/funds', { params });
    return data;
  },

  /** GET /funds/{id} — detaljan prikaz fonda (info + holdings + performance). */
  async get(id: number): Promise<InvestmentFundDetail> {
    const { data } = await api.get<InvestmentFundDetail>(`/funds/${id}`);
    return data;
  },

  /** GET /funds/{id}/performance?from=...&to=... — tacke za grafik performansi. */
  async getPerformance(id: number, from?: string, to?: string): Promise<FundPerformancePoint[]> {
    const { data } = await api.get<FundPerformancePoint[]>(`/funds/${id}/performance`, {
      params: { from, to },
    });
    return data;
  },

  /** GET /funds/{id}/transactions — istorija uplata/povlacenja za fond. */
  async getTransactions(id: number): Promise<ClientFundTransaction[]> {
    const { data } = await api.get<ClientFundTransaction[]>(`/funds/${id}/transactions`);
    return data;
  },

  /** POST /funds — kreiranje novog fonda (samo supervizor). */
  async create(dto: CreateFundRequest): Promise<InvestmentFundDetail> {
    const { data } = await api.post<InvestmentFundDetail>('/funds', dto);
    return data;
  },

  /** POST /funds/{id}/invest — uplata u fond (klijent iz svog racuna, supervizor iz bankinog). */
  async invest(id: number, dto: InvestFundRequest): Promise<ClientFundPosition> {
    const { data } = await api.post<ClientFundPosition>(`/funds/${id}/invest`, dto);
    return data;
  },

  /** POST /funds/{id}/withdraw — povlacenje iz fonda. amount=undefined znaci celu poziciju. */
  async withdraw(id: number, dto: WithdrawFundRequest): Promise<ClientFundTransaction> {
    const { data } = await api.post<ClientFundTransaction>(`/funds/${id}/withdraw`, dto);
    return data;
  },

  /** GET /funds/my-positions — sve moje aktivne pozicije u svim fondovima. */
  async myPositions(): Promise<ClientFundPosition[]> {
    const { data } = await api.get<ClientFundPosition[]>('/funds/my-positions');
    return data;
  },

  /** GET /funds/bank-positions — pozicije banke u fondovima (supervizor only, za Profit Banke). */
  async bankPositions(): Promise<ClientFundPosition[]> {
    const { data } = await api.get<ClientFundPosition[]>('/funds/bank-positions');
    return data;
  },

  /**
   * POST /funds/{id}/reassign-manager — admin only (P1.2 BE endpoint).
   * Spec Celina 4 §324: dodeljuje fondu novog menadzera. BE validira
   * da je novi manager SUPERVISOR (400 ako nije, 404 ako fund/employee fali).
   */
  async reassignManager(fundId: number, newManagerEmployeeId: number): Promise<InvestmentFundDetail> {
    const { data } = await api.post<InvestmentFundDetail>(`/funds/${fundId}/reassign-manager`, {
      newManagerEmployeeId,
    });
    return data;
  },

  /**
   * Vraca fondove kojima upravlja zadat zaposleni. BE jos uvek nema namenski
   * endpoint, pa filtriramo lokalno preko `list()`. Spec Celina 4 (Nova)
   * §3797-3879: kad admin ukloni isSupervisor permisiju supervizoru koji
   * upravlja fondovima, FE prikazuje confirmation dialog pre nego sto BE
   * automatski prebaci vlasnistvo na admina.
   */
  async listByManager(employeeId: number): Promise<InvestmentFundDetail[]> {
    if (!Number.isFinite(employeeId) || employeeId <= 0) return [];
    const summaries = await this.list();
    const details = await Promise.all(
      summaries.map((summary) =>
        this.get(summary.id).catch(() => null),
      ),
    );
    return details.filter((d): d is InvestmentFundDetail => d != null && d.managerEmployeeId === employeeId);
  },
};

export default investmentFundService;
