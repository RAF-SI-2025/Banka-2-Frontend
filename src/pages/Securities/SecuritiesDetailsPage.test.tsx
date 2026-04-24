import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecuritiesDetailsPage from './SecuritiesDetailsPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Listing, ListingDailyPrice, OptionChain } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  };
});

const mockListing: Listing = {
  id: 1,
  ticker: 'AAPL',
  name: 'Apple Inc.',
  exchangeAcronym: 'NASDAQ',
  listingType: 'STOCK',
  price: 178.50,
  ask: 178.55,
  bid: 178.45,
  volume: 52000000,
  priceChange: 2.30,
  changePercent: 1.31,
  initialMarginCost: 100,
  maintenanceMargin: 50,
  outstandingShares: 15500000000,
  dividendYield: 0.55,
  marketCap: 2800000000000,
};

const mockHistory: ListingDailyPrice[] = [
  { date: '2026-03-01', price: 170.0, high: 172.0, low: 169.0, change: 1.5, volume: 50000000 },
  { date: '2026-03-02', price: 173.0, high: 175.0, low: 171.0, change: 3.0, volume: 55000000 },
  { date: '2026-03-03', price: 178.5, high: 180.0, low: 176.0, change: 5.5, volume: 60000000 },
];

const mockOptionChains: OptionChain[] = [
  {
    settlementDate: '2026-06-20',
    currentStockPrice: 178.50,
    calls: [
      { id: 1, strikePrice: 175, bid: 5.0, ask: 5.5, price: 5.25, volume: 1000, openInterest: 5000, impliedVolatility: 0.25, inTheMoney: true },
      { id: 2, strikePrice: 180, bid: 2.5, ask: 3.0, price: 2.75, volume: 2000, openInterest: 8000, impliedVolatility: 0.28, inTheMoney: false },
    ],
    puts: [
      { id: 3, strikePrice: 175, bid: 1.5, ask: 2.0, price: 1.75, volume: 800, openInterest: 3000, impliedVolatility: 0.24, inTheMoney: false },
      { id: 4, strikePrice: 180, bid: 4.0, ask: 4.5, price: 4.25, volume: 1500, openInterest: 6000, impliedVolatility: 0.27, inTheMoney: true },
    ],
  },
];

const mockGetById = vi.fn().mockResolvedValue(mockListing);
const mockGetHistory = vi.fn().mockResolvedValue(mockHistory);
const mockGetOptions = vi.fn().mockResolvedValue(mockOptionChains);

vi.mock('../../services/listingService', () => ({
  default: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    getOptions: (...args: unknown[]) => mockGetOptions(...args),
    refresh: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock recharts
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
}));

describe('SecuritiesDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetById.mockResolvedValue(mockListing);
    mockGetHistory.mockResolvedValue(mockHistory);
    mockGetOptions.mockResolvedValue(mockOptionChains);
  });

  it('renders security ticker and name', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });

  it('renders listing type badge', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Akcija')).toBeInTheDocument();
    });
  });

  it('renders exchange acronym badge', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('NASDAQ')).toBeInTheDocument();
    });
  });

  it('renders chart timeframe period buttons', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('1D')).toBeInTheDocument();
    });

    expect(screen.getByText('1N')).toBeInTheDocument();
    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('1G')).toBeInTheDocument();
    expect(screen.getByText('5G')).toBeInTheDocument();
    // "Sve" may appear in both period buttons and options filter
    expect(screen.getAllByText('Sve').length).toBeGreaterThan(0);
  });

  it('changes active period when clicking timeframe button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('1D')).toBeInTheDocument();
    });

    // Default je MESEC (1M); nakon klika na 1D toggle se markira kao aktivan
    // (gradient background klasa se dodaje samo aktivnom period button-u).
    const dayBtn = screen.getByText('1D');
    await user.click(dayBtn);

    await waitFor(() => {
      expect(dayBtn.className).toContain('from-indigo-500');
    });
  });

  it('renders Buy and Sell direction buttons', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('KUPI')).toBeInTheDocument();
    });

    expect(screen.getByText('PRODAJ')).toBeInTheDocument();
  });

  it('switches between buy and sell direction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('KUPI')).toBeInTheDocument();
    });

    await user.click(screen.getByText('PRODAJ'));

    expect(screen.getByText(/Prodaj AAPL/)).toBeInTheDocument();
  });

  it('navigates to create order page when clicking buy/sell button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Kupi AAPL/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Kupi AAPL/));

    expect(mockNavigate).toHaveBeenCalledWith('/orders/new?listingId=1&direction=BUY');
  });

  it('renders stats section with price data', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Podaci o hartiji')).toBeInTheDocument();
    });

    expect(screen.getByText('Cena')).toBeInTheDocument();
    expect(screen.getByText('Bid')).toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('renders options table for stocks', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    });

    // Options chain section should be visible for STOCK type
    await waitFor(() => {
      // Options chain header
      expect(screen.getByText(/Lanac opcija/i)).toBeInTheDocument();
      // Strike prices are formatted with formatPrice (e.g., 175,00)
      const page = document.body;
      expect(page.textContent).toContain('175');
      expect(page.textContent).toContain('180');
    });
  });

  it('shows loading skeletons initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {}));
    mockGetHistory.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SecuritiesDetailsPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows not found state when listing is null', async () => {
    mockGetById.mockRejectedValue(new Error('Not found'));
    mockGetHistory.mockRejectedValue(new Error('Not found'));

    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Hartija nije pronadjena')).toBeInTheDocument();
    });

    expect(screen.getByText('Nazad na listu')).toBeInTheDocument();
  });

  it('navigates back to list when clicking back button', async () => {
    mockGetById.mockRejectedValue(new Error('Not found'));
    mockGetHistory.mockRejectedValue(new Error('Not found'));

    const user = userEvent.setup();
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByText('Nazad na listu')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Nazad na listu'));
    expect(mockNavigate).toHaveBeenCalledWith('/securities');
  });
});
