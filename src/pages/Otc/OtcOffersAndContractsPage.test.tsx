import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtcOffersAndContractsPage from './OtcOffersAndContractsPage';

const mockListMyActiveOffers = vi.fn();
const mockListMyContractsLocal = vi.fn();
const mockAcceptOfferLocal = vi.fn();
const mockDeclineOfferLocal = vi.fn();
const mockCounterOfferLocal = vi.fn();
const mockExerciseContractLocal = vi.fn();
const mockListMyOffersRemote = vi.fn();
const mockListMyContractsRemote = vi.fn();
const mockGetMyAccounts = vi.fn();
const mockGetBankAccounts = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'stefan.jovanovic@gmail.com', role: 'CLIENT', permissions: [] },
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
    isSupervisor: false,
    isAgent: false,
    hasPermission: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/services/otcService', () => ({
  default: {
    listMyActiveOffers: (...args: unknown[]) => mockListMyActiveOffers(...args),
    listMyContracts: (...args: unknown[]) => mockListMyContractsLocal(...args),
    acceptOffer: (...args: unknown[]) => mockAcceptOfferLocal(...args),
    declineOffer: (...args: unknown[]) => mockDeclineOfferLocal(...args),
    counterOffer: (...args: unknown[]) => mockCounterOfferLocal(...args),
    exerciseContract: (...args: unknown[]) => mockExerciseContractLocal(...args),
  },
}));

vi.mock('@/services/interbankOtcService', () => ({
  default: {
    listMyOffers: (...args: unknown[]) => mockListMyOffersRemote(...args),
    listMyContracts: (...args: unknown[]) => mockListMyContractsRemote(...args),
  },
}));

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: (...args: unknown[]) => mockGetMyAccounts(...args),
    getBankAccounts: (...args: unknown[]) => mockGetBankAccounts(...args),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const localOffer = {
  id: 1,
  listingId: 101,
  listingTicker: 'TSLA',
  listingName: 'Tesla Inc.',
  listingCurrency: 'USD',
  buyerId: 1,
  buyerName: 'Stefan Jovanovic',
  sellerId: 9,
  sellerName: 'Local Seller',
  quantity: 4,
  pricePerStock: 205,
  premium: 12,
  currentPrice: 200,
  settlementDate: '2026-05-12',
  lastModifiedById: 1,
  lastModifiedByName: 'Stefan Jovanovic',
  waitingOnUserId: 1,
  myTurn: true,
  status: 'ACTIVE',
  createdAt: '2026-04-24T09:00:00Z',
  lastModifiedAt: '2026-04-25T09:00:00Z',
};

const remoteOffer = {
  offerId: 'remote-offer-1',
  listingTicker: 'AAPL',
  listingName: 'Apple Inc.',
  listingCurrency: 'USD',
  currentPrice: 100,
  buyerBankCode: 'BANKA1',
  buyerUserId: 'buyer-1',
  buyerName: 'Stefan Jovanovic',
  sellerBankCode: 'BANKA2',
  sellerUserId: 'seller-1',
  sellerName: 'Remote Seller',
  quantity: 5,
  pricePerStock: 102,
  premium: 10,
  settlementDate: '2026-05-10',
  waitingOnBankCode: 'BANKA1',
  waitingOnUserId: 'buyer-1',
  myTurn: true,
  status: 'ACTIVE',
  lastModifiedAt: '2026-04-25T10:00:00Z',
  lastModifiedByName: 'Stefan Jovanovic',
};

const remoteContract = {
  id: 'contract-1',
  listingId: 1001,
  listingTicker: 'MSFT',
  listingName: 'Microsoft Corporation',
  listingCurrency: 'USD',
  buyerUserId: 'buyer-1',
  buyerBankCode: 'BANKA1',
  buyerName: 'Stefan Jovanovic',
  sellerUserId: 'seller-1',
  sellerBankCode: 'BANKA2',
  sellerName: 'Remote Seller',
  quantity: 2,
  strikePrice: 410,
  premium: 14,
  currentPrice: 420,
  settlementDate: '2026-05-20',
  status: 'ACTIVE',
  createdAt: '2026-04-25T10:30:00Z',
};

const account = {
  id: 1,
  accountNumber: '222000000000000001',
  ownerName: 'Stefan Jovanovic',
  accountType: 'CHECKING',
  currency: 'USD',
  balance: 10000,
  availableBalance: 10000,
  reservedBalance: 0,
  dailyLimit: 100000,
  monthlyLimit: 500000,
  dailySpending: 0,
  monthlySpending: 0,
  maintenanceFee: 0,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('OtcOffersAndContractsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMyActiveOffers.mockResolvedValue([localOffer]);
    mockListMyContractsLocal.mockResolvedValue([]);
    mockListMyOffersRemote.mockResolvedValue([remoteOffer]);
    mockListMyContractsRemote.mockResolvedValue([remoteContract]);
    mockGetMyAccounts.mockResolvedValue([account]);
    mockGetBankAccounts.mockResolvedValue([]);
  });

  it('renders intra-bank offers tab by default without loading remote tabs', async () => {
    render(<OtcOffersAndContractsPage />);

    await waitFor(() => {
      expect(mockListMyActiveOffers).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByRole('tab', { name: /Aktivne ponude \(intra-bank\)/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('Prodavac: Local Seller')).toBeInTheDocument();
    expect(mockListMyOffersRemote).not.toHaveBeenCalled();
    expect(mockListMyContractsRemote).not.toHaveBeenCalled();
  });

  it('loads remote offers tab on demand', async () => {
    const user = userEvent.setup();
    render(<OtcOffersAndContractsPage />);

    await waitFor(() => {
      expect(mockListMyActiveOffers).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: /Aktivne ponude \(inter-bank\)/i }));

    await waitFor(() => {
      expect(mockListMyOffersRemote).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Kupac: BANKA1')).toBeInTheDocument();
    expect(screen.getByText('Prodavac: BANKA2')).toBeInTheDocument();
  });

  it('loads remote contracts tab on demand', async () => {
    const user = userEvent.setup();
    render(<OtcOffersAndContractsPage />);

    await waitFor(() => {
      expect(mockListMyActiveOffers).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: /Sklopljeni ugovori \(inter-bank\)/i }));

    await waitFor(() => {
      expect(mockListMyContractsRemote).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Inter-bank ugovori')).toBeInTheDocument();
  });
});
