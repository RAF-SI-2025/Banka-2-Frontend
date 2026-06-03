import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarginAccountsPage from './MarginAccountsPage';
import type { MarginAccount, MarginTransaction } from '@/services/marginService';

// ---------- Mocks ----------

vi.mock('@/services/marginService', () => ({
  default: {
    getMyAccounts: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
    getTransactions: vi.fn(),
  },
  MARGIN_CURRENCY: 'RSD',
}));

import marginService from '@/services/marginService';
const mockMarginService = vi.mocked(marginService);

// P1-fe-contracts-1: BE MarginAccountDto shape (accountId/userId/companyId).
// R1-258: BE salje bankParticipation kao ODNOS 0..1 (0.50 = 50%), ne procenat.
const activeAccount: MarginAccount = {
  id: 1,
  accountId: 100,
  accountNumber: '265000000000000001',
  userId: 42,
  companyId: null,
  status: 'ACTIVE',
  initialMargin: 50000,
  loanValue: 200000,
  maintenanceMargin: 30000,
  bankParticipation: 0.25,
  createdAt: '2026-03-01T10:00:00',
};

const blockedAccount: MarginAccount = {
  id: 2,
  accountId: 101,
  accountNumber: '265000000000000002',
  userId: 43,
  companyId: null,
  status: 'BLOCKED',
  initialMargin: 10000,
  loanValue: 50000,
  maintenanceMargin: 8000,
  bankParticipation: 0.30,
  createdAt: '2026-03-02T10:00:00',
};

// R1-259: BE MarginTransactionDto.type moze biti BUY/SELL (ne samo DEPOSIT/
// WITHDRAWAL) i NEMA currency polje. SELL = priliv (+), BUY = odliv (−).
const transactions: MarginTransaction[] = [
  {
    id: 1,
    marginAccountId: 1,
    type: 'DEPOSIT',
    amount: 25000,
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 2,
    marginAccountId: 1,
    type: 'WITHDRAWAL',
    amount: 5000,
    createdAt: '2026-03-16T14:00:00Z',
  },
  {
    id: 3,
    marginAccountId: 1,
    type: 'BUY',
    amount: 12000,
    createdAt: '2026-03-17T09:00:00Z',
  },
  {
    id: 4,
    marginAccountId: 1,
    type: 'SELL',
    amount: 8000,
    createdAt: '2026-03-18T09:00:00Z',
  },
];

function renderPage() {
  return render(<MarginAccountsPage />);
}

