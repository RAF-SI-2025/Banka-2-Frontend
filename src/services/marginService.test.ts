import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import marginService from './marginService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('marginService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getMyAccounts ====================

  describe('getMyAccounts', () => {
    it('should fetch margin accounts', async () => {
      // P1-fe-contracts-1: BE MarginAccountDto shape (accountId/userId/companyId,
      // bez linkedAccountNumber/currency).
      const accounts = [
        {
          id: 1,
          accountId: 5,
          accountNumber: '111111111111111111',
          userId: 42,
          companyId: null,
          status: 'ACTIVE',
          initialMargin: 10000,
          loanValue: 5000,
          maintenanceMargin: 3000,
          bankParticipation: 0.5,
          createdAt: '2026-03-01T10:00:00',
        },
      ];
      mockedApi.get.mockResolvedValue({ data: accounts });

      const result = await marginService.getMyAccounts();

      expect(mockedApi.get).toHaveBeenCalledWith('/margin-accounts/my');
      expect(result).toEqual(accounts);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no accounts', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      const result = await marginService.getMyAccounts();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Unauthorized'));
      await expect(marginService.getMyAccounts()).rejects.toThrow('Unauthorized');
    });
  });

  // ==================== deposit ====================

  describe('deposit', () => {
    it('should send deposit request', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await marginService.deposit(1, 5000);

      expect(mockedApi.post).toHaveBeenCalledWith('/margin-accounts/1/deposit', { amount: 5000 });
    });

    it('should handle large amounts', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await marginService.deposit(1, 1000000);

      expect(mockedApi.post).toHaveBeenCalledWith('/margin-accounts/1/deposit', { amount: 1000000 });
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Insufficient funds'));
      await expect(marginService.deposit(1, 999999)).rejects.toThrow('Insufficient funds');
    });
  });

  // ==================== withdraw ====================

  describe('withdraw', () => {
    it('should send withdrawal request', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await marginService.withdraw(1, 2000);

      expect(mockedApi.post).toHaveBeenCalledWith('/margin-accounts/1/withdraw', { amount: 2000 });
    });

    it('should handle different account ids', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await marginService.withdraw(42, 500);

      expect(mockedApi.post).toHaveBeenCalledWith('/margin-accounts/42/withdraw', { amount: 500 });
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Insufficient margin'));
      await expect(marginService.withdraw(1, 999999)).rejects.toThrow('Insufficient margin');
    });
  });

  // ==================== getTransactions ====================

  describe('getTransactions', () => {
    it('should fetch transactions for margin account', async () => {
      const transactions = [
        { id: 1, marginAccountId: 1, type: 'DEPOSIT', amount: 5000, currency: 'RSD', createdAt: '2026-03-01', description: 'Initial deposit' },
        { id: 2, marginAccountId: 1, type: 'WITHDRAWAL', amount: 2000, currency: 'RSD', createdAt: '2026-03-02' },
      ];
      mockedApi.get.mockResolvedValue({ data: transactions });

      const result = await marginService.getTransactions(1);

      expect(mockedApi.get).toHaveBeenCalledWith('/margin-accounts/1/transactions');
      expect(result).toEqual(transactions);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no transactions', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      const result = await marginService.getTransactions(1);

      expect(result).toEqual([]);
    });

    it('should handle different account ids', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await marginService.getTransactions(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/margin-accounts/42/transactions');
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(marginService.getTransactions(999)).rejects.toThrow('Not found');
    });
  });
});
