import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtcInterBankOffersTab from './OtcInterBankOffersTab';

const mockListMyOffers = vi.fn();
const mockAcceptOffer = vi.fn();
const mockCounterOffer = vi.fn();
const mockDeclineOffer = vi.fn();
const mockGetMyAccounts = vi.fn();
const mockGetBankAccounts = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

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

vi.mock('@/services/interbankOtcService', () => ({
  default: {
    listMyOffers: (...args: unknown[]) => mockListMyOffers(...args),
    acceptOffer: (...args: unknown[]) => mockAcceptOffer(...args),
    counterOffer: (...args: unknown[]) => mockCounterOffer(...args),
    declineOffer: (...args: unknown[]) => mockDeclineOffer(...args),
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
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const activeOffer = {
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
} as const;

const inactiveOffer = {
  ...activeOffer,
  offerId: 'remote-offer-2',
  listingTicker: 'MSFT',
  status: 'DECLINED',
  myTurn: false,
} as const;

const accounts = [
  {
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
  },
  {
    id: 2,
    accountNumber: '222000000000000002',
    ownerName: 'Stefan Jovanovic',
    accountType: 'CHECKING',
    currency: 'USD',
    balance: 5000,
    availableBalance: 5000,
    reservedBalance: 0,
    dailyLimit: 100000,
    monthlyLimit: 500000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('OtcInterBankOffersTab', () => {
  const confirmSpy = vi.spyOn(window, 'confirm');

  beforeEach(() => {
    vi.clearAllMocks();
    confirmSpy.mockReturnValue(true);
    mockListMyOffers.mockResolvedValue([activeOffer, inactiveOffer]);
    mockGetMyAccounts.mockResolvedValue(accounts);
    mockGetBankAccounts.mockResolvedValue([]);
    mockAcceptOffer.mockResolvedValue({ offerId: activeOffer.offerId });
    mockCounterOffer.mockResolvedValue({ offerId: activeOffer.offerId });
    mockDeclineOffer.mockResolvedValue({ offerId: activeOffer.offerId });
  });

  it('loads and renders only active inter-bank offers', async () => {
    render(<OtcInterBankOffersTab />);

    await waitFor(() => {
      expect(mockListMyOffers).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Kupac: BANKA1')).toBeInTheDocument();
    expect(screen.getByText('Prodavac: BANKA2')).toBeInTheDocument();
    expect(screen.getByText('Moj red')).toBeInTheDocument();
    expect(screen.getByText('+2.0%')).toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
  });

  it('opens account selector and accepts offer with selected account', async () => {
    const user = userEvent.setup();
    const onAcceptedOffer = vi.fn();
    render(<OtcInterBankOffersTab onAcceptedOffer={onAcceptedOffer} />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Prihvati/i }));
    await user.selectOptions(screen.getByLabelText(/Racun za placanje premije/i), '2');
    await user.click(screen.getByRole('button', { name: /Potvrdi prihvatanje/i }));

    await waitFor(() => {
      expect(mockAcceptOffer).toHaveBeenCalledWith('remote-offer-1', 2);
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Inter-bank ponuda je prihvacena.');
    expect(onAcceptedOffer).toHaveBeenCalledTimes(1);
    expect(mockListMyOffers).toHaveBeenCalledTimes(2);
  });

  it('opens counter form and sends updated counter offer', async () => {
    const user = userEvent.setup();
    render(<OtcInterBankOffersTab />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Kontraponuda/i }));
    await user.clear(screen.getByLabelText(/^Kolicina$/i));
    await user.type(screen.getByLabelText(/^Kolicina$/i), '7');
    await user.clear(screen.getByLabelText(/Premija \(USD\)/i));
    await user.type(screen.getByLabelText(/Premija \(USD\)/i), '12.5');
    await user.click(screen.getByRole('button', { name: /Posalji kontraponudu/i }));

    await waitFor(() => {
      expect(mockCounterOffer).toHaveBeenCalledWith('remote-offer-1', {
        offerId: 'remote-offer-1',
        quantity: 7,
        pricePerStock: 102,
        premium: 12.5,
        settlementDate: '2026-05-10',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Inter-bank kontraponuda je poslata.');
    expect(mockListMyOffers).toHaveBeenCalledTimes(2);
  });

  it('declines offer after confirmation', async () => {
    const user = userEvent.setup();
    render(<OtcInterBankOffersTab />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Odbij/i }));

    await waitFor(() => {
      expect(mockDeclineOffer).toHaveBeenCalledWith('remote-offer-1');
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith('Inter-bank ponuda je odbijena.');
    expect(mockListMyOffers).toHaveBeenCalledTimes(2);
  });
});
