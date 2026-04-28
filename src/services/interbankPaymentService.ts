import api from './api';
import type { InterbankPayment, InterbankPaymentInitiateRequest } from '@/types/celina4';

/*
================================================================================
 INTER-BANK PLACANJA — FE SERVICE WRAPPER (TEMP)
--------------------------------------------------------------------------------
 Trenutni BE (swagger) nema posebne interbank endpoint-e (nema /interbank-tx).
 Sve ide kroz standardne payment rute:

  - POST /api/payments          -> PaymentResponseDto (status: PENDING/PROCESSING/...)
  - GET  /api/payments/{id}     -> PaymentResponseDto (za polling statusa)
  - GET  /api/payments?page&size -> Page<PaymentListItemDto> (istorija/lista)

 Ovaj servis i dalje izlaže "InterbankPayment" tip (celina4) da NewPaymentPage
 zadrži overlay/poll UX, ali se podaci mapiraju iz standardnih payment DTO-a.
================================================================================
*/

type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

type PaymentResponseDto = {
  id: number;
  fromAccount: string;
  toAccount: string;
  amount: number;
  fee?: number;
  currency: string;
  recipientName?: string;
  description?: string;
  status: PaymentStatus;
  createdAt: string;
};

type PaymentListItemDto = {
  id: number;
  fromAccount: string;
  toAccount: string;
  amount: number;
  fee?: number;
  currency: string;
  description?: string;
  recipientName?: string;
  status: PaymentStatus;
  createdAt: string;
};

type PageDto<T> = {
  content: T[];
};

function mapPaymentStatus(status: PaymentStatus): { status: InterbankPayment['status']; failureReason?: string } {
  switch (status) {
    case 'PENDING':
      return { status: 'INITIATED' };
    case 'PROCESSING':
      return { status: 'COMMITTING' };
    case 'COMPLETED':
      return { status: 'COMMITTED' };
    case 'REJECTED':
      return { status: 'ABORTED', failureReason: 'Payment rejected.' };
    case 'CANCELLED':
      return { status: 'ABORTED', failureReason: 'Payment cancelled.' };
    default:
      return { status: 'STUCK', failureReason: `Unknown payment status: ${status}` };
  }
}

function mapPaymentToInterbank(payment: PaymentResponseDto): InterbankPayment {
  const mapped = mapPaymentStatus(payment.status);
  return {
    id: payment.id,
    transactionId: String(payment.id),
    status: mapped.status,
    senderAccountNumber: payment.fromAccount,
    receiverAccountNumber: payment.toAccount,
    amount: payment.amount,
    currency: payment.currency,
    exchangeRate: null,
    convertedAmount: null,
    convertedCurrency: null,
    commissionAmount: payment.fee ?? null,
    createdAt: payment.createdAt,
    preparedAt: null,
    committedAt: null,
    abortedAt: null,
    failureReason: mapped.failureReason ?? null,
  };
}

function mapPaymentListItemToInterbank(item: PaymentListItemDto): InterbankPayment {
  const mapped = mapPaymentStatus(item.status);
  return {
    id: item.id,
    transactionId: String(item.id),
    status: mapped.status,
    senderAccountNumber: item.fromAccount,
    receiverAccountNumber: item.toAccount,
    amount: item.amount,
    currency: item.currency,
    exchangeRate: null,
    convertedAmount: null,
    convertedCurrency: null,
    commissionAmount: item.fee ?? null,
    createdAt: item.createdAt,
    preparedAt: null,
    committedAt: null,
    abortedAt: null,
    failureReason: mapped.failureReason ?? null,
  };
}

const interbankPaymentService = {
  async initiatePayment(dto: InterbankPaymentInitiateRequest): Promise<InterbankPayment> {
    const extendedDto = dto as InterbankPaymentInitiateRequest & {
      paymentCode?: string;
      paymentPurpose?: string;
      referenceNumber?: string;
    };

    const payload = {
      fromAccount: dto.senderAccountNumber,
      toAccount: dto.receiverAccountNumber,
      amount: dto.amount,
      paymentCode: extendedDto.paymentCode ?? '289',
      referenceNumber: extendedDto.referenceNumber || undefined,
      description: extendedDto.paymentPurpose ?? dto.description ?? 'Inter-bank payment',
      recipientName: dto.receiverName,
      otpCode: dto.otpCode || '',
    };

    const response = await api.post<PaymentResponseDto>('/payments', payload);
    return mapPaymentToInterbank(response.data);
  },

  async getStatus(transactionId: string): Promise<InterbankPayment> {
    const paymentId = Number(transactionId);
    if (!Number.isFinite(paymentId)) {
      throw new Error(`Invalid payment id: ${transactionId}`);
    }

    const response = await api.get<PaymentResponseDto>(`/payments/${paymentId}`);
    return mapPaymentToInterbank(response.data);
  },

  async myHistory(): Promise<InterbankPayment[]> {
    const params = new URLSearchParams();
    params.append('page', '0');
    params.append('size', '50');

    const response = await api.get<PageDto<PaymentListItemDto>>('/payments', { params });
    return response.data.content.map(mapPaymentListItemToInterbank);
  },
};

export default interbankPaymentService;
