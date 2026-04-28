import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import interbankPaymentService from './interbankPaymentService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('interbankPaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiatePayment sends POST /payments and maps PaymentResponseDto -> InterbankPayment', async () => {
    const dto = {
      senderAccountNumber: '222000100000000110',
      receiverAccountNumber: '111000100000000999',
      receiverName: 'Test Receiver',
      amount: 1250,
      currency: 'RSD',
      description: 'Interbank test',
      otpCode: '123456',
    };

    mockedApi.post.mockResolvedValue({
      data: {
        id: 1,
        fromAccount: dto.senderAccountNumber,
        toAccount: dto.receiverAccountNumber,
        amount: dto.amount,
        fee: 0,
        currency: dto.currency,
        recipientName: dto.receiverName,
        description: dto.description,
        status: 'PENDING',
        createdAt: '2026-04-25T12:00:00',
      },
    });

    const result = await interbankPaymentService.initiatePayment(dto);

    expect(mockedApi.post).toHaveBeenCalledWith('/payments', {
      fromAccount: dto.senderAccountNumber,
      toAccount: dto.receiverAccountNumber,
      amount: dto.amount,
      paymentCode: '289',
      referenceNumber: undefined,
      description: dto.description,
      recipientName: dto.receiverName,
      otpCode: dto.otpCode,
    });

    expect(result).toEqual({
      id: 1,
      transactionId: '1',
      status: 'INITIATED',
      senderAccountNumber: dto.senderAccountNumber,
      receiverAccountNumber: dto.receiverAccountNumber,
      amount: dto.amount,
      currency: dto.currency,
      exchangeRate: null,
      convertedAmount: null,
      convertedCurrency: null,
      commissionAmount: 0,
      createdAt: '2026-04-25T12:00:00',
      preparedAt: null,
      committedAt: null,
      abortedAt: null,
      failureReason: null,
    });
  });

  it('getStatus sends GET /payments/{id} and maps status', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        id: 1,
        fromAccount: '222000100000000110',
        toAccount: '111000100000000999',
        amount: 1250,
        fee: 12.5,
        currency: 'RSD',
        recipientName: 'Test Receiver',
        description: 'Interbank test',
        status: 'COMPLETED',
        createdAt: '2026-04-25T12:00:00',
      },
    });

    const result = await interbankPaymentService.getStatus('1');

    expect(mockedApi.get).toHaveBeenCalledWith('/payments/1');
    expect(result.status).toBe('COMMITTED');
    expect(result.transactionId).toBe('1');
  });

  it('myHistory sends GET /payments?page&size and maps list items', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        content: [
          {
            id: 2,
            fromAccount: '222000100000000110',
            toAccount: '111000100000000999',
            amount: 500,
            fee: 0,
            currency: 'RSD',
            recipientName: 'Receiver',
            description: 'Desc',
            status: 'COMPLETED',
            createdAt: '2026-04-25T12:00:00',
          },
        ],
      },
    });

    const result = await interbankPaymentService.myHistory();

    expect(mockedApi.get).toHaveBeenCalledWith('/payments', {
      params: expect.any(URLSearchParams),
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 2,
      transactionId: '2',
      status: 'COMMITTED',
    });
  });
});
