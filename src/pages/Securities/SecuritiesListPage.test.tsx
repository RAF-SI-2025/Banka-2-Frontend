import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecuritiesListPage from './SecuritiesListPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Listing, PaginatedResponse } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: () => false,
      isAdmin: true,
    }),
  };
});

const mockListings: Listing[] = [
  {
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
  },
  {
    id: 2,
    ticker: 'MSFT',
    name: 'Microsoft Corp.',
    exchangeAcronym: 'NASDAQ',
    listingType: 'STOCK',
    price: 415.20,
    ask: 415.30,
    bid: 415.10,
    volume: 23000000,
    priceChange: -1.80,
    changePercent: -0.43,
    initialMarginCost: 200,
    maintenanceMargin: 100,
  },
];

const mockPaginatedResponse: PaginatedResponse<Listing> = {
  content: mockListings,
  totalPages: 1,
  totalElements: 2,
  number: 0,
  size: 20,
};

const mockGetAll = vi.fn().mockResolvedValue(mockPaginatedResponse);
const mockRefresh = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/listingService', () => ({
  default: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    refresh: (...args: unknown[]) => mockRefresh(...args),
  },
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SecuritiesListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(mockPaginatedResponse);
  });

  it('renders the page header', async () => {
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Hartije od vrednosti')).toBeInTheDocument();
    });
  });

  it('renders tabs for STOCK, FUTURES, and FOREX (admin user)', async () => {
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Akcije').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Futures').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Forex').length).toBeGreaterThan(0);
  });

  it('displays securities with ticker, price, and change after loading', async () => {
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('MSFT').length).toBeGreaterThan(0);
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/pretrazi po ticker-u/i)).toBeInTheDocument();
    });
  });

  it('calls service with search term after debounce', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/pretrazi po ticker-u/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/pretrazi po ticker-u/i);
    await user.type(searchInput, 'AAPL');

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith('STOCK', 'AAPL', 0, 20, undefined);
    });
  });

  it('switches tabs and refetches data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Futures')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Futures'));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith('FUTURES', '', 0, 20, undefined);
    });
  });

  it('navigates to detail page when clicking a row', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    });

    // Click on the Apple Inc. name in the table row (unique text, within clickable row)
    await user.click(screen.getByText('Apple Inc.'));

    expect(mockNavigate).toHaveBeenCalledWith('/securities/1');
  });

  it('shows loading skeletons initially', () => {
    mockGetAll.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<SecuritiesListPage />);

    // Skeletons are animate-pulse divs
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no listings match', async () => {
    mockGetAll.mockResolvedValue({
      content: [],
      totalPages: 0,
      totalElements: 0,
      number: 0,
      size: 20,
    });

    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema hartija')).toBeInTheDocument();
    });
  });

  it('renders refresh button and calls refresh service', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Osvezi cene')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Osvezi cene'));

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('displays market overview cards with top gainer/loser', async () => {
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getByText('Najveci rast')).toBeInTheDocument();
    });

    expect(screen.getByText('Najveci pad')).toBeInTheDocument();
    expect(screen.getByText('Ukupno hartija')).toBeInTheDocument();
    expect(screen.getByText('Ukupan promet')).toBeInTheDocument();
  });

  it('displays change percentage with correct formatting', async () => {
    renderWithProviders(<SecuritiesListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('+1.31%').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('-0.43%').length).toBeGreaterThan(0);
  });
});
