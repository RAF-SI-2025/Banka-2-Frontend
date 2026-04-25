import api from './api';
import type { InterbankPayment, InterbankPaymentInitiateRequest } from '@/types/celina4';

/*
================================================================================
 TODO — SERVICE WRAPPER ZA INTER-BANK PLACANJA
 Zaduzen: antonije3
 Spec referenca: Celina 4, linije 368-437 (2PC placanja)
--------------------------------------------------------------------------------
 SCOPE:
  - initiatePayment() salje POST /interbank/payments/initiate
  - getStatus() poll-uje /interbank/payments/{id}
  - myHistory() prikazuje listu svih korisnikovih inter-bank placanja

 INTEGRACIJA SA POSTOJECIM PAYMENT FLOW-OM:
  - Na PaymentCreatePage-u (ili Transfers page), kad korisnik unese
    receiverAccountNumber, FE proverava prve 3 cifre. Ako su razlicite
    od naseg prefixa (222) → prebaci se u inter-bank mode i koristi
    ovaj service umesto obicnog paymentService.
  - Po prijemu transactionId-a, prikazi toast "Transakcija u obradi"
    i poll-uj status svakih ~3s dok status ne bude COMMITTED ili ABORTED.
================================================================================
*/
const interbankPaymentService = {
  async initiatePayment(dto: InterbankPaymentInitiateRequest): Promise<InterbankPayment> {
    const response = await api.post<InterbankPayment>('/interbank/payments/initiate', dto);
    return response.data;
  },

  async getStatus(transactionId: string): Promise<InterbankPayment> {
    const response = await api.get<InterbankPayment>(`/interbank/payments/${transactionId}`);
    return response.data;
  },

  async myHistory(): Promise<InterbankPayment[]> {
    const response = await api.get<InterbankPayment[]>('/interbank/payments/my');
    return response.data;
  },
};

export default interbankPaymentService;
