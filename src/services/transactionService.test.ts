import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { transactionService } from './transactionService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('transactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== createPayment ====================

  describe('createPayment', () => {
    const paymentData = {
      fromAccountNumber: '111111111111111111',
      toAccountNumber: '222222222222222222',
      amount: 5000,
      paymentCode: '289',
      paymentPurpose: 'Uplata za racun',
      referenceNumber: '97-1234',
      recipientName: 'Marko Markovic',
      model: '97',
      callNumber: '1234',
    };

    it('should send payment with mapped fields and no OTP', async () => {
      const mockResponse = { id: 1, ...paymentData, status: 'COMPLETED' };
      mockedApi.post.mockResolvedValue({ data: mockResponse });

      const result = await transactionService.createPayment(paymentData);

      expect(mockedApi.post).toHaveBeenCalledWith('/payments', {
        fromAccount: paymentData.fromAccountNumber,
        toAccount: paymentData.toAccountNumber,
        amount: paymentData.amount,
        paymentCode: paymentData.paymentCode,
        description: paymentData.paymentPurpose,
        referenceNumber: paymentData.referenceNumber,
        recipientName: paymentData.recipientName,
        model: paymentData.model,
        callNumber: paymentData.callNumber,
        otpCode: '',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should send payment with OTP code', async () => {
      const mockResponse = { id: 1, status: 'COMPLETED' };
      mockedApi.post.mockResolvedValue({ data: mockResponse });

      await transactionService.createPayment(paymentData, '123456');

      expect(mockedApi.post).toHaveBeenCalledWith('/payments', expect.objectContaining({
        otpCode: '123456',
      }));
    });

    it('should propagate API errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Network error'));

      await expect(transactionService.createPayment(paymentData)).rejects.toThrow('Network error');
    });
  });

  // ==================== requestOtp ====================

  describe('requestOtp', () => {
    it('should call POST /payments/request-otp', async () => {
      const mockResponse = { sent: true, message: 'OTP sent' };
      mockedApi.post.mockResolvedValue({ data: mockResponse });

      const result = await transactionService.requestOtp();

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/request-otp');
      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Server error'));
      await expect(transactionService.requestOtp()).rejects.toThrow('Server error');
    });
  });

  // ==================== requestOtpViaEmail ====================

  describe('requestOtpViaEmail', () => {
    it('should call POST /payments/request-otp-email', async () => {
      const mockResponse = { sent: true, message: 'OTP sent via email' };
      mockedApi.post.mockResolvedValue({ data: mockResponse });

      const result = await transactionService.requestOtpViaEmail();

      expect(mockedApi.post).toHaveBeenCalledWith('/payments/request-otp-email');
      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Failed'));
      await expect(transactionService.requestOtpViaEmail()).rejects.toThrow('Failed');
    });
  });

  // ==================== getAll ====================

  describe('getAll', () => {
    it('should fetch all transactions without filters', async () => {
      const mockResponse = { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 };
      mockedApi.get.mockResolvedValue({ data: mockResponse });

      const result = await transactionService.getAll();

      expect(mockedApi.get).toHaveBeenCalledWith('/payments', { params: expect.any(URLSearchParams) });
      expect(result).toEqual(mockResponse);
    });

    it('should pass all filters as params', async () => {
      const filters = {
        status: 'COMPLETED' as const,
        accountNumber: '111111111111111111',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
        amountMin: 100,
        amountMax: 5000,
        page: 1,
        limit: 10,
      };
      const mockResponse = { content: [], totalElements: 0, totalPages: 0, size: 10, number: 1 };
      mockedApi.get.mockResolvedValue({ data: mockResponse });

      await transactionService.getAll(filters);

      const callArgs = mockedApi.get.mock.calls[0];
      const params = callArgs[1]?.params as URLSearchParams;
      expect(params.get('status')).toBe('COMPLETED');
      expect(params.get('accountNumber')).toBe('111111111111111111');
      expect(params.get('fromDate')).toBe('2026-01-01');
      expect(params.get('toDate')).toBe('2026-03-31');
      expect(params.get('minAmount')).toBe('100');
      expect(params.get('maxAmount')).toBe('5000');
      expect(params.get('page')).toBe('1');
      expect(params.get('size')).toBe('10');
    });

    it('should omit undefined filters', async () => {
      mockedApi.get.mockResolvedValue({ data: { content: [] } });

      await transactionService.getAll({ status: 'PENDING' as const });

      const params = mockedApi.get.mock.calls[0][1]?.params as URLSearchParams;
      expect(params.get('status')).toBe('PENDING');
      expect(params.get('accountNumber')).toBeNull();
      expect(params.get('fromDate')).toBeNull();
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Fetch failed'));
      await expect(transactionService.getAll()).rejects.toThrow('Fetch failed');
    });
  });

  // ==================== getById ====================

  describe('getById', () => {
    it('should fetch a transaction by id', async () => {
      const mockTransaction = { id: 42, amount: 1000, status: 'COMPLETED' };
      mockedApi.get.mockResolvedValue({ data: mockTransaction });

      const result = await transactionService.getById(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/payments/42');
      expect(result).toEqual(mockTransaction);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(transactionService.getById(999)).rejects.toThrow('Not found');
    });
  });

  // ==================== createTransfer ====================

  describe('createTransfer', () => {
    const transferData = {
      fromAccountNumber: '111111111111111111',
      toAccountNumber: '222222222222222222',
      amount: 1000,
    };

    it('should send transfer with mapped response', async () => {
      const mockResponse = {
        id: 1,
        fromAccountNumber: '111111111111111111',
        toAccountNumber: '222222222222222222',
        amount: 1000,
        fromCurrency: 'RSD',
        toCurrency: 'RSD',
        status: 'COMPLETED',
        createdAt: '2026-03-01',
      };
      mockedApi.post.mockResolvedValue({ data: mockResponse });

      const result = await transactionService.createTransfer(transferData);

      expect(mockedApi.post).toHaveBeenCalledWith('/transfers/internal', { ...transferData, otpCode: '' });
      expect(result.id).toBe(1);
      expect(result.amount).toBe(1000);
    });

    it('should include OTP code when provided', async () => {
      mockedApi.post.mockResolvedValue({
        data: { id: 1, fromAccountNumber: '1', toAccountNumber: '2', amount: 100, status: 'COMPLETED', createdAt: '' },
      });

      await transactionService.createTransfer(transferData, '654321');

      expect(mockedApi.post).toHaveBeenCalledWith('/transfers/internal', { ...transferData, otpCode: '654321' });
    });

    it('should map exchangeRate and toAmount from backend response', async () => {
      const backendData = {
        id: 5,
        fromAccountNumber: '111',
        toAccountNumber: '222',
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'RSD',
        exchangeRate: 117.5,
        toAmount: 11750,
        commission: 50,
        status: 'COMPLETED',
        createdAt: '2026-03-15',
      };
      mockedApi.post.mockResolvedValue({ data: backendData });

      const result = await transactionService.createTransfer(transferData);

      expect(result.exchangeRate).toBe(117.5);
      expect(result.convertedAmount).toBe(11750);
      expect(result.commission).toBe(50);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Transfer failed'));
      await expect(transactionService.createTransfer(transferData)).rejects.toThrow('Transfer failed');
    });
  });

  // R1 339: createFxTransfer uklonjen iz transactionService (mrtav iz UI-ja) —
  // pripadajuci testovi takodje uklonjeni. FX ide kroz createTransfer (/transfers/internal).

  // ==================== getTransfers ====================

  describe('getTransfers', () => {
    it('should fetch transfers and map response', async () => {
      const backendTransfers = [
        {
          id: 1, fromAccountNumber: '111', toAccountNumber: '222',
          amount: 1000, fromCurrency: 'RSD', toCurrency: 'RSD',
          status: 'COMPLETED', createdAt: '2026-03-01',
        },
        {
          id: 2, fromAccountNumber: '333', toAccountNumber: '444',
          amount: 2000, fromCurrency: 'EUR', toCurrency: 'RSD',
          exchangeRate: 117.5, toAmount: 235000,
          status: 'PENDING', createdAt: '2026-03-02',
        },
      ];
      mockedApi.get.mockResolvedValue({ data: backendTransfers });

      const result = await transactionService.getTransfers();

      expect(mockedApi.get).toHaveBeenCalledWith('/transfers', { params: expect.any(URLSearchParams) });
      expect(result).toHaveLength(2);
      expect(result[1].convertedAmount).toBe(235000);
    });

    it('should pass filters as params', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await transactionService.getTransfers({
        accountNumber: '111',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
      });

      const params = mockedApi.get.mock.calls[0][1]?.params as URLSearchParams;
      expect(params.get('accountNumber')).toBe('111');
      expect(params.get('fromDate')).toBe('2026-01-01');
      expect(params.get('toDate')).toBe('2026-03-31');
    });

    it('should handle non-array response gracefully', async () => {
      mockedApi.get.mockResolvedValue({ data: null });

      const result = await transactionService.getTransfers();

      expect(result).toEqual([]);
    });

    it('should handle object response gracefully', async () => {
      mockedApi.get.mockResolvedValue({ data: { something: 'unexpected' } });

      const result = await transactionService.getTransfers();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));
      await expect(transactionService.getTransfers()).rejects.toThrow('Network error');
    });
  });

  // ==================== getPaymentReceipt ====================

  describe('getPaymentReceipt', () => {
    it('should fetch receipt as blob', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      mockedApi.get.mockResolvedValue({ data: mockBlob });

      const result = await transactionService.getPaymentReceipt(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/payments/42/receipt', { responseType: 'blob' });
      expect(result).toBe(mockBlob);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(transactionService.getPaymentReceipt(999)).rejects.toThrow('Not found');
    });
  });
});
