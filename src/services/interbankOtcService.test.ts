import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import interbankOtcService from './interbankOtcService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('interbankOtcService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listRemoteListings', () => {
    it('should fetch remote listings', async () => {
      const listings = [
        {
          bankCode: 'BANKA2',
          sellerPublicId: 'remote-user-1',
          sellerName: 'Remote Seller',
          listingTicker: 'AAPL',
          listingName: 'Apple Inc.',
          listingCurrency: 'USD',
          currentPrice: 198.25,
          availableQuantity: 40,
        },
      ];
      mockedApi.get.mockResolvedValue({ data: listings });

      const result = await interbankOtcService.listRemoteListings();

      expect(mockedApi.get).toHaveBeenCalledWith('/interbank/otc/listings');
      expect(result).toEqual(listings);
    });

    it('should propagate listing fetch errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Remote listings unavailable'));

      await expect(interbankOtcService.listRemoteListings()).rejects.toThrow('Remote listings unavailable');
    });
  });

  describe('createOffer', () => {
    it('should create an inter-bank offer', async () => {
      const request = {
        sellerBankCode: 'BANKA2',
        sellerUserId: 'remote-user-1',
        listingTicker: 'AAPL',
        quantity: 15,
        pricePerStock: 195,
        premium: 12.5,
        settlementDate: '2026-06-01',
      };
      const created = {
        offerId: 'offer-uuid',
        listingTicker: 'AAPL',
        listingName: 'Apple Inc.',
        listingCurrency: 'USD',
        currentPrice: 198.25,
        buyerBankCode: 'BANKA1',
        buyerUserId: 'client-1',
        buyerName: 'Stefan Jovanovic',
        sellerBankCode: 'BANKA2',
        sellerUserId: 'remote-user-1',
        sellerName: 'Remote Seller',
        quantity: 15,
        pricePerStock: 195,
        premium: 12.5,
        settlementDate: '2026-06-01',
        waitingOnBankCode: 'BANKA2',
        waitingOnUserId: 'remote-user-1',
        myTurn: false,
        status: 'ACTIVE' as const,
        lastModifiedAt: '2026-04-24T10:00:00',
        lastModifiedByName: 'Stefan Jovanovic',
      };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await interbankOtcService.createOffer(request);

      expect(mockedApi.post).toHaveBeenCalledWith('/interbank/otc/offers', request);
      expect(result).toEqual(created);
    });

    it('should propagate create offer errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Create failed'));

      await expect(
        interbankOtcService.createOffer({
          sellerBankCode: 'BANKA2',
          sellerUserId: 'remote-user-1',
          listingTicker: 'AAPL',
          quantity: 15,
          pricePerStock: 195,
          premium: 12.5,
          settlementDate: '2026-06-01',
        }),
      ).rejects.toThrow('Create failed');
    });
  });

  describe('listMyOffers', () => {
    it('should fetch my offers', async () => {
      const offers = [{ offerId: 'offer-uuid', status: 'ACTIVE' }];
      mockedApi.get.mockResolvedValue({ data: offers });

      const result = await interbankOtcService.listMyOffers();

      expect(mockedApi.get).toHaveBeenCalledWith('/interbank/otc/offers/my');
      expect(result).toEqual(offers);
    });

    it('should propagate offer fetch errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Offers unavailable'));

      await expect(interbankOtcService.listMyOffers()).rejects.toThrow('Offers unavailable');
    });
  });

  describe('counterOffer', () => {
    it('should send a counter offer', async () => {
      const request = {
        offerId: 'offer-uuid',
        quantity: 20,
        pricePerStock: 193.5,
        premium: 10,
        settlementDate: '2026-06-03',
      };
      const updated = { offerId: 'offer-uuid', status: 'ACTIVE' };
      mockedApi.patch.mockResolvedValue({ data: updated });

      const result = await interbankOtcService.counterOffer('offer-uuid', request);

      expect(mockedApi.patch).toHaveBeenCalledWith('/interbank/otc/offers/offer-uuid/counter', request);
      expect(result).toEqual(updated);
    });

    it('should propagate counter offer errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Counter failed'));

      await expect(
        interbankOtcService.counterOffer('offer-uuid', {
          offerId: 'offer-uuid',
          quantity: 20,
          pricePerStock: 193.5,
          premium: 10,
          settlementDate: '2026-06-03',
        }),
      ).rejects.toThrow('Counter failed');
    });
  });

  describe('declineOffer', () => {
    it('should decline an offer', async () => {
      const declined = { offerId: 'offer-uuid', status: 'DECLINED' };
      mockedApi.patch.mockResolvedValue({ data: declined });

      const result = await interbankOtcService.declineOffer('offer-uuid');

      expect(mockedApi.patch).toHaveBeenCalledWith('/interbank/otc/offers/offer-uuid/decline');
      expect(result).toEqual(declined);
    });

    it('should propagate decline errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Decline failed'));

      await expect(interbankOtcService.declineOffer('offer-uuid')).rejects.toThrow('Decline failed');
    });
  });

  describe('acceptOffer', () => {
    it('should accept an offer with accountId query param', async () => {
      const accepted = { offerId: 'offer-uuid', status: 'ACCEPTED' };
      mockedApi.patch.mockResolvedValue({ data: accepted });

      const result = await interbankOtcService.acceptOffer('offer-uuid', 123);

      expect(mockedApi.patch).toHaveBeenCalledWith('/interbank/otc/offers/offer-uuid/accept', undefined, {
        params: { accountId: 123 },
      });
      expect(result).toEqual(accepted);
    });

    it('should propagate accept errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Accept failed'));

      await expect(interbankOtcService.acceptOffer('offer-uuid', 123)).rejects.toThrow('Accept failed');
    });
  });

  describe('listMyContracts', () => {
    it('should fetch my contracts without filters', async () => {
      const contracts = [{ id: 'contract-uuid', status: 'ACTIVE' }];
      mockedApi.get.mockResolvedValue({ data: contracts });

      const result = await interbankOtcService.listMyContracts();

      expect(mockedApi.get).toHaveBeenCalledWith('/interbank/otc/contracts/my', {
        params: undefined,
      });
      expect(result).toEqual(contracts);
    });

    it('should pass status filter when provided', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await interbankOtcService.listMyContracts('EXERCISED');

      expect(mockedApi.get).toHaveBeenCalledWith('/interbank/otc/contracts/my', {
        params: { status: 'EXERCISED' },
      });
    });

    it('should propagate contract fetch errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Contracts unavailable'));

      await expect(interbankOtcService.listMyContracts()).rejects.toThrow('Contracts unavailable');
    });
  });

  describe('exerciseContract', () => {
    it('should exercise a contract with buyerAccountId query param', async () => {
      const transaction = {
        id: 55,
        transactionId: 'tx-uuid',
        type: 'OTC' as const,
        status: 'INITIATED' as const,
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 2925,
        currency: 'USD',
        createdAt: '2026-04-24T10:00:00',
        retryCount: 0,
      };
      mockedApi.post.mockResolvedValue({ data: transaction });

      const result = await interbankOtcService.exerciseContract('contract-uuid', 456);

      expect(mockedApi.post).toHaveBeenCalledWith('/interbank/otc/contracts/contract-uuid/exercise', undefined, {
        params: { buyerAccountId: 456 },
      });
      expect(result).toEqual(transaction);
    });

    it('should propagate exercise errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Exercise failed'));

      await expect(interbankOtcService.exerciseContract('contract-uuid', 456)).rejects.toThrow('Exercise failed');
    });
  });
});
