import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateOrderPage from './CreateOrderPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Listing } from '@/types/celina3';
import type { Account } from '@/types/celina2';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
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
];

const mockAccounts: Account[] = [
  {
    id: 1,
    accountNumber: '265-1234567890123-45',
    name: 'Tekuci racun',
    ownerName: 'Marko Petrovic',
    balance: 500000,
    availableBalance: 500000,
    currency: 'USD',
    accountType: 'CHECKING',
    accountSubtype: 'STANDARD',
    status: 'ACTIVE',
    createdAt: '2026-01-01',
    employeeId: 1,
    isActive: true,
    dailyLimit: 100000,
  } as Account,
];

const mockGetAll = vi.fn().mockResolvedValue({ content: mockListings, totalPages: 1, totalElements: 1, number: 0, size: 100 });
const mockGetById = vi.fn();
const mockCreate = vi.fn().mockResolvedValue({ id: 1 });

vi.mock('../../services/listingService', () => ({
  default: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

vi.mock('../../services/orderService', () => ({
  default: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('../../components/shared/VerificationModal', () => ({
  default: ({
    isOpen,
    onVerified,
  }: { isOpen: boolean; onVerified: (otpCode: string) => Promise<void> | void }) => (
    isOpen ? <button onClick={() => onVerified('123456')}>Mock OTP Confirm</button> : null
  ),
}));

const mockFundList = vi.fn().mockResolvedValue([]);
const mockFundGet = vi.fn();

vi.mock('../../services/investmentFundService', () => ({
  default: {
    list: (...args: unknown[]) => mockFundList(...args),
    get: (...args: unknown[]) => mockFundGet(...args),
  },
}));

const mockGetAllAccounts = vi.fn();
const mockGetMyAccounts = vi.fn();

vi.mock('../../services/accountService', () => ({
  accountService: {
    getAll: (...args: unknown[]) => mockGetAllAccounts(...args),
    getMyAccounts: (...args: unknown[]) => mockGetMyAccounts(...args),
    getBankAccounts: (...args: unknown[]) => mockGetMyAccounts(...args),
  },
}));

vi.mock('../../services/exchangeManagementService', () => ({
  default: {
    getByAcronym: vi.fn().mockResolvedValue({ isOpen: true, name: 'NASDAQ' }),
  },
}));

// Margin checkbox je onemogucen dok klijent nema aktivan margin account —
// test za toggle ocekuje postojeci aktivni account.
vi.mock('../../services/marginService', () => ({
  default: {
    getMyAccounts: vi.fn().mockResolvedValue([
      {
        id: 1,
        status: 'ACTIVE',
        currency: 'USD',
        balance: 1000,
        reservedAmount: 0,
        availableBalance: 1000,
      },
    ]),
  },
}));

describe('CreateOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: () => true,
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });
    mockGetAll.mockResolvedValue({ content: mockListings, totalPages: 1, totalElements: 1, number: 0, size: 100 });
    mockGetAllAccounts.mockResolvedValue({ content: mockAccounts });
    mockGetMyAccounts.mockResolvedValue(mockAccounts);
    mockFundList.mockResolvedValue([]);
    mockFundGet.mockResolvedValue(null);
  });

  it('renders the page header', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText('Novi nalog')).toBeInTheDocument();
    });
  });

  it('renders the order form after loading', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText('Podaci naloga')).toBeInTheDocument();
    });
  });

  it('renders direction selection (Kupovina/Prodaja)', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      // "Kupovina" may appear in both the form and the cost summary
      expect(screen.getAllByText('Kupovina').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Prodaja').length).toBeGreaterThan(0);
  });

  it('renders order type select with options', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Tip ordera') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);
    expect(options).toContain('Market');
    expect(options).toContain('Limit');
    expect(options).toContain('Stop');
    expect(options).toContain('Stop-Limit');
  });

  it('renders quantity field', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Količina/i)).toBeInTheDocument();
    });
  });

  it('renders All or None checkbox', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/All or None/i).length).toBeGreaterThan(0);
    });
  });

  it('renders Margin section', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Margin/i).length).toBeGreaterThan(0);
    });
  });

  it('shows limit value field when Limit order type is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'LIMIT');

    await waitFor(() => {
      expect(screen.getByLabelText(/Limit vrednost/i)).toBeInTheDocument();
    });
  });

  it('shows stop value field when Stop order type is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'STOP');

    await waitFor(() => {
      expect(screen.getByLabelText(/Stop vrednost/i)).toBeInTheDocument();
    });
  });

  it('shows both limit and stop fields for Stop-Limit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'STOP_LIMIT');

    await waitFor(() => {
      expect(screen.getByLabelText(/Limit vrednost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Stop vrednost/i)).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while data is loading', () => {
    mockGetAll.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<CreateOrderPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders the cost summary card', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText(/Procena troškova/i)).toBeInTheDocument();
    });
  });

  // ---------- AON checkbox behavior ----------

  it('renders AON checkbox and it is unchecked by default', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/All or None/i).length).toBeGreaterThan(0);
    });

    // AON checkbox should be unchecked by default
    const aonCheckbox = screen.getByRole('checkbox', { name: /All or None/i });
    expect(aonCheckbox).not.toBeChecked();
  });

  it('toggles AON checkbox on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /All or None/i })).toBeInTheDocument();
    });

    const aonCheckbox = screen.getByRole('checkbox', { name: /All or None/i });
    await user.click(aonCheckbox);
    expect(aonCheckbox).toBeChecked();
  });

  // ---------- Margin order flow ----------

  it('renders Margin checkbox and it is unchecked by default', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Margin/i).length).toBeGreaterThan(0);
    });

    const marginCheckbox = screen.getByRole('checkbox', { name: /Margin/i });
    expect(marginCheckbox).not.toBeChecked();
  });

  it('toggles Margin checkbox on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Margin/i })).toBeInTheDocument();
    });

    const marginCheckbox = screen.getByRole('checkbox', { name: /Margin/i });
    await user.click(marginCheckbox);
    expect(marginCheckbox).toBeChecked();
  });

  // ---------- Stop value field for STOP type ----------

  it('hides limit value field for STOP order type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'STOP');

    await waitFor(() => {
      expect(screen.getByLabelText(/Stop vrednost/i)).toBeInTheDocument();
    });

    // Limit field should NOT be visible
    expect(screen.queryByLabelText(/Limit vrednost/i)).not.toBeInTheDocument();
  });

  // ---------- Stop+Limit fields for STOP_LIMIT ----------

  it('shows validation errors when Stop-Limit fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'STOP_LIMIT');

    await waitFor(() => {
      expect(screen.getByLabelText(/Limit vrednost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Stop vrednost/i)).toBeInTheDocument();
    });

    // Submit form without filling limit/stop values
    const submitBtn = screen.getByRole('button', { name: /Nastavi na potvrdu/i });
    await user.click(submitBtn);

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ---------- After-hours warning display ----------

  it('shows exchange closed warning when exchange is not open', async () => {
    const exchangeMock = await import('../../services/exchangeManagementService');
    vi.mocked(exchangeMock.default.getByAcronym).mockResolvedValue({
      isOpen: false,
      name: 'NASDAQ',
    } as never);

    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText('Podaci naloga')).toBeInTheDocument();
    });

    // Wait for the exchange status check — "Berza zatvorena" should appear
    await waitFor(() => {
      expect(screen.getAllByText(/zatvorena/i).length).toBeGreaterThan(0);
    });
  });

  // ---------- Direction selection ----------

  it('switches between BUY and SELL directions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Prodaja').length).toBeGreaterThan(0);
    });

    // Click "Prodaja" radio
    const prodajaLabel = screen.getAllByText('Prodaja')[0].closest('label');
    if (prodajaLabel) {
      await user.click(prodajaLabel);
    }

    // Now "Prodaja" should be selected — the radio inside the label should be checked
    await waitFor(() => {
      const radioInputs = document.querySelectorAll('input[type="radio"]');
      const sellRadio = Array.from(radioInputs).find(r => (r as HTMLInputElement).value === 'SELL');
      expect((sellRadio as HTMLInputElement)?.checked).toBe(true);
    });
  });

  // ---------- Quantity validation ----------

  it('has quantity field with default value of 1', async () => {
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Količina/i)).toBeInTheDocument();
    });

    const qtyInput = screen.getByLabelText(/Količina/i) as HTMLInputElement;
    expect(qtyInput.value).toBe('1');
  });

  // ---------- Empty states ----------

  it('shows empty state when no accounts available', async () => {
    mockGetMyAccounts.mockResolvedValue([]);
    mockGetAllAccounts.mockResolvedValue({ content: [] });

    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nema dostupnih računa/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no listings available', async () => {
    mockGetAll.mockResolvedValue({ content: [], totalPages: 0, totalElements: 0, number: 0, size: 100 });

    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByText(/Nema dostupnih hartija/i)).toBeInTheDocument();
    });
  });

  // ---------- Limit field resets when switching types ----------

  it('clears limit field when switching from LIMIT back to MARKET', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tip ordera')).toBeInTheDocument();
    });

    // Switch to LIMIT
    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'LIMIT');

    await waitFor(() => {
      expect(screen.getByLabelText(/Limit vrednost/i)).toBeInTheDocument();
    });

    // Enter limit value
    const limitInput = screen.getByLabelText(/Limit vrednost/i);
    await user.type(limitInput, '200');

    // Switch back to MARKET
    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'MARKET');

    // Limit field should disappear
    await waitFor(() => {
      expect(screen.queryByLabelText(/Limit vrednost/i)).not.toBeInTheDocument();
    });
  });

  it('shows "Kupujem u ime" selector for supervisor with managed funds', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'EMPLOYEE' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: () => true,
      isAdmin: false,
      isSupervisor: true,
      isAgent: false,
    });
    mockFundList.mockResolvedValue([{ id: 10, name: 'Tech Fund' }]);
    mockFundGet.mockResolvedValue({
      id: 10,
      name: 'Tech Fund',
      managerEmployeeId: 1,
      liquidAmount: 150000,
      accountId: 1,
    });

    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Kupujem u ime/i)).toBeInTheDocument();
    });

    const selector = screen.getByLabelText(/Kupujem u ime/i) as HTMLSelectElement;
    const options = Array.from(selector.options).map((o) => o.textContent);
    expect(options).toContain('Banka');
    expect(options).toContain('Fond: Tech Fund');
  });

  it('includes fundId in create DTO when supervisor selects fund', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'EMPLOYEE' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: () => true,
      isAdmin: false,
      isSupervisor: true,
      isAgent: false,
    });
    mockFundList.mockResolvedValue([{ id: 10, name: 'Tech Fund' }]);
    mockFundGet.mockResolvedValue({
      id: 10,
      name: 'Tech Fund',
      managerEmployeeId: 1,
      liquidAmount: 150000,
      accountId: 1,
    });

    renderWithProviders(<CreateOrderPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Kupujem u ime/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/Kupujem u ime/i), 'FUND:10');
    await user.selectOptions(screen.getByLabelText('Tip ordera'), 'MARKET');
    await user.type(screen.getByLabelText(/Količina/i), '{selectall}2');
    await user.click(screen.getByRole('button', { name: /Nastavi na potvrdu/i }));
    await user.click(screen.getByRole('button', { name: /Potvrdi/i }));
    await user.click(screen.getByRole('button', { name: /Mock OTP Confirm/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fundId: 10,
        accountId: 1,
      })
    );
  });
});
