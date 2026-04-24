import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupervisorDashboardPage from './SupervisorDashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Order, ActuaryInfo } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Dashboard se puni tek kad je korisnik supervizor/admin; mock-ujemo AuthContext.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'supervisor@banka.rs',
      firstName: 'Test',
      lastName: 'Super',
      role: 'ADMIN',
      permissions: ['ADMIN', 'SUPERVISOR'],
    },
    isAdmin: true,
    isSupervisor: true,
    isAgent: false,
    hasPermission: () => true,
    logout: vi.fn(),
    login: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockOrders: Order[] = [
  {
    id: 1,
    listingId: 10,
    userName: 'Marko',
    userRole: 'AGENT',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc',
    listingType: 'STOCK',
    orderType: 'MARKET',
    quantity: 100,
    contractSize: 1,
    pricePerUnit: 150,
    direction: 'BUY',
    status: 'PENDING',
    createdAt: '2025-03-15T10:00:00',
  } as Order,
  {
    id: 2,
    listingId: 20,
    userName: 'Ana',
    userRole: 'AGENT',
    listingTicker: 'MSFT',
    listingName: 'Microsoft',
    listingType: 'STOCK',
    orderType: 'LIMIT',
    quantity: 50,
    contractSize: 1,
    pricePerUnit: 400,
    direction: 'SELL',
    status: 'DONE',
    createdAt: '2025-03-14T09:00:00',
  } as Order,
];

const mockAgents: ActuaryInfo[] = [
  {
    id: 1,
    employeeId: 100,
    employeeName: 'Agent Petrovic',
    employeeEmail: 'agent1@banka.rs',
    employeePosition: 'Agent',
    actuaryType: 'AGENT',
    dailyLimit: 100000,
    usedLimit: 90000, // 90% - near limit
    needApproval: false,
  },
  {
    id: 2,
    employeeId: 200,
    employeeName: 'Agent Jovanovic',
    employeeEmail: 'agent2@banka.rs',
    employeePosition: 'Agent',
    actuaryType: 'AGENT',
    dailyLimit: 50000,
    usedLimit: 10000, // 20% - safe
    needApproval: true,
  },
];

const mockTaxRecords = [
  { id: 1, userId: 1, userName: 'User1', userType: 'CLIENT', totalProfit: 10000, taxOwed: 1500, taxPaid: 500, currency: 'RSD' },
];

const mockListings = {
  content: [
    { id: 1, ticker: 'AAPL', name: 'Apple', exchangeAcronym: 'NASDAQ', listingType: 'STOCK', price: 150, ask: 151, bid: 149, volume: 1000000, priceChange: 2, changePercent: 1.5, initialMarginCost: 0, maintenanceMargin: 0 },
  ],
  totalPages: 1,
  totalElements: 1,
};

const mockOrderGetAll = vi.fn();
const mockGetAgents = vi.fn().mockResolvedValue(mockAgents);
const mockListingGetAll = vi.fn().mockResolvedValue(mockListings);
const mockGetTaxRecords = vi.fn().mockResolvedValue(mockTaxRecords);

vi.mock('../../services/orderService', () => ({
  default: {
    getAll: (...args: unknown[]) => mockOrderGetAll(...args),
  },
}));

vi.mock('../../services/actuaryService', () => ({
  default: {
    getAgents: (...args: unknown[]) => mockGetAgents(...args),
  },
}));

vi.mock('../../services/listingService', () => ({
  default: {
    getAll: (...args: unknown[]) => mockListingGetAll(...args),
  },
}));

vi.mock('../../services/taxService', () => ({
  default: {
    getTaxRecords: (...args: unknown[]) => mockGetTaxRecords(...args),
  },
}));

