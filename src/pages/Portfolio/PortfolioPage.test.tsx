import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortfolioPage from './PortfolioPage';
import { renderWithProviders } from '../../test/test-utils';
import type { PortfolioItem, PortfolioSummary } from '@/types/celina3';
import type { DividendPayoutDto } from '@/types/dividend';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// PortfolioPage vise ne cita useAuth (OT-1218 reklasifikovano — exercise je
// izmesten na SecuritiesDetailsPage), ali zadrzavamo mock jer pojedini testovi
// renderuju kao zaposleni i da bismo eksplicitno pinovali da portfolio strana
// NEMA exercise dugme cak ni za zaposlenog.
const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>(
    '../../context/AuthContext',
  );
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

const mockSummary: PortfolioSummary = {
  totalValue: 150000.0,
  totalProfit: 12500.0,
  paidTaxThisYear: 3000.0,
  unpaidTaxThisMonth: 750.0,
};

const mockItems: PortfolioItem[] = [
  {
    id: 1,
    listingId: 1,
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingType: 'STOCK',
    quantity: 50,
    averageBuyPrice: 165.0,
    currentPrice: 178.50,
    profit: 675.0,
    profitPercent: 8.18,
    publicQuantity: 10,
    lastModified: '2026-03-20T10:00:00Z',
  },
  {
    id: 2,
    listingId: 2,
    listingTicker: 'ES=F',
    listingName: 'E-mini S&P 500',
    listingType: 'FUTURES',
    quantity: 2,
    averageBuyPrice: 5200.0,
    currentPrice: 5350.0,
    profit: 300.0,
    profitPercent: 2.88,
    publicQuantity: 0,
    lastModified: '2026-03-19T15:00:00Z',
  },
];

const mockDividend: DividendPayoutDto = {
  id: 1,
  ownerId: 42,
  ownerType: 'CLIENT',
  stockListingId: 1,
  stockTicker: 'AAPL',
  quantity: 50,
  priceOnDate: 178.5,
  dividendYieldRate: 0.005,
  grossAmount: 50,
  tax: 7.5,
  netAmount: 42.5,
  creditedAccountId: 265,
  currencyCode: 'USD',
  paymentDate: '2026-03-31',
  taxExempt: false,
  createdAt: '2026-03-31T17:00:00Z',
};

const mockGetSummary = vi.fn().mockResolvedValue(mockSummary);
const mockGetMyPortfolio = vi.fn().mockResolvedValue(mockItems);
const mockSetPublicQuantity = vi.fn().mockResolvedValue({ ...mockItems[0], publicQuantity: 20 });
const mockGetDividendsByPosition = vi.fn();

vi.mock('../../services/portfolioService', () => ({
  default: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    getMyPortfolio: (...args: unknown[]) => mockGetMyPortfolio(...args),
    setPublicQuantity: (...args: unknown[]) => mockSetPublicQuantity(...args),
  },
}));

vi.mock('../../services/dividendService', () => ({
  default: {
    getMyDividends: vi.fn(),
    getDividendsByPosition: (...args: unknown[]) => mockGetDividendsByPosition(...args),
  },
}));

vi.mock('@/pages/Funds/MyFundsTab', () => ({
  default: () => <div>Mocked MyFundsTab Content</div>,
}));

// Mock recharts
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

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

