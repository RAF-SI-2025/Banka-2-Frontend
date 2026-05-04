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

  submitRequest: async (data: { accountId: number; cardLimit?: number; authorizedPersonId?: number; authorizedPerson?: Partial<AuthorizedPerson> }): Promise<unknown> => {
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
