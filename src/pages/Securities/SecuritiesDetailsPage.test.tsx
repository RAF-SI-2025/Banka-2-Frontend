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

// OT-1218 (REKLASIFIKOVANO): exercise plain-opcije je aktuar/admin operacija
// koja se pokrece iz lanca opcija (OptionItem.id = pravi Option.id). Mockujemo
// useAuth da kontrolisemo isEmployee granu.
const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/AuthContext')>('@/context/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

function anonAuth() {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasPermission: () => false,
    isAdmin: false,
    isAgent: false,
    isSupervisor: false,
    isEmployee: false,
  };
}

function employeeAuth() {
  return { ...anonAuth(), user: { id: 7, role: 'EMPLOYEE' }, isAuthenticated: true, isSupervisor: true, isEmployee: true };
}

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
const mockExerciseOption = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/listingService', () => ({
  default: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    getOptions: (...args: unknown[]) => mockGetOptions(...args),
    exerciseOption: (...args: unknown[]) => mockExerciseOption(...args),
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
    mockExerciseOption.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(anonAuth());
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

  // R1 416,559: grafik koristi STVARNE OHLCV podatke (getHistory), bez GBM/Math.random.
  it('dohvata STVARNU istoriju cena preko getHistory(period) i renderuje grafik', async () => {
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalledWith(1, 'MONTH');
    });
    // Grafik (recharts AreaChart) se renderuje kad ima >= 2 realne tacke.
    await waitFor(() => {
      expect(screen.getByTestId('securities-chart')).toBeInTheDocument();
    });
    expect(screen.getByText(/STVARNI PODACI/i)).toBeInTheDocument();
    // Nema vise "SIMULIRANI PODACI" / GBM napomene.
    expect(screen.queryByText(/SIMULIRANI PODACI/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/GBM/i);
  });

  it('re-fetcha istoriju kad se promeni period (klik na 1G → YEAR)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalledWith(1, 'MONTH');
    });
    await user.click(screen.getByText('1G'));
    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalledWith(1, 'YEAR');
    });
  });

  it('prikazuje prazno stanje (NE simulaciju) kad nema dovoljno realnih podataka', async () => {
    mockGetHistory.mockResolvedValue([
      { date: '2026-03-03', price: 178.5, high: 180, low: 176, change: 0, volume: 1 },
    ]); // samo 1 tacka < 2 -> empty-state
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('securities-chart-empty')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('securities-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/Nema dovoljno istorijskih podataka/i)).toBeInTheDocument();
  });

  it('prazno stanje kad getHistory padne (bez fake fallback-a)', async () => {
    mockGetHistory.mockRejectedValue(new Error('history down'));
    renderWithProviders(<SecuritiesDetailsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('securities-chart-empty')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // OT-1218 (REKLASIFIKOVANO) — pravi exercise entry point je lanac opcija.
  // Opcione pozicije NE postoje kao portfolio redovi (ListingType = STOCK/FUTURES/
  // FOREX). Plain-opciju izvrsava aktuar/admin BAS odavde — POST /options/{id}/
  // exercise sa OptionItem.id (pravim Option.id, NE listingId akcije ni neki
  // portfolio-row id). Ovi testovi pokrivaju ceo flow: lanac nosi Option.id →
  // exercise se zove sa tim id-em → samo zaposleni vidi akciju.
  // ===========================================================================
  it('OT-1218: aktuar/zaposleni iz lanca opcija izvrsava opciju sa PRAVIM Option.id (ne listingId)', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(employeeAuth());

    renderWithProviders(<SecuritiesDetailsPage />);

    // CALL @ strike 175 ima id=1 i ITM je (current 178.50 > 175).
    const exerciseBtn = await screen.findByTestId('option-exercise-call-1');
    await user.click(exerciseBtn);

    // ConfirmDialog potvrda.
    const confirmBtn = await screen.findByTestId('confirm-dialog-confirm');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockExerciseOption).toHaveBeenCalledTimes(1);
    });
    // KORektno: salje se Option.id (1), a NE listingId akcije (1 je ovde slucajno
    // isti broj — zato proverimo da je pozvan TACNO sa id opcije za drugu opciju).
    expect(mockExerciseOption).toHaveBeenCalledWith(1);
  });

  it('OT-1218: PUT opcija salje SVOJ Option.id (3), ne listingId akcije', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(employeeAuth());

    renderWithProviders(<SecuritiesDetailsPage />);

    // PUT @ strike 180 ima id=4 i ITM je (current 178.50 < 180). PUT @175 -> id=3.
    const exerciseBtn = await screen.findByTestId('option-exercise-put-4');
    await user.click(exerciseBtn);

    const confirmBtn = await screen.findByTestId('confirm-dialog-confirm');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockExerciseOption).toHaveBeenCalledWith(4);
    });
    // NIKAD listingId akcije (1).
    expect(mockExerciseOption).not.toHaveBeenCalledWith(1);
  });

  it('OT-1218: klijent (ne-zaposleni) NE vidi exercise akciju u lancu opcija (authz)', async () => {
    mockUseAuth.mockReturnValue(anonAuth());

    renderWithProviders(<SecuritiesDetailsPage />);

    // Lanac se renderuje (strike 175 vidljiv), ali bez exercise dugmadi.
    await waitFor(() => {
      expect(screen.getByText(/Lanac opcija/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('option-exercise-call-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('option-exercise-put-4')).not.toBeInTheDocument();
  });
});
