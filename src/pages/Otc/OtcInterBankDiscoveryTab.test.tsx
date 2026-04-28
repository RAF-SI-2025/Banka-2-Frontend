import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import OtcInterBankDiscoveryTab from './OtcInterBankDiscoveryTab';
import type { OtcInterbankListing } from '@/types/celina4';

const mockListRemoteListings = vi.fn();
const mockCreateOffer = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/services/interbankOtcService', () => ({
  default: {
    listRemoteListings: (...args: unknown[]) => mockListRemoteListings(...args),
    createOffer: (...args: unknown[]) => mockCreateOffer(...args),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

describe('OtcInterBankDiscoveryTab', () => {
  const remoteListings = [
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockListRemoteListings.mockResolvedValue(remoteListings);
    mockCreateOffer.mockResolvedValue({ offerId: 'remote-offer-1' });
    // Default: klijent (a defensive fallback omogucuje da listings bez
    // sellerRole-a budu prikazani).
    mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: false, isSupervisor: false });
  });

  it('loads and renders remote listings on mount', async () => {
    renderWithProviders(<OtcInterBankDiscoveryTab />);

    await waitFor(() => {
      expect(mockListRemoteListings).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('BANKA2')).toBeInTheDocument();
    expect(screen.getByText('Remote Seller')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });

  it('refreshes listings when clicking Osvezi', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OtcInterBankDiscoveryTab />);

    await waitFor(() => {
      expect(mockListRemoteListings).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: /Osvezi/i }));

    await waitFor(() => {
      expect(mockListRemoteListings).toHaveBeenCalledTimes(2);
    });
  });

  it('submits a new remote offer and refreshes listings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OtcInterBankDiscoveryTab />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Napravi ponudu/i }));
    await user.clear(screen.getByLabelText(/Kolicina akcija/i));
    await user.type(screen.getByLabelText(/Kolicina akcija/i), '3');
    await user.clear(screen.getByLabelText(/Premija \(USD\)/i));
    await user.type(screen.getByLabelText(/Premija \(USD\)/i), '11.5');

    await user.click(screen.getByRole('button', { name: /Posalji ponudu prodavcu/i }));

    await waitFor(() => {
      expect(mockCreateOffer).toHaveBeenCalledWith({
        sellerBankCode: 'BANKA2',
        sellerUserId: 'remote-user-1',
        listingTicker: 'AAPL',
        quantity: 3,
        pricePerStock: 198.25,
        premium: 11.5,
        settlementDate: expect.any(String),
      });
    });

    await waitFor(() => {
      expect(mockListRemoteListings).toHaveBeenCalledTimes(2);
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Inter-bank ponuda je uspesno poslata.');
  });

  // ─── Spec Celina 5 (Nova) §840-848 — Issue #95 role filter ───
  describe('role filter', () => {
    const makeListing = (
      overrides: Partial<OtcInterbankListing> & { ticker?: string } = {},
    ): OtcInterbankListing => ({
      bankCode: overrides.bankCode ?? '111',
      sellerPublicId: overrides.sellerPublicId ?? `seller-${overrides.ticker ?? 'AAPL'}`,
      sellerName: overrides.sellerName ?? 'Marija Markovic',
      listingTicker: overrides.ticker ?? overrides.listingTicker ?? 'AAPL',
      listingName: overrides.listingName ?? 'Apple Inc.',
      listingCurrency: overrides.listingCurrency ?? 'USD',
      currentPrice: overrides.currentPrice ?? 175,
      availableQuantity: overrides.availableQuantity ?? 50,
      sellerRole: overrides.sellerRole,
    });

    it('hides EMPLOYEE listings from a CLIENT user', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: false, isSupervisor: false });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'AAPL', sellerRole: 'CLIENT' }),
        makeListing({ ticker: 'MSFT', sellerRole: 'EMPLOYEE' }),
        makeListing({ ticker: 'GOOG', sellerRole: 'CLIENT' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('GOOG')).toBeInTheDocument();
      });
      expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
      expect(screen.getByTestId('hidden-by-role-count')).toHaveTextContent('1');
      expect(screen.getByTestId('role-filter-badge')).toHaveTextContent('Klijenti');
    });

    it('hides CLIENT listings from a SUPERVIZOR user', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: false, isSupervisor: true });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'AAPL', sellerRole: 'CLIENT' }),
        makeListing({ ticker: 'MSFT', sellerRole: 'EMPLOYEE' }),
        makeListing({ ticker: 'TSLA', sellerRole: 'EMPLOYEE' }),
        makeListing({ ticker: 'GOOG', sellerRole: 'CLIENT' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText('MSFT')).toBeInTheDocument();
        expect(screen.getByText('TSLA')).toBeInTheDocument();
      });
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
      expect(screen.queryByText('GOOG')).not.toBeInTheDocument();
      expect(screen.getByTestId('hidden-by-role-count')).toHaveTextContent('2');
      expect(screen.getByTestId('role-filter-badge')).toHaveTextContent('Aktuari');
    });

    it('hides CLIENT listings from an AGENT user', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: true, isSupervisor: false });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'AAPL', sellerRole: 'CLIENT' }),
        makeListing({ ticker: 'MSFT', sellerRole: 'EMPLOYEE' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText('MSFT')).toBeInTheDocument();
      });
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });

    it('shows listings without sellerRole as defensive fallback (with warning)', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: false, isSupervisor: false });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'AAPL', sellerRole: 'CLIENT' }),
        makeListing({ ticker: 'MSFT' }),
        makeListing({ ticker: 'TSLA', sellerRole: 'EMPLOYEE' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('MSFT')).toBeInTheDocument();
      });
      expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
      expect(screen.getByTestId('hidden-by-role-count')).toHaveTextContent('1');
      expect(screen.getByTestId('unknown-role-count')).toHaveTextContent('1');
    });

    it('does not show role filter hint when nothing is hidden and all listings have known role', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: false, isSupervisor: false });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'AAPL', sellerRole: 'CLIENT' }),
        makeListing({ ticker: 'GOOG', sellerRole: 'CLIENT' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('role-filter-hint')).not.toBeInTheDocument();
      expect(screen.queryByTestId('hidden-by-role-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('unknown-role-count')).not.toBeInTheDocument();
    });

    it('shows empty-state copy when ALL listings were hidden by role filter', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: false, isAgent: false, isSupervisor: false });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'MSFT', sellerRole: 'EMPLOYEE' }),
        makeListing({ ticker: 'TSLA', sellerRole: 'EMPLOYEE' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText(/Sve\s+2\s+dostupnih ponuda odgovara drugoj roli/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
      expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
    });

    it('admin sees EMPLOYEE listings (admin is implicitly supervisor)', async () => {
      mockUseAuth.mockReturnValue({ isAdmin: true, isAgent: false, isSupervisor: true });
      mockListRemoteListings.mockResolvedValue([
        makeListing({ ticker: 'AAPL', sellerRole: 'CLIENT' }),
        makeListing({ ticker: 'MSFT', sellerRole: 'EMPLOYEE' }),
      ]);

      render(<OtcInterBankDiscoveryTab />);

      await waitFor(() => {
        expect(screen.getByText('MSFT')).toBeInTheDocument();
      });
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
      expect(screen.getByTestId('role-filter-badge')).toHaveTextContent('Aktuari');
    });
  });
});
