import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import investmentFundService from './investmentFundService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('investmentFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== list ====================

  describe('list', () => {
    it('should fetch all funds without params', async () => {
      const funds = [{ id: 1, name: 'Alpha Fund', fundValue: 1000000 }];
      mockedApi.get.mockResolvedValue({ data: funds });

      const result = await investmentFundService.list();

      expect(mockedApi.get).toHaveBeenCalledWith('/funds', { params: undefined });
      expect(result).toEqual(funds);
    });

    it('should pass search and sort params', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await investmentFundService.list({ search: 'Alpha', sort: 'fundValue', direction: 'desc' });

      expect(mockedApi.get).toHaveBeenCalledWith('/funds', {
        params: { search: 'Alpha', sort: 'fundValue', direction: 'desc' },
      });
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));
      await expect(investmentFundService.list()).rejects.toThrow('Network error');
    });
  });

  // ==================== get ====================

  describe('get', () => {
    it('should fetch fund by id', async () => {
      const fund = { id: 1, name: 'Alpha Fund', fundValue: 2600000 };
      mockedApi.get.mockResolvedValue({ data: fund });

      const result = await investmentFundService.get(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/funds/1');
      expect(result).toEqual(fund);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(investmentFundService.get(999)).rejects.toThrow('Not found');
    });
  });

  // ==================== getPerformance ====================

  describe('getPerformance', () => {
    it('should fetch performance with date range', async () => {
      const points = [{ date: '2026-01-01', fundValue: 1000000, profit: 50000 }];
      mockedApi.get.mockResolvedValue({ data: points });

      const result = await investmentFundService.getPerformance(1, '2026-01-01', '2026-04-01');

      expect(mockedApi.get).toHaveBeenCalledWith('/funds/1/performance', {
        params: { from: '2026-01-01', to: '2026-04-01' },
      });
      expect(result).toEqual(points);
    });

    it('should fetch performance without date range', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await investmentFundService.getPerformance(5);

      expect(mockedApi.get).toHaveBeenCalledWith('/funds/5/performance', {
        params: { from: undefined, to: undefined },
      });
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Server error'));
      await expect(investmentFundService.getPerformance(1)).rejects.toThrow('Server error');
    });
  });

  // ==================== getTransactions ====================

  describe('getTransactions', () => {
    it('should fetch transactions for a fund', async () => {
      const txs = [{ id: 1, fundId: 1, amountRsd: 5000, inflow: true, status: 'COMPLETED' }];
      mockedApi.get.mockResolvedValue({ data: txs });

      const result = await investmentFundService.getTransactions(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/funds/1/transactions');
      expect(result).toEqual(txs);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Forbidden'));
      await expect(investmentFundService.getTransactions(1)).rejects.toThrow('Forbidden');
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a new fund', async () => {
      const dto = { name: 'Beta Fund', description: 'IT sektor', minimumContribution: 1000 };
      const created = { id: 2, ...dto, fundValue: 0, liquidAmount: 0, profit: 0 };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await investmentFundService.create(dto);

      expect(mockedApi.post).toHaveBeenCalledWith('/funds', dto);
      expect(result).toEqual(created);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Duplicate name'));
      await expect(
        investmentFundService.create({ name: 'X', description: 'Y', minimumContribution: 100 })
      ).rejects.toThrow('Duplicate name');
    });
  });

  // ==================== invest ====================

  describe('invest', () => {
    it('should invest in a fund', async () => {
      const dto = { amount: 50000, currency: 'RSD', sourceAccountId: 10 };
      const position = { id: 1, fundId: 1, totalInvested: 50000, currentValue: 50000 };
      mockedApi.post.mockResolvedValue({ data: position });

      const result = await investmentFundService.invest(1, dto);

      expect(mockedApi.post).toHaveBeenCalledWith('/funds/1/invest', dto);
      expect(result).toEqual(position);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Insufficient balance'));
      await expect(
        investmentFundService.invest(1, { amount: 999999, currency: 'RSD', sourceAccountId: 10 })
      ).rejects.toThrow('Insufficient balance');
    });
  });

  // ==================== withdraw ====================

  describe('withdraw', () => {
    it('should withdraw from a fund with specific amount', async () => {
      const dto = { amount: 10000, destinationAccountId: 5 };
      const tx = { id: 1, fundId: 1, amountRsd: 10000, status: 'COMPLETED', inflow: false };
      mockedApi.post.mockResolvedValue({ data: tx });

      const result = await investmentFundService.withdraw(1, dto);

      expect(mockedApi.post).toHaveBeenCalledWith('/funds/1/withdraw', dto);
      expect(result).toEqual(tx);
    });

    it('should withdraw entire position when amount is undefined', async () => {
      const dto = { destinationAccountId: 5 };
      const tx = { id: 2, fundId: 1, amountRsd: 50000, status: 'PENDING', inflow: false };
      mockedApi.post.mockResolvedValue({ data: tx });

      const result = await investmentFundService.withdraw(1, dto);

      expect(mockedApi.post).toHaveBeenCalledWith('/funds/1/withdraw', dto);
      expect(result.status).toBe('PENDING');
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Withdraw failed'));
      await expect(
        investmentFundService.withdraw(1, { destinationAccountId: 5 })
      ).rejects.toThrow('Withdraw failed');
    });
  });

  // ==================== myPositions ====================

  describe('myPositions', () => {
    it('should fetch my positions', async () => {
      const positions = [{ id: 1, fundId: 1, fundName: 'Alpha', totalInvested: 25000 }];
      mockedApi.get.mockResolvedValue({ data: positions });

      const result = await investmentFundService.myPositions();

      expect(mockedApi.get).toHaveBeenCalledWith('/funds/my-positions');
      expect(result).toEqual(positions);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Unauthorized'));
      await expect(investmentFundService.myPositions()).rejects.toThrow('Unauthorized');
    });
  });

  // ==================== bankPositions ====================

  describe('bankPositions', () => {
    it('should fetch bank positions', async () => {
      const positions = [{ id: 1, fundId: 1, fundName: 'Alpha', userRole: 'BANK' }];
      mockedApi.get.mockResolvedValue({ data: positions });

      const result = await investmentFundService.bankPositions();

      expect(mockedApi.get).toHaveBeenCalledWith('/funds/bank-positions');
      expect(result).toEqual(positions);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Forbidden'));
      await expect(investmentFundService.bankPositions()).rejects.toThrow('Forbidden');
    });
  });
});
