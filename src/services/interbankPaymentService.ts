import api from './api';
import type { InterbankPayment, InterbankPaymentInitiateRequest } from '@/types/celina4';

/*
================================================================================
 INTER-BANK PLACANJA — FE SERVICE WRAPPER (PROTOKOL §2)
 Spec ref: Info o predmetu/A protocol for bank-to-bank asset exchange.htm,
           §2 Transaction execution protocol
--------------------------------------------------------------------------------
 ARHITEKTURA (POSLE PROTOKOL REFAKTORA, BE):
  Klijent (FE) NIKAD ne komunicira direktno sa drugom bankom — uvek ide
  preko nase BE. BE strana (TransactionExecutorService) odlucuje da li je
  receiver lokalni (intra-bank, postojeci flow) ili remote (inter-bank,
  protokol §2.8.5 Remote transaction execution).

 NAPOMENA O ENDPOINT-IMA:
  Stari TODO endpoint-i (`/interbank/payments/initiate`) su uklonjeni iz
  BE-a jer protokol rezervise URL prefix `/interbank` strogo za poruke
  IZMEDJU banaka (POST /interbank, GET /negotiations/*, ...).
  Klijentski (FE -> BE) pozivi treba da idu na druge URL-ove:

   POST /api/payments              — vec postoji (paymentService.create);
                                     BE detektuje inter-bank receiver po
                                     prefiksu broja racuna (BankRoutingService)
                                     i prosledjuje u TransactionExecutorService
   GET  /api/payments/my           — istorija (postoji)
   GET  /api/interbank-tx/{id}     — TODO: novi endpoint za poll status
                                     distribuirane transakcije po protokolu
                                     (mapira na InterbankTransaction.status)

 STATUS:
  Ovaj servis se moze obrisati — NewPaymentPage treba da koristi obicni
  paymentService.create i samo poll-uje /api/interbank-tx/{id} ako BE vraca
  202 Accepted ili tx.status != COMMITTED. Zadrzano je za sada da bi FE
  testovi i dalje prolazili dok BE ne implementira novi flow.

 TODO (FE tim):
  1. Obrisi ovaj fajl
  2. Migriraj NewPaymentPage na paymentService.create + interbank poll
  3. Obrisi InterbankPayment / InterbankPaymentInitiateRequest tipove iz
     types/celina4.ts (zameni sa standardnim Payment tipom)
================================================================================
*/
const interbankPaymentService = {
  async initiatePayment(dto: InterbankPaymentInitiateRequest): Promise<InterbankPayment> {
    // TODO: zameni sa paymentService.create(...) — BE detektuje inter-bank po prefiksu
    const extendedDto = dto as InterbankPaymentInitiateRequest & {
      paymentCode?: string;
      paymentPurpose?: string;
      model?: string;
      callNumber?: string;
      referenceNumber?: string;
    };
    const payload = {
      fromAccount: dto.senderAccountNumber,
      toAccount: dto.receiverAccountNumber,
      amount: dto.amount,
      paymentCode: extendedDto.paymentCode ?? '289',
      description: extendedDto.paymentPurpose ?? dto.description ?? undefined,
      referenceNumber: extendedDto.referenceNumber || undefined,
      recipientName: dto.receiverName,
      model: extendedDto.model || undefined,
      callNumber: extendedDto.callNumber || undefined,
      otpCode: dto.otpCode || '',
    };
    const response = await api.post<InterbankPayment>('/payments', payload);
    return response.data;
  },

  async getStatus(transactionId: string): Promise<InterbankPayment> {
    // TODO: zameni sa /api/interbank-tx/{transactionId}
    const response = await api.get<InterbankPayment>(`/interbank/payments/${transactionId}`);
    return response.data;
  },

  async myHistory(): Promise<InterbankPayment[]> {
    // TODO: zameni sa paymentService.myHistory() filtriran po remote-flag-u
    const response = await api.get<InterbankPayment[]>('/interbank/payments/my');
    return response.data;
  },
};

export default interbankPaymentService;
