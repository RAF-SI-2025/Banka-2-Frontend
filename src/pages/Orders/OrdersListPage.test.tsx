import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersListPage from './OrdersListPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Order, PaginatedResponse } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockOrders: Order[] = [
  {
    id: 1,
    listingId: 10,
    userName: 'Marko Petrovic',
    userRole: 'CLIENT',
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingType: 'STOCK',
    orderType: 'MARKET',
    quantity: 10,
    contractSize: 1,
    pricePerUnit: 178.50,
    direction: 'BUY',
    status: 'PENDING',
    approvedBy: '',
    isDone: false,
    remainingPortions: 10,
    afterHours: false,
    allOrNone: false,
    margin: false,
    approximatePrice: 1785.0,
    createdAt: '2026-03-20T10:00:00Z',
    lastModification: '2026-03-20T10:00:00Z',
  },
  {
    id: 2,
    listingId: 20,
    userName: 'Ana Jovanovic',
    userRole: 'EMPLOYEE',
    listingTicker: 'MSFT',
    listingName: 'Microsoft Corp.',
    listingType: 'STOCK',
    orderType: 'LIMIT',
    quantity: 5,
    contractSize: 1,
    pricePerUnit: 415.20,
    limitValue: 410.0,
    direction: 'SELL',
    status: 'APPROVED',
    approvedBy: 'Admin',
    isDone: false,
    remainingPortions: 3,
    afterHours: false,
    allOrNone: false,
    margin: false,
    approximatePrice: 2076.0,
    createdAt: '2026-03-19T15:30:00Z',
    lastModification: '2026-03-19T16:00:00Z',
  },
];

const mockPaginatedResponse: PaginatedResponse<Order> = {
  content: mockOrders,
  totalPages: 1,
  totalElements: 2,
  number: 0,
  size: 20,
};

const mockGetAll = vi.fn().mockResolvedValue(mockPaginatedResponse);
const mockApprove = vi.fn().mockResolvedValue(undefined);
const mockDecline = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/orderService', () => ({
  default: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    approve: (...args: unknown[]) => mockApprove(...args),
    decline: (...args: unknown[]) => mockDecline(...args),
  },
}));

describe('OrdersListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(mockPaginatedResponse);
  });

  it('renders the page header', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Pregled naloga')).toBeInTheDocument();
    });
  });

  it('renders status filter buttons', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Filter po statusu')).toBeInTheDocument();
    });

    // Check filter buttons exist; status text may also appear in table badges
    expect(screen.getByText(/Svi/)).toBeInTheDocument();
    expect(screen.getAllByText(/Na čekanju/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Odobreni/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Odbijeni/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Završeni/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders orders table after loading', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('renders Approve button for PENDING orders', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Odobri')).toBeInTheDocument();
    });
  });

  it('renders Decline button for PENDING orders', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Odbij')).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog when clicking Approve', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Odobri')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Odobri'));

    expect(screen.getByText(/Da li ste sigurni da želite da odobrite/)).toBeInTheDocument();
  });

  it('shows confirmation dialog when clicking Decline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Odbij')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Odbij'));

    expect(screen.getByText(/Da li ste sigurni da želite da odbijete/)).toBeInTheDocument();
  });

  it('switches status filter when clicking a filter button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText(/Svi/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Svi/));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith('ALL', 0, 20);
    });
  });

  it('shows loading skeleton while orders are loading', () => {
    mockGetAll.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OrdersListPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no orders match filter', async () => {
    mockGetAll.mockResolvedValue({
      content: [],
      totalPages: 0,
      totalElements: 0,
      number: 0,
      size: 20,
    });

    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema naloga za izabrani filter')).toBeInTheDocument();
    });
  });

  it('renders Details button for each order', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Detalji').length).toBeGreaterThan(0);
    });
  });

  it('expands order details when clicking Details', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Detalji').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByText('Detalji')[0]);

    await waitFor(() => {
      expect(screen.getByText('Sakrij')).toBeInTheDocument();
    });
  });

  it('displays order direction badges', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Kupovina')).toBeInTheDocument();
    });

    expect(screen.getByText('Prodaja')).toBeInTheDocument();
  });

  it('displays order type labels', async () => {
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('Market')).toBeInTheDocument();
    });

    expect(screen.getByText('Limit')).toBeInTheDocument();
  });

  // ---------- AfterHours warning badge (Celina 3 spec linija 404) ----------

  it('does not show afterhours warning badge for orders created during regular hours', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Detalji').length).toBeGreaterThan(0);
    });

    // Expand prvi order (afterHours: false)
    await user.click(screen.getAllByText('Detalji')[0]);

    await waitFor(() => {
      expect(screen.getByText('Sakrij')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('order-1-afterhours-warning')).not.toBeInTheDocument();
  });

  it('shows afterhours warning badge with +30 min/fill explanation', async () => {
    const user = userEvent.setup();

    // Override mock: afterHours: true za prvi order
    const ordersWithAfterHours: Order[] = [
      { ...mockOrders[0], afterHours: true },
      mockOrders[1],
    ];
    mockGetAll.mockResolvedValue({
      content: ordersWithAfterHours,
      totalPages: 1,
      totalElements: 2,
      number: 0,
      size: 20,
    });

    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Detalji').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByText('Detalji')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('order-1-afterhours-warning')).toBeInTheDocument();
    });

    expect(screen.getByText('+30 min/fill')).toBeInTheDocument();
  });

  // ---------- TEST-fe-trading-7 (OT-1224): settlement-passed order ----------
  // Za PENDING order ciji je listingSettlementDate prosao: Approve dugme se
  // sakriva (expired -> izvrsenje nema smisla), ali Decline ("Odbij") ostaje
  // dostupno da agent moze rucno da odbije zaglavljeni nalog.

  it('hides Approve but keeps Decline for a PENDING order whose settlement date has passed', async () => {
    const expiredPending: Order = {
      ...mockOrders[0],
      id: 1,
      status: 'PENDING',
      listingSettlementDate: '2020-01-10', // proslost
    };
    mockGetAll.mockResolvedValue({
      content: [expiredPending],
      totalPages: 1,
      totalElements: 1,
      number: 0,
      size: 20,
    });

    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    // Approve sakriveno (settlement prosao), Decline i dalje prisutan.
    expect(screen.queryByText('Odobri')).not.toBeInTheDocument();
    expect(screen.getByText('Odbij')).toBeInTheDocument();
  });

  it('shows both Approve and Decline for a PENDING order with a future settlement date', async () => {
    const futurePending: Order = {
      ...mockOrders[0],
      id: 1,
      status: 'PENDING',
      listingSettlementDate: '2099-01-10', // buducnost
    };
    mockGetAll.mockResolvedValue({
      content: [futurePending],
      totalPages: 1,
      totalElements: 1,
      number: 0,
      size: 20,
    });

    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    expect(screen.getByText('Odobri')).toBeInTheDocument();
    expect(screen.getByText('Odbij')).toBeInTheDocument();
  });
});