describe('SupervisorDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Call 0: PENDING orders (for stat)
    // Call 4: ALL orders (for table)
    mockOrderGetAll.mockImplementation((status: string) => {
      if (status === 'PENDING') {
        return Promise.resolve({ content: [mockOrders[0]], totalElements: 1 });
      }
      return Promise.resolve({ content: mockOrders, totalElements: 2 });
    });
    mockGetAgents.mockResolvedValue(mockAgents);
    mockListingGetAll.mockResolvedValue(mockListings);
    mockGetTaxRecords.mockResolvedValue(mockTaxRecords);
  });

  it('renders the page header', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText(/Pregled aktivnosti i statistika sistema/i)).toBeInTheDocument();
  });

  it('renders stat cards after loading', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Pending orderi')).toBeInTheDocument();
    });
    expect(screen.getByText('Aktivni agenti')).toBeInTheDocument();
  });

  it('renders pending orders stat value', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      // The stat card shows "1" for pending orders count
      expect(screen.getByText('Pending orderi')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('renders recent orders table', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Poslednjih 10 ordera')).toBeInTheDocument();
    });
  });

  it('renders order tickers in table', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('renders order directions', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('BUY')).toBeInTheDocument();
    });
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('renders order status badges', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
    expect(screen.getByText('DONE')).toBeInTheDocument();
  });

  it('renders agents near limit section', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Agenti blizu limita/)).toBeInTheDocument();
    });
  });

  it('shows agents that are above 80% limit', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      // Agent Petrovic has 90% usage, so should appear
      expect(screen.getByText('Agent Petrovic')).toBeInTheDocument();
    });
    // Agent Jovanovic has 20% usage, should NOT appear in near-limit section
    // But the text might not appear since the filter should exclude it
  });

  it('renders quick action links', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Brze akcije')).toBeInTheDocument();
    });
    expect(screen.getByText('Orderi')).toBeInTheDocument();
    expect(screen.getByText('Aktuari')).toBeInTheDocument();
    expect(screen.getByText('Porez')).toBeInTheDocument();
    expect(screen.getByText('Berze')).toBeInTheDocument();
  });

  it('navigates to orders when Svi orderi is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Svi orderi')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Svi orderi'));
    expect(mockNavigate).toHaveBeenCalledWith('/employee/orders');
  });

  it('navigates to actuaries when Svi agenti is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Svi agenti')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Svi agenti'));
    expect(mockNavigate).toHaveBeenCalledWith('/employee/actuaries');
  });

  it('navigates via quick link cards', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Orderi')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Orderi'));
    expect(mockNavigate).toHaveBeenCalledWith('/employee/orders');
  });

  it('shows loading skeletons while loading', () => {
    mockOrderGetAll.mockReturnValue(new Promise(() => {}));
    mockGetAgents.mockReturnValue(new Promise(() => {}));
    mockListingGetAll.mockReturnValue(new Promise(() => {}));
    mockGetTaxRecords.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<SupervisorDashboardPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty orders state when no orders', async () => {
    mockOrderGetAll.mockResolvedValue({ content: [], totalElements: 0 });
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema ordera')).toBeInTheDocument();
    });
  });

  it('shows no agents near limit message when all agents are safe', async () => {
    mockGetAgents.mockResolvedValue([
      { ...mockAgents[1] }, // only agent with 20% usage
    ]);
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema agenata blizu limita')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully (shows dash values)', async () => {
    mockOrderGetAll.mockRejectedValue(new Error('API error'));
    mockGetAgents.mockRejectedValue(new Error('API error'));
    mockListingGetAll.mockRejectedValue(new Error('API error'));
    mockGetTaxRecords.mockRejectedValue(new Error('API error'));

    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      // Stat values should show "-" for failed fetches
      const dashValues = screen.getAllByText('-');
      expect(dashValues.length).toBeGreaterThan(0);
    });
  });

  it('renders order table headers', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Ticker')).toBeInTheDocument();
    });
    expect(screen.getByText('Smer')).toBeInTheDocument();
    expect(screen.getByText('Kolicina')).toBeInTheDocument();
    expect(screen.getAllByText('Datum').length).toBeGreaterThan(0);
  });
});
