import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import interbankPaymentService from './interbankPaymentService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('interbankPaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiatePayment sends POST /interbank/payments/initiate', async () => {
    const dto = {
      senderAccountNumber: '222000100000000110',
      receiverAccountNumber: '111000100000000999',
      receiverName: 'Test Receiver',
      amount: 1250,
      currency: 'RSD',
      description: 'Interbank test',
      otpCode: '123456',
    };
    const payment = {
      id: 1,
      transactionId: 'tx-1',
      status: 'INITIATED' as const,
      senderAccountNumber: dto.senderAccountNumber,
      receiverAccountNumber: dto.receiverAccountNumber,
      amount: dto.amount,
      currency: dto.currency,
      createdAt: '2026-04-25T12:00:00',
    };
    mockedApi.post.mockResolvedValue({ data: payment });

    const result = await interbankPaymentService.initiatePayment(dto);

    expect(mockedApi.post).toHaveBeenCalledWith('/interbank/payments/initiate', dto);
    expect(result).toEqual(payment);
  });

  it('getStatus sends GET /interbank/payments/{txId}', async () => {
    const statusPayload = {
      id: 1,
      transactionId: 'tx-1',
      status: 'PREPARING' as const,
      senderAccountNumber: '222000100000000110',
      receiverAccountNumber: '111000100000000999',
      amount: 1250,
      currency: 'RSD',
      createdAt: '2026-04-25T12:00:00',
    };
    mockedApi.get.mockResolvedValue({ data: statusPayload });

    const result = await interbankPaymentService.getStatus('tx-1');

    expect(mockedApi.get).toHaveBeenCalledWith('/interbank/payments/tx-1');
    expect(result).toEqual(statusPayload);
  });

  it('myHistory sends GET /interbank/payments/my', async () => {
    const history = [
      {
        id: 1,
        transactionId: 'tx-1',
        status: 'COMMITTED' as const,
        senderAccountNumber: '222000100000000110',
        receiverAccountNumber: '111000100000000999',
        amount: 1250,
        currency: 'RSD',
        createdAt: '2026-04-25T12:00:00',
      },
    ];
    mockedApi.get.mockResolvedValue({ data: history });

    const result = await interbankPaymentService.myHistory();

    expect(mockedApi.get).toHaveBeenCalledWith('/interbank/payments/my');
    expect(result).toEqual(history);
  });
});
