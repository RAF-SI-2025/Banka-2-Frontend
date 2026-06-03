import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { cardService } from './cardService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('cardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getByAccount ====================

  describe('getByAccount', () => {
    it('should fetch cards by account id', async () => {
      const cards = [
        { id: 1, cardNumber: '4111111111111111', cardType: 'VISA', status: 'ACTIVE' },
        { id: 2, cardNumber: '5500000000000004', cardType: 'MASTERCARD', status: 'ACTIVE' },
      ];
      mockedApi.get.mockResolvedValue({ data: cards });

      const result = await cardService.getByAccount(10);

      expect(mockedApi.get).toHaveBeenCalledWith('/cards/account/10');
      expect(result).toEqual(cards);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Account not found'));
      await expect(cardService.getByAccount(999)).rejects.toThrow('Account not found');
    });
  });

  // ==================== getMyCards ====================

  describe('getMyCards', () => {
    it('should fetch current user cards', async () => {
      const cards = [{ id: 1, cardNumber: '4111111111111111', status: 'ACTIVE' }];
      mockedApi.get.mockResolvedValue({ data: cards });

      const result = await cardService.getMyCards();

      expect(mockedApi.get).toHaveBeenCalledWith('/cards');
      expect(result).toEqual(cards);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Unauthorized'));
      await expect(cardService.getMyCards()).rejects.toThrow('Unauthorized');
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a new card', async () => {
      const newCard = { accountId: 10, cardLimit: 50000 };
      const created = { id: 5, cardNumber: '4111111111111111', cardType: 'VISA', status: 'ACTIVE', limit: 50000 };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await cardService.create(newCard);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards', newCard);
      expect(result).toEqual(created);
    });

    it('should create card without limit', async () => {
      const newCard = { accountId: 10 };
      mockedApi.post.mockResolvedValue({ data: { id: 6 } });

      await cardService.create(newCard);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards', { accountId: 10 });
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Creation failed'));
      await expect(cardService.create({ accountId: 10 })).rejects.toThrow('Creation failed');
    });
  });

  // ==================== block ====================

  describe('block', () => {
    it('should block a card', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await cardService.block(5);

      expect(mockedApi.patch).toHaveBeenCalledWith('/cards/5/block');
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Block failed'));
      await expect(cardService.block(999)).rejects.toThrow('Block failed');
    });
  });

  // ==================== unblock ====================

  describe('unblock', () => {
    it('should unblock a card', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await cardService.unblock(5);

      expect(mockedApi.patch).toHaveBeenCalledWith('/cards/5/unblock');
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Unblock failed'));
      await expect(cardService.unblock(999)).rejects.toThrow('Unblock failed');
    });
  });

  // ==================== deactivate ====================

  describe('deactivate', () => {
    it('should deactivate a card', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await cardService.deactivate(5);

      expect(mockedApi.patch).toHaveBeenCalledWith('/cards/5/deactivate');
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Deactivation failed'));
      await expect(cardService.deactivate(999)).rejects.toThrow('Deactivation failed');
    });
  });

  // ==================== changeLimit ====================

  describe('changeLimit', () => {
    it('should change card limit', async () => {
      mockedApi.patch.mockResolvedValue({ data: undefined });

      await cardService.changeLimit(5, 100000);

      expect(mockedApi.patch).toHaveBeenCalledWith('/cards/5/limit', { cardLimit: 100000 });
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Limit change failed'));
      await expect(cardService.changeLimit(5, -1)).rejects.toThrow('Limit change failed');
    });
  });

  // ==================== sendRequestCode (C2 Sc28) ====================

  describe('sendRequestCode', () => {
    it('should POST to send-code endpoint and return payload', async () => {
      mockedApi.post.mockResolvedValue({ data: { sent: true, message: 'Potvrdite da ste Vi podneli ovaj zahtev.' } });

      const result = await cardService.sendRequestCode();

      expect(mockedApi.post).toHaveBeenCalledWith('/cards/requests/send-code');
      expect(result).toEqual({ sent: true, message: 'Potvrdite da ste Vi podneli ovaj zahtev.' });
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Send failed'));
      await expect(cardService.sendRequestCode()).rejects.toThrow('Send failed');
    });
  });

  // ==================== submitRequest ====================

  describe('submitRequest', () => {
    it('should submit a card request with verificationCode (Sc28)', async () => {
      const requestData = { accountId: 10, cardLimit: 25000, verificationCode: '123456' };
      mockedApi.post.mockResolvedValue({ data: { requestId: 60 } });

      const result = await cardService.submitRequest(requestData);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards/requests', requestData);
      expect(result).toEqual({ requestId: 60 });
    });

    it('should submit a card request', async () => {
      const requestData = { accountId: 10, cardLimit: 25000 };
      mockedApi.post.mockResolvedValue({ data: { requestId: 50 } });

      const result = await cardService.submitRequest(requestData);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards/requests', requestData);
      expect(result).toEqual({ requestId: 50 });
    });

    it('should submit request without cardLimit', async () => {
      const requestData = { accountId: 10 };
      mockedApi.post.mockResolvedValue({ data: { requestId: 51 } });

      const result = await cardService.submitRequest(requestData);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards/requests', { accountId: 10 });
      expect(result).toEqual({ requestId: 51 });
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Request failed'));
      await expect(cardService.submitRequest({ accountId: 10 })).rejects.toThrow('Request failed');
    });

    it('should submit request with authorizedPersonId', async () => {
      const requestData = { accountId: 10, authorizedPersonId: 5 };
      mockedApi.post.mockResolvedValue({ data: { requestId: 52 } });

      const result = await cardService.submitRequest(requestData);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards/requests', requestData);
      expect(result).toEqual({ requestId: 52 });
    });

    it('should submit request with authorizedPerson object', async () => {
      const requestData = {
        accountId: 10,
        authorizedPerson: { firstName: 'Marko', lastName: 'Petrovic' },
      };
      mockedApi.post.mockResolvedValue({ data: { requestId: 53 } });

      const result = await cardService.submitRequest(requestData);

      expect(mockedApi.post).toHaveBeenCalledWith('/cards/requests', requestData);
      expect(result).toEqual({ requestId: 53 });
    });
  });

  // ==================== getAuthorizedPersons ====================

  describe('getAuthorizedPersons', () => {
    it('should fetch authorized persons by account number', async () => {
      const persons = [
        { id: 1, firstName: 'Marko', lastName: 'Petrovic', email: 'marko@test.rs' },
        { id: 2, firstName: 'Ana', lastName: 'Jovic', email: 'ana@test.rs' },
      ];
      mockedApi.get.mockResolvedValue({ data: persons });

      const result = await cardService.getAuthorizedPersons('123456789012345678');

      expect(mockedApi.get).toHaveBeenCalledWith('/accounts/123456789012345678/authorized-persons');
      expect(result).toEqual(persons);
    });

    it('should return empty array when no authorized persons', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      const result = await cardService.getAuthorizedPersons('000000000000000000');

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Not found'));
      await expect(cardService.getAuthorizedPersons('invalid')).rejects.toThrow('Not found');
    });
  });
});
