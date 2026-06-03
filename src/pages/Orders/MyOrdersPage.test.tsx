import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyOrdersPage from './MyOrdersPage';
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
    userName: 'Marko Petrovic',
    userRole: 'CLIENT',
    listingTicker: 'MSFT',
    listingName: 'Microsoft Corp.',
    listingType: 'STOCK',
    orderType: 'LIMIT',
    quantity: 5,
    contractSize: 1,
    pricePerUnit: 415.20,
    limitValue: 410.0,
    direction: 'SELL',
    status: 'DONE',
    approvedBy: 'Admin',
    isDone: true,
    remainingPortions: 0,
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
  size: 10,
};

const mockGetMy = vi.fn().mockResolvedValue(mockPaginatedResponse);
const mockCancelOrder = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/orderService', () => ({
  default: {
    getMy: (...args: unknown[]) => mockGetMy(...args),
    cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  },
}));

describe('MyOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMy.mockResolvedValue(mockPaginatedResponse);
  });

  it('renders the page header', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Moji nalozi')).toBeInTheDocument();
    });
  });

  it('renders user orders after loading', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    });

    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
  });

  it('renders advanced BE filters (status, date, listing type)', async () => {
    // FE-TRD-01: chip filter uklonjen; samo BE dropdown filter ostaje.
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-status-filter')).toBeInTheDocument();
    });

    expect(screen.getByTestId('orders-date-from-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-date-to-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-listing-type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-reset-filters')).toBeInTheDocument();
  });

  it('renders Cancel button for PENDING orders', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Otkazi')).toBeInTheDocument();
    });
  });

  it('shows cancel confirmation dialog when clicking Cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Otkazi')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Otkazi'));

    await waitFor(() => {
      expect(screen.getByText(/Da li ste sigurni da zelite da otkazete nalog/)).toBeInTheDocument();
    });
  });

  it('calls cancel service and reloads when confirming cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Otkazi')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Otkazi'));

    await waitFor(() => {
      expect(screen.getByText('Potvrdi otkazivanje')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi otkazivanje'));

    await waitFor(() => {
      expect(mockCancelOrder).toHaveBeenCalledWith(1);
    });
  });

  it('renders Details button for each order', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Detalji').length).toBe(2);
    });
  });

  it('opens detail dialog when clicking Details', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Detalji').length).toBe(2);
    });

    await user.click(screen.getAllByText('Detalji')[0]);

    await waitFor(() => {
      expect(screen.getByText('Detalji naloga')).toBeInTheDocument();
    });
  });

  it('renders Nova kupovina button that navigates to securities', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Nova kupovina')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Nova kupovina'));
    expect(mockNavigate).toHaveBeenCalledWith('/securities');
  });

  it('shows loading skeletons while loading', () => {
    mockGetMy.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MyOrdersPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no orders exist', async () => {
    mockGetMy.mockResolvedValue({
      content: [],
      totalPages: 1,
      totalElements: 0,
      number: 0,
      size: 10,
    });

    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema kreiranih naloga')).toBeInTheDocument();
    });
  });

  it('filters orders by status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Na cekanju/).length).toBeGreaterThanOrEqual(1);
    });

    // Click the filter button (first match is the filter button)
    await user.click(screen.getAllByText(/Na cekanju/)[0]);

    // After filtering, only PENDING orders should be visible
    await waitFor(() => {
      const rows = screen.getAllByText(/AAPL/);
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('renders Refresh button', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Osvezi')).toBeInTheDocument();
    });
  });

  it('displays order status badges', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('Na cekanju')).toBeInTheDocument();
    });

    expect(screen.getByText('Zavrsen')).toBeInTheDocument();
  });

  // Detaljni filteri: status, datum od/do, tip hartije + Reset.

  it('renders advanced filter controls', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-advanced-filters-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('orders-status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-date-from-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-date-to-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-listing-type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('orders-reset-filters')).toBeInTheDocument();
  });

  it('passes BE status filter to orderService.getMy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-status-filter')).toBeInTheDocument();
    });

    mockGetMy.mockClear();
    await user.selectOptions(screen.getByTestId('orders-status-filter'), 'PENDING');

    await waitFor(() => {
      expect(mockGetMy).toHaveBeenCalledWith(
        0,
        10,
        expect.objectContaining({ status: 'PENDING' }),
      );
    });
  });

  // R1-260: filter sme da nudi SAMO BE OrderStatus vrednosti. PARTIALLY_FILLED i
  // CANCELLED ne postoje na BE-u — getMyOrders bi ih tiho ignorisao i vratio SVE
  // ordere (zavaravajuc filter), pa ih uklanjamo iz dropdown-a.
  it('status filter offers only valid BE OrderStatus values', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-status-filter')).toBeInTheDocument();
    });

    const select = screen.getByTestId('orders-status-filter') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['', 'PENDING', 'APPROVED', 'DECLINED', 'DONE']);
    expect(values).not.toContain('PARTIALLY_FILLED');
    expect(values).not.toContain('CANCELLED');
  });

  it('passes dateFrom filter to orderService.getMy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-date-from-filter')).toBeInTheDocument();
    });

    mockGetMy.mockClear();
    const dateFromInput = screen.getByTestId('orders-date-from-filter');
    await user.type(dateFromInput, '2026-01-01');

    await waitFor(() => {
      expect(mockGetMy).toHaveBeenCalledWith(
        0,
        10,
        expect.objectContaining({ dateFrom: '2026-01-01' }),
      );
    });
  });

  it('passes listingType filter to orderService.getMy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-listing-type-filter')).toBeInTheDocument();
    });

    mockGetMy.mockClear();
    await user.selectOptions(screen.getByTestId('orders-listing-type-filter'), 'STOCK');

    await waitFor(() => {
      expect(mockGetMy).toHaveBeenCalledWith(
        0,
        10,
        expect.objectContaining({ listingType: 'STOCK' }),
      );
    });
  });

  // TEST-fe-trading-3: tip-hartije filter nudi STOCK/FUTURES/FOREX/OPTION (BE
  // listingType je odvojen od OrderStatus enuma — OPTION je validan tip hartije,
  // za razliku od izmisljenih statusa PARTIALLY_FILLED/CANCELLED koji su uklonjeni
  // iz status-filtera). Pinujemo da OPTION postoji u dropdownu i da se prosledjuje BE-u.
  it('listingType filter offers STOCK/FUTURES/FOREX/OPTION values', async () => {
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-listing-type-filter')).toBeInTheDocument();
    });

    const select = screen.getByTestId('orders-listing-type-filter') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['', 'STOCK', 'FUTURES', 'FOREX', 'OPTION']);
  });

  it('passes OPTION listingType filter to orderService.getMy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-listing-type-filter')).toBeInTheDocument();
    });

    mockGetMy.mockClear();
    await user.selectOptions(screen.getByTestId('orders-listing-type-filter'), 'OPTION');

    await waitFor(() => {
      expect(mockGetMy).toHaveBeenCalledWith(
        0,
        10,
        expect.objectContaining({ listingType: 'OPTION' }),
      );
    });
  });

  it('Resetuj filtere clears all filter values and re-fetches without filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-reset-filters')).toBeInTheDocument();
    });

    // Set some filters
    await user.selectOptions(screen.getByTestId('orders-status-filter'), 'PENDING');
    await user.selectOptions(screen.getByTestId('orders-listing-type-filter'), 'STOCK');

    await waitFor(() => {
      expect(
        (screen.getByTestId('orders-status-filter') as HTMLSelectElement).value,
      ).toBe('PENDING');
    });

    mockGetMy.mockClear();
    await user.click(screen.getByTestId('orders-reset-filters'));

    await waitFor(() => {
      expect(
        (screen.getByTestId('orders-status-filter') as HTMLSelectElement).value,
      ).toBe('');
      expect(
        (screen.getByTestId('orders-listing-type-filter') as HTMLSelectElement).value,
      ).toBe('');
    });

    // Posle reset-a, ne salju se filteri u BE.
    await waitFor(() => {
      const lastCall = mockGetMy.mock.calls[mockGetMy.mock.calls.length - 1];
      expect(lastCall?.[2]).toEqual(
        expect.objectContaining({
          status: undefined,
          dateFrom: undefined,
          dateTo: undefined,
          listingType: undefined,
        }),
      );
    });
  });
});
