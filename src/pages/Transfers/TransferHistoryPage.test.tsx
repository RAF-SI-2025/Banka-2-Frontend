import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransferHistoryPage from './TransferHistoryPage';
import { mockAccount } from '@/test/helpers';
import type { Transfer } from '@/types/celina2';

// ---------- Mocks ----------

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getTransfers: vi.fn(),
  },
}));

import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';

const mockAccountService = vi.mocked(accountService);
const mockTransactionService = vi.mocked(transactionService);

const accounts = [
  mockAccount({ id: 1, accountNumber: '265000000000000001' }),
  mockAccount({ id: 2, accountNumber: '265000000000000002', currency: 'EUR' }),
];

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 1,
    fromAccountNumber: '265000000000000001',
    toAccountNumber: '265000000000000002',
    amount: 10000,
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    status: 'COMPLETED',
    createdAt: '2026-03-15T10:30:00Z',
    ...overrides,
  } as Transfer;
}

const transfers: Transfer[] = [
  makeTransfer({ id: 1, amount: 10000, fromCurrency: 'RSD', toCurrency: 'RSD', status: 'COMPLETED', createdAt: '2026-03-15T10:30:00Z' }),
  makeTransfer({ id: 2, amount: 500, fromCurrency: 'EUR', toCurrency: 'RSD', convertedAmount: 58750, exchangeRate: 117.5, commission: 25, status: 'PENDING', createdAt: '2026-03-16T14:00:00Z' }),
  makeTransfer({ id: 3, amount: 25000, fromCurrency: 'RSD', toCurrency: 'RSD', status: 'REJECTED', createdAt: '2026-03-14T08:00:00Z' }),
];

function renderPage() {
  return render(
    <MemoryRouter>
      <TransferHistoryPage />
    </MemoryRouter>
  );
}

describe('TransferHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getMyAccounts.mockResolvedValue(accounts as never);
    mockTransactionService.getTransfers.mockResolvedValue(transfers as never);
  });

  it('shows loading skeleton initially', () => {
    mockTransactionService.getTransfers.mockImplementation(() => new Promise(() => {}));
    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Istorija transfera')).toBeInTheDocument();
    });
    expect(screen.getByText(/Pregledajte sve prenose/)).toBeInTheDocument();
  });

  it('renders transfer list after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
  });

  it('renders cross-currency transfer with converted amount', async () => {
    renderPage();

    // Iznosi su formatirani kroz `formatAmount` (sr-RS: "500,00", ne "500.00")
    await waitFor(() => {
      expect(screen.getByText(/500,00 EUR/)).toBeInTheDocument();
    });
    // Converted amount prikazan pored originalnog iznosa
    expect(screen.getByText(/58\.750,00 RSD/)).toBeInTheDocument();
  });

  it('renders exchange rate for cross-currency transfer', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('117,5000')).toBeInTheDocument();
    });
  });

  it('renders commission for cross-currency transfer', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('25,00')).toBeInTheDocument();
    });
  });

  it('shows empty state when no transfers', async () => {
    mockTransactionService.getTransfers.mockResolvedValue([] as never);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nema transfera')).toBeInTheDocument();
    });
    expect(screen.getByText(/Nema transfera za izabrane filtere/)).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Racun')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Datum od')).toBeInTheDocument();
    expect(screen.getByLabelText('Datum do')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resetuj filtere/i })).toBeInTheDocument();
  });

  it('populates account filter with user accounts', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Svi racuni')).toBeInTheDocument();
    });
    // Account numbers appear in both filter dropdown and transfer table rows
    expect(screen.getAllByText('265000000000000001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('265000000000000002').length).toBeGreaterThanOrEqual(1);
  });

  it('resets filters on button click', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resetuj filtere/i })).toBeInTheDocument();
    });

    // Set a date filter
    const dateFrom = screen.getByLabelText('Datum od');
    await user.type(dateFrom, '2026-01-01');

    // Click reset
    await user.click(screen.getByRole('button', { name: /Resetuj filtere/i }));

    expect((dateFrom as HTMLInputElement).value).toBe('');
  });

  it('renders pagination controls', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Strana 1/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Prethodna/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sledeca/i })).toBeInTheDocument();
  });

  it('disables previous button on first page', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Prethodna/i })).toBeDisabled();
    });
  });

  it('shows row numbers starting from 1', async () => {
    renderPage();

    await waitFor(() => {
      // Row numbers in the table - transfers are sorted by date descending
      // so the order is: id=2 (Mar 16), id=1 (Mar 15), id=3 (Mar 14)
      const cells = screen.getAllByRole('cell');
      const firstRowNumber = cells.find(c => c.textContent === '1');
      expect(firstRowNumber).toBeTruthy();
    });
  });
});
