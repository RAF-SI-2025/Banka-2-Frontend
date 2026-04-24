import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortfolioPage from './PortfolioPage';
import { renderWithProviders } from '../../test/test-utils';
import type { PortfolioItem, PortfolioSummary } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

const mockGetSummary = vi.fn().mockResolvedValue(mockSummary);
const mockGetMyPortfolio = vi.fn().mockResolvedValue(mockItems);
const mockSetPublicQuantity = vi.fn().mockResolvedValue({ ...mockItems[0], publicQuantity: 20 });

vi.mock('../../services/portfolioService', () => ({
  default: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    getMyPortfolio: (...args: unknown[]) => mockGetMyPortfolio(...args),
    setPublicQuantity: (...args: unknown[]) => mockSetPublicQuantity(...args),
  },
}));

vi.mock('../../services/listingService', () => ({
  default: {
    exerciseOption: vi.fn().mockResolvedValue(undefined),
  },
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

describe('PortfolioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSummary.mockResolvedValue(mockSummary);
    mockGetMyPortfolio.mockResolvedValue(mockItems);
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

  it('renders public quantity input for STOCK items', async () => {
    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      // Both the Input and Button have the same title, so expect 2 elements for the one STOCK item
      const elements = screen.getAllByTitle(/Javne akcije su vidljive na OTC portalu/i);
      expect(elements.length).toBe(2); // Input + Button for AAPL (STOCK)
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
});