describe('PortfolioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(anonAuth());
    mockGetSummary.mockResolvedValue(mockSummary);
    mockGetMyPortfolio.mockResolvedValue(mockItems);
    mockGetDividendsByPosition.mockResolvedValue([]);
  });

  it('renders the page header', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Moj portfolio')).toBeInTheDocument();
    });
  });

  it('renders summary cards with total value', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Ukupna vrednost portfolija')).toBeInTheDocument();
    });
  });

  it('renders summary cards with total profit', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Ukupan profit')).toBeInTheDocument();
    });
  });

  it('renders tax cards', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText(/Plaćen porez ove godine/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Neplaćen porez za tekući mesec/i)).toBeInTheDocument();
  });

  it('renders holdings table with portfolio items', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Hartije u vlasnistvu')).toBeInTheDocument();
    });

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('ES=F')).toBeInTheDocument();
  });

  it('renders Sell button for each item', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Prodaj').length).toBe(2);
    });
  });

  it('navigates to sell page when clicking Sell', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Prodaj').length).toBe(2);
    });

    await user.click(screen.getAllByText('Prodaj')[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/orders/new?listingId=1&direction=SELL');
  });

  it('renders public quantity input + button for STOCK items', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      // Posle UX fix-a (10.05.2026 vece-6): tooltip sad dinamicki govori sta dugme radi.
      // Input + Button koriste isti dynamicni title. AAPL (STOCK) ima publicQuantity=10
      // u mock-u, pa je dugme inicijalno disabled (input vrednost == persistedValue).
      const stockSaveButton = screen.getByTestId('public-quantity-save-1');
      expect(stockSaveButton).toBeInTheDocument();
      expect(stockSaveButton).toHaveTextContent(/Učini javnim/i);
      // Input takodje postoji
      const stockInput = screen.getByTestId('public-quantity-input-1');
      expect(stockInput).toBeInTheDocument();
    });
  });

  it('renders listing type badges', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Akcija')).toBeInTheDocument();
    });
  });

  it('shows loading skeletons while loading', () => {
    mockGetSummary.mockReturnValue(new Promise(() => {}));
    mockGetMyPortfolio.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PortfolioPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no items in portfolio', async () => {
    mockGetMyPortfolio.mockResolvedValue([]);

    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Nemate hartije u portfoliju')).toBeInTheDocument();
    });
  });

  it('shows error alert when loading fails', async () => {
    mockGetSummary.mockRejectedValue(new Error('fail'));
    mockGetMyPortfolio.mockRejectedValue(new Error('fail'));

    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText(/Greška pri učitavanju portfolija/i)).toBeInTheDocument();
    });
  });

  it('displays profit with correct sign formatting', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    // Positive profit should have + prefix
    const profitCells = document.querySelectorAll('.text-emerald-600, .dark\\:text-emerald-400');
    expect(profitCells.length).toBeGreaterThan(0);
  });

  it('renders column headers in holdings table', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Ticker')).toBeInTheDocument();
    });

    expect(screen.getByText('Tip')).toBeInTheDocument();
    expect(screen.getByText(/Količina/i)).toBeInTheDocument();
    // "Profit" appears in both the summary card title and the table header
    expect(screen.getAllByText(/Profit/).length).toBeGreaterThan(0);
  });

  it('switches to Moji fondovi tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Moje hartije')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Moji fondovi' }));
    expect(screen.getByText('Mocked MyFundsTab Content')).toBeInTheDocument();
  });

  // --- FE4 (7.1) — istorija dividendi po poziciji ---

  it('renders dividend history toggle only for STOCK positions', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    // AAPL je STOCK -> ima toggle; ES=F je FUTURES -> nema.
    expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    expect(screen.queryByTestId('dividend-toggle-2')).not.toBeInTheDocument();
  });

  it('expands dividend history and shows empty state when no dividends', async () => {
    const user = userEvent.setup();
    mockGetDividendsByPosition.mockResolvedValue([]);
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));

    expect(mockGetDividendsByPosition).toHaveBeenCalledWith(1);
    await waitFor(() => {
      expect(screen.getByTestId('dividend-history-empty')).toBeInTheDocument();
    });
  });

  it('renders dividend payout rows when history exists', async () => {
    const user = userEvent.setup();
    mockGetDividendsByPosition.mockResolvedValue([mockDividend]);
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));

    await waitFor(() => {
      expect(screen.getByTestId('dividend-history-table')).toBeInTheDocument();
    });
    expect(screen.getByText('Istorija primljenih dividendi')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('shows unavailable message when dividend endpoint is not implemented (404)', async () => {
    const user = userEvent.setup();
    mockGetDividendsByPosition.mockRejectedValue({ response: { status: 404 } });
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));

    await waitFor(() => {
      expect(screen.getByTestId('dividend-history-unavailable')).toBeInTheDocument();
    });
  });

  it('collapses dividend history on second toggle click', async () => {
    const user = userEvent.setup();
    mockGetDividendsByPosition.mockResolvedValue([]);
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));
    await waitFor(() => {
      expect(screen.getByTestId('dividend-history-empty')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));
    await waitFor(() => {
      expect(screen.queryByTestId('dividend-history-empty')).not.toBeInTheDocument();
    });

    // Drugi klik (collapse) ne sme da pravi novi BE poziv — rezultat je keširan.
    expect(mockGetDividendsByPosition).toHaveBeenCalledTimes(1);
  });

  it('shows error message when dividend endpoint fails with a non-404 error', async () => {
    const user = userEvent.setup();
    mockGetDividendsByPosition.mockRejectedValue({ response: { status: 500 } });
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));

    await waitFor(() => {
      expect(screen.getByTestId('dividend-history-error')).toBeInTheDocument();
    });
  });

  it('renders em-dash for tax on a tax-exempt (EMPLOYEE) dividend', async () => {
    const user = userEvent.setup();
    mockGetDividendsByPosition.mockResolvedValue([
      { ...mockDividend, id: 9, taxExempt: true, tax: 0 },
    ]);
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dividend-toggle-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dividend-toggle-1'));

    await waitFor(() => {
      expect(screen.getByTestId('dividend-history-table')).toBeInTheDocument();
    });
    // Tax-exempt red prikazuje '—' umesto iznosa poreza.
    const table = screen.getByTestId('dividend-history-table');
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  // ===========================================================================
  // OT-1218 — REKLASIFIKOVANO (reviewer-blocker close).
  // Domenski model NE predstavlja opcione pozicije kao portfolio redove:
  // ListingType = {STOCK, FUTURES, FOREX} (nema OPTION), a BE producer upisuje
  // ticker/tip OSNOVNE akcije. Ranija portfolio-strana "Iskoristi opciju" grana
  // se NIKAD nije renderovala u proizvodnji (dead wiring) — uklonjena je. Pravi
  // exercise entry point je lanac opcija na SecuritiesDetailsPage (OptionItem.id =
  // pravi Option.id) — pokriveno SecuritiesDetailsPage.test.tsx.
  // Ovaj test pinuje da portfolio strana VISE NEMA exercise dugme, cak ni za
  // zaposlenog sa profitabilnom FUTURES pozicijom (settlement-dated, ITM).
  // ===========================================================================
  it('OT-1218 reklasifikovano: portfolio strana NEMA "Iskoristi opciju" dugme (dead-wiring uklonjen)', async () => {
    mockUseAuth.mockReturnValue(employeeAuth());

    const itmFutures: PortfolioItem = {
      id: 558,
      listingId: 45,
      listingTicker: 'ES=F',
      listingName: 'E-mini S&P 500',
      listingType: 'FUTURES',
      quantity: 2,
      averageBuyPrice: 5000,
      currentPrice: 5300,
      profit: 600,
      profitPercent: 6,
      publicQuantity: 0,
      lastModified: '2026-03-20T10:00:00Z',
      settlementDate: '2099-12-31', // u buducnosti, ITM
      inTheMoney: true,
    };
    mockGetMyPortfolio.mockResolvedValue([itmFutures]);

    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('E-mini S&P 500')).toBeInTheDocument();
    });
    // Nikakvog exercise dugmeta na portfolio strani (ni za zaposlenog, ni ITM).
    expect(screen.queryByText('Iskoristi opciju')).not.toBeInTheDocument();
  });
});
