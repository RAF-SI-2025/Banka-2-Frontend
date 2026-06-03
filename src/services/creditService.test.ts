import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { creditService } from './creditService';
import type { LoanType, InterestRateType, LoanStatus } from '../types/celina2';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('creditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getMyLoans ====================

  describe('getMyLoans', () => {
    it('should fetch loans and map BE types to FE types', async () => {
      const backendLoans = [
        { id: 1, loanType: 'CASH', interestType: 'FIXED', amount: 100000, status: 'ACTIVE' },
        { id: 2, loanType: 'MORTGAGE', interestType: 'VARIABLE', amount: 500000, status: 'ACTIVE' },
      ];
      mockedApi.get.mockResolvedValue({ data: { content: backendLoans } });

      const result = await creditService.getMyLoans();

      expect(mockedApi.get).toHaveBeenCalledWith('/loans/my');
      expect(result).toHaveLength(2);
      expect(result[0].loanType).toBe('GOTOVINSKI');
      expect(result[0].interestRateType).toBe('FIKSNI');
      expect(result[1].loanType).toBe('STAMBENI');
      expect(result[1].interestRateType).toBe('VARIJABILNI');
    });

    it('should handle plain array response', async () => {
      const backendLoans = [
        { id: 1, loanType: 'AUTO', interestRateType: 'FIXED', amount: 200000 },
      ];
      mockedApi.get.mockResolvedValue({ data: backendLoans });

      const result = await creditService.getMyLoans();

      expect(result).toHaveLength(1);
      expect(result[0].loanType).toBe('AUTO');
    });

    it('should handle empty content', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: [] } });

      const result = await creditService.getMyLoans();

      expect(result).toEqual([]);
    });

    it('should handle response without content field', async () => {
      mockedApi.get.mockResolvedValue({ data: {} });

      const result = await creditService.getMyLoans();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Unauthorized'));
      await expect(creditService.getMyLoans()).rejects.toThrow('Unauthorized');
    });
  });

  // ==================== getAll ====================

  describe('getAll', () => {
    it('should fetch all loans with type mapping in filters', async () => {
      const mockResponse = {
        content: [{ id: 1, loanType: 'CASH', interestType: 'FIXED', amount: 100000 }],
        totalElements: 1,
        totalPages: 1,
        size: 20,
        number: 0,
      };
      mockedApi.get.mockResolvedValue({ data: mockResponse });

      const result = await creditService.getAll({ loanType: 'GOTOVINSKI' as LoanType });

      const params = mockedApi.get.mock.calls[0][1]?.params as URLSearchParams;
      expect(params.get('loanType')).toBe('CASH');
      expect(result.content[0].loanType).toBe('GOTOVINSKI');
    });

    it('should pass status, accountNumber, page and size filters', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: [] } });

      await creditService.getAll({
        status: 'ACTIVE' as LoanStatus,
        accountNumber: '111111111111111111',
        page: 1,
        limit: 10,
      });

      const params = mockedApi.get.mock.calls[0][1]?.params as URLSearchParams;
      expect(params.get('status')).toBe('ACTIVE');
      expect(params.get('accountNumber')).toBe('111111111111111111');
      expect(params.get('page')).toBe('1');
      expect(params.get('size')).toBe('10');
    });

    it('should handle no filters', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: [] } });

      await creditService.getAll();

      expect(mockedApi.get).toHaveBeenCalledWith('/loans', { params: expect.any(URLSearchParams) });
    });

    it('should handle null content gracefully', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: null, totalElements: 0 } });

      const result = await creditService.getAll();

      expect(result.content).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Server error'));
      await expect(creditService.getAll()).rejects.toThrow('Server error');
    });
  });

  // ==================== getById ====================

  describe('getById', () => {
    it('should fetch loan by id and map types', async () => {
      const backendLoan = { id: 5, loanType: 'STUDENT', interestType: 'VARIABLE', amount: 50000 };
      mockedApi.get.mockResolvedValue({ data: backendLoan });

      const result = await creditService.getById(5);

      expect(mockedApi.get).toHaveBeenCalledWith('/loans/5');
      expect(result.loanType).toBe('STUDENTSKI');
      expect(result.interestRateType).toBe('VARIJABILNI');
    });

    it('should keep unknown types as-is', async () => {
      const backendLoan = { id: 6, loanType: 'UNKNOWN_TYPE', interestRateType: 'UNKNOWN_RATE', amount: 10000 };
      mockedApi.get.mockResolvedValue({ data: backendLoan });

      const result = await creditService.getById(6);

      expect(result.loanType).toBe('UNKNOWN_TYPE');
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(creditService.getById(999)).rejects.toThrow('Not found');
    });
  });

  // ==================== apply ====================

  describe('apply', () => {
    it('should submit loan application with FE to BE type mapping', async () => {
      const applicationData = {
        loanType: 'GOTOVINSKI' as LoanType,
        interestRateType: 'FIKSNI' as InterestRateType,
        amount: 100000,
        currency: 'RSD' as const,
        loanPurpose: 'Kupovina automobila',
        repaymentPeriod: 24,
        accountNumber: '111111111111111111',
        phoneNumber: '0601234567',
      };
      const backendResponse = {
        id: 20,
        loanType: 'CASH',
        interestType: 'FIXED',
        amount: 100000,
        status: 'PENDING',
        createdAt: '2026-03-15',
      };
      mockedApi.post.mockResolvedValue({ data: backendResponse });

      const result = await creditService.apply(applicationData);

      expect(mockedApi.post).toHaveBeenCalledWith('/loans', expect.objectContaining({
        loanType: 'CASH',
        interestType: 'FIXED',
        amount: 100000,
        loanPurpose: 'Kupovina automobila',
      }));
      // interestRateType should NOT be in the payload (replaced by interestType)
      const payload = mockedApi.post.mock.calls[0][1];
      expect(payload).not.toHaveProperty('interestRateType');
      // Result should be mapped back to FE types
      expect(result.loanType).toBe('GOTOVINSKI');
      expect(result.interestRateType).toBe('FIKSNI');
    });

    it('should NOT send otpCode in the apply payload (OTP removed 03.06)', async () => {
      mockedApi.post.mockResolvedValue({ data: { id: 1, loanType: 'CASH', interestType: 'FIXED', status: 'PENDING' } });

      await creditService.apply({
        loanType: 'GOTOVINSKI' as LoanType,
        interestRateType: 'FIKSNI' as InterestRateType,
        amount: 100000,
        currency: 'RSD' as const,
        loanPurpose: 'Test',
        repaymentPeriod: 12,
        accountNumber: '111111111111111111',
        phoneNumber: '060',
        otpCode: '123456',
      });

      // ACCEPTED-DEVIATION (user-directed 03.06): apply ne salje OTP — i ako je
      // prosledjen u argumentu, servis ga odbacuje iz body-ja.
      const payload = mockedApi.post.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('otpCode');
    });

    it('should handle BE types passed directly', async () => {
      const applicationData = {
        loanType: 'CASH' as LoanType,
        interestRateType: 'FIXED' as InterestRateType,
        amount: 50000,
        currency: 'RSD' as const,
        loanPurpose: 'Test',
        repaymentPeriod: 12,
        accountNumber: '111111111111111111',
        phoneNumber: '060',
      };
      mockedApi.post.mockResolvedValue({ data: { id: 1, loanType: 'CASH', interestType: 'FIXED', status: 'PENDING' } });

      await creditService.apply(applicationData);

      const payload = mockedApi.post.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.loanType).toBe('CASH');
      expect(payload.interestType).toBe('FIXED');
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Validation error'));
      await expect(
        creditService.apply({
          loanType: 'GOTOVINSKI' as LoanType,
          interestRateType: 'FIKSNI' as InterestRateType,
          amount: 0,
          currency: 'RSD' as const,
          loanPurpose: '',
          repaymentPeriod: 0,
          accountNumber: '',
          phoneNumber: '',
        })
      ).rejects.toThrow('Validation error');
    });
  });

  // ==================== approve ====================

  describe('approve', () => {
    it('should approve a loan request', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await creditService.approve(10);

      expect(mockedApi.patch).toHaveBeenCalledWith('/loans/requests/10/approve');
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Approval failed'));
      await expect(creditService.approve(999)).rejects.toThrow('Approval failed');
    });
  });

  // ==================== reject ====================

  describe('reject', () => {
    it('should reject a loan request', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await creditService.reject(10);

      expect(mockedApi.patch).toHaveBeenCalledWith('/loans/requests/10/reject');
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Rejection failed'));
      await expect(creditService.reject(999)).rejects.toThrow('Rejection failed');
    });
  });

  // ==================== getInstallments ====================

  describe('getInstallments', () => {
    it('should fetch installments for a loan', async () => {
      const installments = [
        { id: 1, loanNumber: 'L001', amount: 5000, paid: false },
        { id: 2, loanNumber: 'L001', amount: 5000, paid: true },
      ];
      mockedApi.get.mockResolvedValue({ data: installments });

      const result = await creditService.getInstallments(5);

      expect(mockedApi.get).toHaveBeenCalledWith('/loans/5/installments');
      expect(result).toEqual(installments);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(creditService.getInstallments(999)).rejects.toThrow('Not found');
    });
  });

  // ==================== earlyRepayment ====================

  describe('earlyRepayment', () => {
    // ACCEPTED-DEVIATION (user-directed 03.06): prevremena otplata bez OTP gate-a.
    it('should request early repayment without any OTP header', async () => {
      mockedApi.post.mockResolvedValue({ data: undefined });

      await creditService.earlyRepayment(5);

      expect(mockedApi.post).toHaveBeenCalledWith('/loans/5/early-repayment', null);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Repayment failed'));
      await expect(creditService.earlyRepayment(999)).rejects.toThrow('Repayment failed');
    });
  });

  // ==================== getMyRequests ====================

  describe('getMyRequests', () => {
    it('should fetch my loan requests', async () => {
      const requests = [
        { id: 1, loanType: 'GOTOVINSKI', status: 'PENDING' },
        { id: 2, loanType: 'AUTO', status: 'APPROVED' },
      ];
      mockedApi.get.mockResolvedValue({ data: requests });

      const result = await creditService.getMyRequests();

      expect(mockedApi.get).toHaveBeenCalledWith('/loans/requests/my');
      expect(result).toEqual(requests);
    });

    it('should return empty array for non-array response', async () => {
      mockedApi.get.mockResolvedValue({ data: null });

      const result = await creditService.getMyRequests();

      expect(result).toEqual([]);
    });

    it('should return empty array for object response', async () => {
      mockedApi.get.mockResolvedValue({ data: { unexpected: true } });

      const result = await creditService.getMyRequests();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Unauthorized'));
      await expect(creditService.getMyRequests()).rejects.toThrow('Unauthorized');
    });
  });

  // ==================== getRequests ====================

  describe('getRequests', () => {
    it('should fetch all loan requests with filters and map types', async () => {
      const mockResponse = {
        content: [
          { id: 1, loanType: 'CASH', interestType: 'FIXED', status: 'PENDING' },
          { id: 2, loanType: 'REFINANCING', interestType: 'VARIABLE', status: 'APPROVED' },
        ],
        totalElements: 2,
        totalPages: 1,
        size: 20,
        number: 0,
      };
      mockedApi.get.mockResolvedValue({ data: mockResponse });

      const result = await creditService.getRequests({ status: 'PENDING' as LoanStatus, page: 0, limit: 20 });

      const params = mockedApi.get.mock.calls[0][1]?.params as URLSearchParams;
      expect(params.get('status')).toBe('PENDING');
      expect(params.get('page')).toBe('0');
      expect(params.get('size')).toBe('20');
      expect(result.content[0].loanType).toBe('GOTOVINSKI');
      expect(result.content[0].interestRateType).toBe('FIKSNI');
      expect(result.content[1].loanType).toBe('REFINANSIRAJUCI');
      expect(result.content[1].interestRateType).toBe('VARIJABILNI');
    });

    it('should handle null content gracefully', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: null, totalElements: 0 } });

      const result = await creditService.getRequests();

      expect(result.content).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Server error'));
      await expect(creditService.getRequests()).rejects.toThrow('Server error');
    });
  });
});
