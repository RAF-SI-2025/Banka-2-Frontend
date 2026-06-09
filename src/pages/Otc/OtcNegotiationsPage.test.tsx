import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OtcNegotiationsPage from './OtcNegotiationsPage';
import { toast } from '@/lib/notify';

const mockListOffers = vi.fn();
const mockCounter = vi.fn();
vi.mock('@/services/otcService', () => ({
  default: {
    listMyActiveOffers: (...a: unknown[]) => mockListOffers(...a),
    acceptOffer: vi.fn(),
    counterOffer: (...a: unknown[]) => mockCounter(...a),
    declineOffer: vi.fn(),
  },
}));
vi.mock('@/lib/notify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn().mockResolvedValue([]),
    getBankAccounts: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'CLIENT' }, isAdmin: false, isAgent: false, isSupervisor: false }),
}));
vi.mock('./OtcInterBankOffersTab', () => ({
  default: () => <div data-testid="inter-bank-offers">[InterBank]</div>,
}));

const baseOffer = {
  id: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
  buyerId: 1, buyerName: 'Stefan Jovanovic', sellerId: 2, sellerName: 'Milica',
  quantity: 5, pricePerStock: 100, premium: 10, currentPrice: 100,
  settlementDate: '2026-06-04', lastModifiedById: 1, lastModifiedByName: 'Stefan',
  lastModifiedAt: '2026-05-09T10:00:00', waitingOnUserId: 2, myTurn: false, status: 'ACTIVE',
  createdAt: '2026-05-09T10:00:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListOffers.mockResolvedValue([baseOffer]);
});

describe('OtcNegotiationsPage', () => {
  it('renders source filter chip', async () => {
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Iz nase banke/i));
    expect(screen.getByRole('button', { name: /Sve/i })).toBeInTheDocument();
  });

  it('shows local offers under "Sve" filter', async () => {
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
  });

  // Source chip mora prikazati OBA izvora pod "Sve" (binarni `=== 'inter'` je lomio
  // "Sve" tako da je inter izvor bio nevidljiv). Default source je 'all'.
  it('under "Sve" prikazuje i intra (AAPL) i inter ([InterBank]) izvor', async () => {
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
    expect(screen.getByTestId('inter-bank-offers')).toBeInTheDocument();
  });

  it('under "Iz nase banke" prikazuje samo intra (AAPL), bez inter taba', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Iz nase banke/i }));

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByTestId('inter-bank-offers')).not.toBeInTheDocument();
  });

  it('under "Iz drugih banaka" prikazuje samo inter tab, bez intra kartice', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Iz drugih banaka/i }));

    expect(screen.getByTestId('inter-bank-offers')).toBeInTheDocument();
    expect(screen.queryByText('Moji aktivni pregovori (intra-bank)')).not.toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  it('renders VI badge for current user', async () => {
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));
    expect(screen.getByText('VI')).toBeInTheDocument();
  });

  // R1 477: kontraponuda sa datumom u proslosti se odbija pre slanja BE-u.
  it('odbija kontraponudu sa proslim datumom poravnanja (ne poziva counterOffer)', async () => {
    mockListOffers.mockResolvedValue([{ ...baseOffer, myTurn: true, settlementDate: '2020-01-01' }]);
    const user = userEvent.setup();
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));

    // Otvori counter formu.
    await user.click(screen.getByRole('button', { name: /Kontraponuda/i }));
    // Posalji (Datum je vec 2020-01-01 — proslost).
    await user.click(await screen.findByRole('button', { name: /Posalji/i }));

    expect(mockCounter).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('odbija kontraponudu sa kolicinom 0 (ne poziva counterOffer)', async () => {
    mockListOffers.mockResolvedValue([{ ...baseOffer, myTurn: true }]);
    const user = userEvent.setup();
    render(<MemoryRouter><OtcNegotiationsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));

    await user.click(screen.getByRole('button', { name: /Kontraponuda/i }));
    const qtyInput = await screen.findByLabelText('Kolicina');
    await user.clear(qtyInput);
    await user.type(qtyInput, '0');
    await user.click(screen.getByRole('button', { name: /Posalji/i }));

    expect(mockCounter).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});
