import api from './api';
import type { Card, NewCardRequest, AuthorizedPerson } from '../types/celina2';

export const cardService = {
  getByAccount: async (accountId: number): Promise<Card[]> => {
    const response = await api.get<Card[]>(`/cards/account/${accountId}`);
    return response.data;
  },

  getMyCards: async (): Promise<Card[]> => {
    const response = await api.get<Card[]>('/cards');
    return response.data;
  },

  create: async (data: NewCardRequest): Promise<Card> => {
    const response = await api.post<Card>('/cards', data);
    return response.data;
  },

  block: async (cardId: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/block`);
  },

  unblock: async (cardId: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/unblock`);
  },

  deactivate: async (cardId: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/deactivate`);
  },

  changeLimit: async (cardId: number, cardLimit: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/limit`, { cardLimit });
  },

  /**
   * Dopuna INTERNET_PREPAID kartice — skida amount sa sourceAccountId i dodaje na
   * Card.prepaidBalance. BE validira ownership i kategoriju.
   *
   * P1-idempotency-1 (R5-1849): saljemo `Idempotency-Key` (UUID po pozivu). Ako
   * se isti zahtev re-isporuci na transport nivou (retry-on-connection-failure),
   * BE deduplikuje i ne prebacuje sredstva dvaput. `idempotencyKey` se moze
   * proslediti spolja (stabilan po submit-u, npr. da prezivi double-click);
   * default je svez UUID.
   */
  topUp: async (cardId: number, sourceAccountId: number, amount: number, idempotencyKey?: string): Promise<Card> => {
    const response = await api.post<Card>(`/cards/${cardId}/top-up`, { sourceAccountId, amount }, {
      headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
    });
    return response.data;
  },

  /**
   * Povlacenje sa INTERNET_PREPAID kartice nazad na racun — obrnut smer od top-up-a.
   */
  withdraw: async (cardId: number, targetAccountId: number, amount: number, idempotencyKey?: string): Promise<Card> => {
    const response = await api.post<Card>(`/cards/${cardId}/withdraw`, { targetAccountId, amount }, {
      headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() },
    });
    return response.data;
  },

  /**
   * C2 Sc28 (§308): salje email verifikacioni kod ("Potvrdite da ste Vi podneli
   * ovaj zahtev") pre podnosenja zahteva za karticu. Klijent zatim unosi taj kod u
   * {@link submitRequest} (verificationCode), koji BE verifikuje pre kreiranja zahteva.
   */
  sendRequestCode: async (): Promise<{ sent: boolean; message: string }> => {
    const response = await api.post<{ sent: boolean; message: string }>('/cards/requests/send-code');
    return response.data;
  },

  submitRequest: async (data: { accountId: number; cardLimit?: number; cardType?: string; cardCategory?: string; creditLimit?: number; verificationCode?: string; authorizedPersonId?: number; authorizedPerson?: Partial<AuthorizedPerson> }): Promise<unknown> => {
    const response = await api.post('/cards/requests', data);
    return response.data;
  },

  // Backend trenutno ne izlozeni REST endpoint za authorized persons (samo JPA relacija
  // na Company entitetu). Funkcija se NE poziva u trenutnom UI flow-u — zadrzano kao
  // stub za eventualno prosirivanje (Celina 2 spec ne zahteva ovaj endpoint).
  getAuthorizedPersons: async (accountNumber: string): Promise<AuthorizedPerson[]> => {
    const response = await api.get<AuthorizedPerson[]>(`/accounts/${accountNumber}/authorized-persons`);
    return response.data;
  },
};
