import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import OtcInterBankDiscoveryTab from './OtcInterBankDiscoveryTab';

const mockListRemoteListings = vi.fn();
const mockCreateOffer = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

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
});
