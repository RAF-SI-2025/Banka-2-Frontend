import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import OtcTrgovinaPage from './OtcTrgovinaPage';

const mockNavigate = vi.fn();
const mockListDiscovery = vi.fn();
const mockCreateLocalOffer = vi.fn();
const mockListRemoteListings = vi.fn();
const mockCreateRemoteOffer = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/otcService', () => ({
  default: {
    listDiscovery: (...args: unknown[]) => mockListDiscovery(...args),
    createOffer: (...args: unknown[]) => mockCreateLocalOffer(...args),
  },
}));

vi.mock('@/services/interbankOtcService', () => ({
  default: {
    listRemoteListings: (...args: unknown[]) => mockListRemoteListings(...args),
    createOffer: (...args: unknown[]) => mockCreateRemoteOffer(...args),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('OtcTrgovinaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDiscovery.mockResolvedValue([
      {
        portfolioId: 1,
        listingId: 101,
        listingTicker: 'AAPL',
        listingName: 'Apple Inc.',
        exchangeAcronym: 'NASDAQ',
        listingCurrency: 'USD',
        currentPrice: 198.25,
        publicQuantity: 50,
        availablePublicQuantity: 40,
        sellerId: 99,
        sellerRole: 'CLIENT',
        sellerName: 'Local Seller',
      },
    ]);
    mockListRemoteListings.mockResolvedValue([
      {
        bankCode: 'BANKA2',
        sellerPublicId: 'remote-user-1',
        sellerName: 'Remote Seller',
        listingTicker: 'MSFT',
        listingName: 'Microsoft Corporation',
        listingCurrency: 'USD',
        currentPrice: 421.15,
        availableQuantity: 25,
      },
    ]);
  });

  it('renders local OTC discovery tab by default', async () => {
    renderWithProviders(<OtcTrgovinaPage />);

    await waitFor(() => {
      expect(mockListDiscovery).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('tab', { name: 'Iz nase banke' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Local Seller')).toBeInTheDocument();
    expect(mockListRemoteListings).not.toHaveBeenCalled();
  });

  it('loads remote discovery when switching to the inter-bank tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OtcTrgovinaPage />);

    await waitFor(() => {
      expect(mockListDiscovery).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: 'Iz drugih banaka' }));

    await waitFor(() => {
      expect(mockListRemoteListings).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('tab', { name: 'Iz drugih banaka' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('BANKA2')).toBeInTheDocument();
    expect(screen.getByText('Remote Seller')).toBeInTheDocument();
  });
});
