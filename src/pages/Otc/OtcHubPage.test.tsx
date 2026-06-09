import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OtcHubPage from './OtcHubPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/otcService', () => ({
  default: {
    listDiscovery: vi.fn().mockResolvedValue([
      { listingId: 1, listingTicker: 'AAPL', sellerName: 'Milica', publicQuantity: 5, availablePublicQuantity: 5, currentPrice: 100, listingCurrency: 'USD', listingName: 'Apple', portfolioId: 1, sellerId: 2, sellerRole: 'CLIENT' },
      { listingId: 2, listingTicker: 'GOOG', sellerName: 'Lazar', publicQuantity: 3, availablePublicQuantity: 3, currentPrice: 150, listingCurrency: 'USD', listingName: 'Google', portfolioId: 2, sellerId: 3, sellerRole: 'CLIENT' },
    ]),
    listMyActiveOffers: vi.fn().mockResolvedValue([
      { id: 1, myTurn: true, status: 'ACTIVE', listingTicker: 'AAPL' },
      { id: 2, myTurn: false, status: 'ACTIVE', listingTicker: 'GOOG' },
    ]),
    listMyContracts: vi.fn().mockResolvedValue([
      { id: 1, status: 'ACTIVE' },
      { id: 2, status: 'EXERCISED' },
    ]),
    listMyPublicListings: vi.fn().mockResolvedValue([
      { listingId: 1, listingTicker: 'AAPL', publicQuantity: 5 },
    ]),
  },
}));

vi.mock('@/services/interbankOtcService', () => ({
  default: {
    listRemoteListings: vi.fn().mockResolvedValue([]),
    listMyOffers: vi.fn().mockResolvedValue([]),
    listMyContracts: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/AuthContext')>('@/context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'CLIENT' as const, permissions: [], isActive: true },
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
      hasPermission: () => false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    }),
  };
});

beforeEach(() => mockNavigate.mockClear());

describe('OtcHubPage', () => {
  it('renders 4 hub cards', async () => {
    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('hub-discovery')).toBeInTheDocument();
      expect(screen.getByTestId('hub-negotiations')).toBeInTheDocument();
      expect(screen.getByTestId('hub-contracts')).toBeInTheDocument();
      expect(screen.getByTestId('hub-my-public')).toBeInTheDocument();
    });
  });

  it('shows live counts after fetch', async () => {
    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('hub-discovery')).toHaveTextContent('2');
      expect(screen.getByTestId('hub-negotiations')).toHaveTextContent('2');
      expect(screen.getByTestId('hub-contracts')).toHaveTextContent('1');
      expect(screen.getByTestId('hub-my-public')).toHaveTextContent('1');
    });
  });

  it('shows warning when myTurn offer exists', async () => {
    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/ceka tebe/i)).toBeInTheDocument();
    });
  });

  it('navigates on card click', async () => {
    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);
    await waitFor(() => screen.getByTestId('hub-discovery'));
    fireEvent.click(screen.getByTestId('hub-discovery'));
    expect(mockNavigate).toHaveBeenCalledWith('/otc/discovery');
    fireEvent.click(screen.getByTestId('hub-negotiations'));
    expect(mockNavigate).toHaveBeenCalledWith('/otc/pregovori');
    fireEvent.click(screen.getByTestId('hub-contracts'));
    expect(mockNavigate).toHaveBeenCalledWith('/otc/ugovori');
    fireEvent.click(screen.getByTestId('hub-my-public'));
    expect(mockNavigate).toHaveBeenCalledWith('/otc/moje');
  });

  // FIX: brojaci ugovora moraju ukljuciti inter-bank ugovore. Pravi aktivni
  // inter-bank ugovor je ranije ignorisan ("AKTIVNIH UGOVORA"=0).
  it('broji aktivne inter-bank ugovore zajedno sa lokalnim', async () => {
    const otcService = (await import('@/services/otcService')).default;
    const interbankOtcService = (await import('@/services/interbankOtcService')).default;
    // 1 lokalni ACTIVE
    vi.mocked(otcService.listMyContracts).mockResolvedValueOnce([
      { id: 1, status: 'ACTIVE', buyerId: 1, sellerId: 2, listingCurrency: 'USD',
        premium: 0, strikePrice: 0, quantity: 0, currentPrice: 0 },
    ] as never);
    // 2 inter-bank ACTIVE
    vi.mocked(interbankOtcService.listMyContracts).mockResolvedValueOnce([
      { id: 'i1', status: 'ACTIVE', buyerName: 'Test User' },
      { id: 'i2', status: 'ACTIVE', sellerName: 'Test User' },
    ] as never);

    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);
    await waitFor(() => {
      // 1 lokalni + 2 inter = 3 ACTIVE
      expect(screen.getByTestId('hub-contracts')).toHaveTextContent('3');
    });
  });

  // R1 855: dva LOKALNA listinga (razliciti prodavci-osobe) pripadaju ISTOJ
  // banci → "iz 1 banke", a ne "iz 2 banaka" (raniji bug je brojao prodavce).
  it('broji lokalne listinge kao jednu banku (ne po imenu prodavca)', async () => {
    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('hub-discovery')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/iz 1 banke/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/iz 2 banaka/i)).toBeNull();
  });

  // R1 567: premija/notional se grupisu po valuti, ne sabiraju slepo u RSD.
  it('grupise premiju/notional po valuti i upozorava na vise valuta', async () => {
    const otcService = (await import('@/services/otcService')).default;
    vi.mocked(otcService.listMyContracts).mockResolvedValueOnce([
      // user.id === 1; kao kupac u USD ugovoru
      { id: 10, status: 'ACTIVE', buyerId: 1, sellerId: 2, buyerName: 'Test User', sellerName: 'X',
        listingCurrency: 'USD', premium: 100, strikePrice: 50, quantity: 10, currentPrice: 60,
        listingTicker: 'AAPL', listingName: 'Apple', settlementDate: '2030-01-01', createdAt: '2026-01-01' },
      // kao kupac u EUR ugovoru
      { id: 11, status: 'ACTIVE', buyerId: 1, sellerId: 3, buyerName: 'Test User', sellerName: 'Y',
        listingCurrency: 'EUR', premium: 80, strikePrice: 40, quantity: 5, currentPrice: 45,
        listingTicker: 'SAP', listingName: 'SAP', settlementDate: '2030-01-01', createdAt: '2026-01-01' },
    ] as never);

    render(<MemoryRouter><OtcHubPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getAllByText(/vise valuta/i).length).toBeGreaterThan(0);
    });
    // Notional dominantne valute prikazan sa kodom valute (USD notional 50*10=500 > EUR 40*5=200).
    expect(screen.getByText(/iznosi se ne sabiraju preko valuta/i)).toBeInTheDocument();
  });
});