describe('MarginAccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarginService.getMyAccounts.mockResolvedValue([activeAccount, blockedAccount]);
    mockMarginService.getTransactions.mockResolvedValue(transactions);
    mockMarginService.deposit.mockResolvedValue(undefined);
    mockMarginService.withdraw.mockResolvedValue(undefined);
  });

  it('shows loading skeleton initially', () => {
    mockMarginService.getMyAccounts.mockImplementation(() => new Promise(() => {}));
    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Marzni racuni')).toBeInTheDocument();
    });
    expect(screen.getByText(/Pregled i upravljanje vasim marznim racunima/)).toBeInTheDocument();
  });

  it('renders account cards after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });
    expect(screen.getByText('265000000000000002')).toBeInTheDocument();
  });

  it('shows account numbers and account-type labels', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });
    expect(screen.getByText('265000000000000002')).toBeInTheDocument();
    // companyId == null → licni marzni racun (oba racuna)
    expect(screen.getAllByText(/Licni marzni racun/).length).toBe(2);
  });

  it('shows AKTIVAN badge for active account', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AKTIVAN')).toBeInTheDocument();
    });
  });

  it('shows BLOKIRAN badge and warning for blocked account', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BLOKIRAN')).toBeInTheDocument();
    });
    expect(screen.getByText(/Racun je blokiran/)).toBeInTheDocument();
  });

  it('renders margin stats (initial margin, loan value, maintenance, bank participation)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Inicijalna margina/).length).toBe(2);
    });
    expect(screen.getAllByText(/Vrednost kredita/).length).toBe(2);
    expect(screen.getAllByText(/Margina odrzavanja/).length).toBe(2);
    expect(screen.getAllByText(/Ucesce banke/).length).toBe(2);
  });

  it('shows empty state when no accounts', async () => {
    mockMarginService.getMyAccounts.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nemate otvorenih marznih racuna')).toBeInTheDocument();
    });
  });

  it('shows error alert on load failure', async () => {
    mockMarginService.getMyAccounts.mockRejectedValue(new Error('Server error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Greska pri ucitavanju')).toBeInTheDocument();
    });
  });

  it('handles 404 gracefully as empty state', async () => {
    const error404 = { response: { status: 404 } };
    mockMarginService.getMyAccounts.mockRejectedValue(error404);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nemate otvorenih marznih racuna')).toBeInTheDocument();
    });
  });

  it('disables withdraw button for blocked account', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000002')).toBeInTheDocument();
    });

    const withdrawButtons = screen.getAllByRole('button', { name: /Isplati/i });
    // The blocked account's withdraw button should be disabled
    // blockedAccount is the second card, so its withdraw is the second one
    expect(withdrawButtons[1]).toBeDisabled();
  });

  it('expands transaction history on click', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    const historyButtons = screen.getAllByText('Istorija transakcija');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Uplata')).toBeInTheDocument();
      expect(screen.getByText('Isplata')).toBeInTheDocument();
    });
  });

  // R1-258: bankParticipation 0.25 (odnos) → mora se prikazati kao 25%, ne 0.25%.
  it('renders bankParticipation ratio as a percentage (×100)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    // 0.25 → "25", 0.30 → "30" (a NE "0,25"/"0,30") — broj i "%" su zasebni cvorovi.
    const participationCells = screen.getAllByText((_content, el) => {
      const txt = el?.textContent?.replace(/\s/g, '') ?? '';
      return el?.classList.contains('font-mono') === true && /^\d+(,\d+)?%$/.test(txt);
    });
    const texts = participationCells.map((el) => el.textContent?.replace(/\s/g, ''));
    expect(texts).toContain('25%');
    expect(texts).toContain('30%');
    expect(texts).not.toContain('0,25%');
    expect(texts).not.toContain('0,30%');
  });

  // R1-259: BUY/SELL transakcije se prikazuju sa pravim labelama i predznakom,
  // ne kao "Isplata" sa minusom.
  it('renders BUY/SELL margin transactions with correct labels and signs', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    const historyButtons = screen.getAllByText('Istorija transakcija');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Kupovina')).toBeInTheDocument();
    });
    // BUY = odliv (−, crveno), SELL = priliv (+, zeleno)
    expect(screen.getByText('Prodaja')).toBeInTheDocument();

    // Iznosi se renderuju u <span class="font-mono ..."> sa zasebnim tekst-cvorovima
    // za predznak/iznos/valutu — citamo concat textContent svakog amount span-a.
    const amountSpans = Array.from(
      document.querySelectorAll('span.font-mono.font-semibold'),
    ) as HTMLElement[];
    const buyAmount = amountSpans.find((el) =>
      (el.textContent?.replace(/\s/g, '') ?? '').includes('-12.000,00RSD'),
    );
    const sellAmount = amountSpans.find((el) =>
      (el.textContent?.replace(/\s/g, '') ?? '').includes('+8.000,00RSD'),
    );
    expect(buyAmount).toBeTruthy();
    expect(buyAmount).toHaveClass('text-red-600');
    expect(sellAmount).toBeTruthy();
    expect(sellAmount).toHaveClass('text-emerald-600');
  });

  it('shows empty transaction message when no transactions', async () => {
    mockMarginService.getTransactions.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    const historyButtons = screen.getAllByText('Istorija transakcija');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Nema transakcija za prikaz.')).toBeInTheDocument();
    });
  });

  it('opens deposit modal on Uplati button click', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    const depositButtons = screen.getAllByRole('button', { name: /Uplati/i });
    await user.click(depositButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Uplata na marzni racun')).toBeInTheDocument();
    });
  });

  it('opens withdraw modal on Isplati button click', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    const withdrawButtons = screen.getAllByRole('button', { name: /Isplati/i });
    await user.click(withdrawButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Isplata sa marznog racuna')).toBeInTheDocument();
    });
  });

  it('submits deposit via marginService.deposit', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265000000000000001')).toBeInTheDocument();
    });

    const depositButtons = screen.getAllByRole('button', { name: /Uplati/i });
    await user.click(depositButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Uplata na marzni racun')).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.type(amountInput, '10000');

    // Click the submit button inside the modal (not the "Uplati" in card)
    const submitBtn = screen.getByRole('button', { name: /^Uplati$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockMarginService.deposit).toHaveBeenCalledWith(1, 10000);
    });
  });
});
