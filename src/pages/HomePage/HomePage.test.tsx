import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage from './HomePage';
import {
  mockAccount,
  mockAccountEUR,
  mockTransaction,
  mockExchangeRate,
  mockRecipient,
  paginatedResponse,
} from '@/test/helpers';

// ---------- Mocks ----------

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/services/currencyService', () => ({
  currencyService: {
    getExchangeRates: vi.fn(),
  },
}));

vi.mock('@/services/employeeService', () => ({
  employeeService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/services/creditService', () => ({
  creditService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/services/paymentRecipientService', () => ({
  paymentRecipientService: {
    getAll: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  email: 'marko.petrovic@banka.rs',
  username: 'marko.petrovic',
  firstName: 'Marko',
  lastName: 'Petrovic',
  role: 'CLIENT',
};

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isAdmin: false,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasPermission: vi.fn(() => false),
  })),
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import { currencyService } from '@/services/currencyService';
import { paymentRecipientService } from '@/services/paymentRecipientService';

const mockAccountService = vi.mocked(accountService);
const mockTransactionService = vi.mocked(transactionService);
const mockCurrencyService = vi.mocked(currencyService);
const mockRecipientService = vi.mocked(paymentRecipientService);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <HomePage />
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getMyAccounts.mockResolvedValue([
      mockAccount(),
      mockAccountEUR(),
    ]);
    mockTransactionService.getAll.mockResolvedValue(
      paginatedResponse([
        mockTransaction(),
        mockTransaction({ id: 2, amount: 25000, recipientName: 'Telenor' }),
      ])
    );
    mockCurrencyService.getExchangeRates.mockResolvedValue([
      mockExchangeRate({ currency: 'EUR', middleRate: 117.5 }),
      mockExchangeRate({ currency: 'USD', middleRate: 108.2 }),
    ]);
    mockRecipientService.getAll.mockResolvedValue([
      mockRecipient({ id: 1, name: 'EPS Srbija', accountNumber: '265000000000000099' }),
      mockRecipient({ id: 2, name: 'Telenor', accountNumber: '265000000000000088' }),
    ]);
  });

  it('renders greeting with user name', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Marko/i)).toBeInTheDocument();
    });
  });

  it('renders account cards after loading', async () => {
    renderPage();

    await waitFor(() => {
      // Account names may appear in multiple places (cards, quick actions, etc.)
      expect(screen.getAllByText(/Tekuci racun/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Devizni racun/i).length).toBeGreaterThan(0);
  });

  it('renders recent transactions section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/EPS Srbija/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Telenor/i).length).toBeGreaterThan(0);
  });

  it('renders exchange rates section', async () => {
    renderPage();

    await waitFor(() => {
      // EUR/USD may appear multiple times (rate cards, account currency badges, etc.)
      expect(screen.getAllByText(/EUR/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/USD/i).length).toBeGreaterThan(0);
  });

  it('shows skeleton loading state initially', () => {
    mockAccountService.getMyAccounts.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    mockTransactionService.getAll.mockImplementation(
      () => new Promise(() => {})
    );
    mockCurrencyService.getExchangeRates.mockImplementation(
      () => new Promise(() => {})
    );

    renderPage();

    // Skeleton elements have animate-pulse
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('fetches accounts, transactions and exchange rates on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockAccountService.getMyAccounts).toHaveBeenCalledTimes(1);
    });
    expect(mockTransactionService.getAll).toHaveBeenCalledTimes(1);
    expect(mockCurrencyService.getExchangeRates).toHaveBeenCalledTimes(1);
  });

  it('handles empty accounts gracefully', async () => {
    mockAccountService.getMyAccounts.mockResolvedValue([]);
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));

    renderPage();

    await waitFor(() => {
      expect(mockAccountService.getMyAccounts).toHaveBeenCalled();
    });

    // Should still render the page without errors
    expect(screen.getByText(/Marko/i)).toBeInTheDocument();
  });

  // ---------- Quick payment recipients section ----------

  it('renders saved recipients in "Brzo placanje" section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Brzo placanje/i)).toBeInTheDocument();
    });

    // Should show saved recipients
    expect(screen.getAllByText(/EPS Srbija/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Telenor/i).length).toBeGreaterThan(0);
  });

  it('shows recipient initials in avatar circles', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Brzo placanje/i)).toBeInTheDocument();
    });

    // EPS Srbija => initials "ES"
    expect(screen.getByText('ES')).toBeInTheDocument();
  });

  it('shows "Dodaj" button for adding new recipient', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Brzo placanje/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Dodaj/i)).toBeInTheDocument();
  });

  it('shows "Svi primaoci" link', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Brzo placanje/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Svi primaoci/i)).toBeInTheDocument();
  });

  // ---------- Empty recipients ----------

  it('does not show "Brzo placanje" section when no recipients', async () => {
    mockRecipientService.getAll.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(mockRecipientService.getAll).toHaveBeenCalled();
    });

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText(/Marko/i)).toBeInTheDocument();
    });

    // "Brzo placanje" section should not appear when recipients are empty
    expect(screen.queryByText(/Brzo placanje/i)).not.toBeInTheDocument();
  });

  // ---------- Error states ----------

  it('handles transaction fetch error gracefully', async () => {
    mockTransactionService.getAll.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Marko/i)).toBeInTheDocument();
    });

    // Page should still render; transactions section should show empty state
    await waitFor(() => {
      expect(screen.getByText(/Nema nedavnih transakcija/i)).toBeInTheDocument();
    });
  });

  it('handles exchange rate fetch error gracefully', async () => {
    mockCurrencyService.getExchangeRates.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Marko/i)).toBeInTheDocument();
    });

    // Page should still render without crash
    expect(screen.getByText(/Marko/i)).toBeInTheDocument();
  });

  it('handles all API failures simultaneously', async () => {
    mockAccountService.getMyAccounts.mockRejectedValue(new Error('Fail'));
    mockTransactionService.getAll.mockRejectedValue(new Error('Fail'));
    mockCurrencyService.getExchangeRates.mockRejectedValue(new Error('Fail'));
    mockRecipientService.getAll.mockRejectedValue(new Error('Fail'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Marko/i)).toBeInTheDocument();
    });

    // Should not crash
    expect(screen.getByText(/Marko/i)).toBeInTheDocument();
  });

  // ---------- Transaction display ----------

  it('shows empty transaction state with proper messaging', async () => {
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nema nedavnih transakcija/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Vase transakcije ce se prikazati ovde/i)).toBeInTheDocument();
  });

  it('shows transaction amounts and statuses', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/EPS Srbija/i).length).toBeGreaterThan(0);
    });

    // Status badges should be present
    const badges = screen.getAllByText(/Zavrsena|Na cekanju/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  // ---------- Account section ----------

  it('shows "Nemate otvorenih racuna" when accounts empty', async () => {
    mockAccountService.getMyAccounts.mockResolvedValue([]);
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));
    mockRecipientService.getAll.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nemate otvorenih racuna/i)).toBeInTheDocument();
    });
  });

  // ---------- Quick actions ----------

  it('renders quick action buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Brze akcije/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Novo placanje/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Transfer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Menjacnica/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kartice/i).length).toBeGreaterThan(0);
  });

  // ---------- Fabricated data removed (R3-1559 / R4-1758) ----------
  // HomePage je ranije renderovao Math.random() "Istoriju stanja" + sparkline
  // krive kao stvarne podatke (krsi "ne lazni podaci"). Te lazne vizuelizacije
  // su uklonjene — proveravamo da se vise NE prikazuju.

  it('does NOT render the fabricated balance history chart', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Moji racuni/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Istorija stanja/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kretanje ukupnog stanja/i)).not.toBeInTheDocument();
  });

  it('does NOT render fabricated chart period buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Moji racuni/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('1N')).not.toBeInTheDocument();
    expect(screen.queryByText('3M')).not.toBeInTheDocument();
    expect(screen.queryByText('1G')).not.toBeInTheDocument();
  });

  // ---------- Exchange rates section ----------

  it('shows exchange rate section with currency data', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Kursna lista/i)).toBeInTheDocument();
    });
  });

  // ---------- Fetches recipients ----------

  it('fetches payment recipients on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockRecipientService.getAll).toHaveBeenCalledTimes(1);
    });
  });
});
