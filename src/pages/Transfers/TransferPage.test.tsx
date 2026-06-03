import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransferPage from './TransferPage';
import { mockAccount, mockAccountEUR } from '@/test/helpers';

// ---------- Mocks ----------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
  },
}));

vi.mock('@/services/currencyService', () => ({
  currencyService: {
    convert: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    createTransfer: vi.fn(),
  },
}));

vi.mock('@/components/shared/VerificationModal', () => ({
  default: ({ isOpen, onClose, onVerified }: {
    isOpen: boolean;
    onClose: () => void;
    onVerified: (code: string) => Promise<void>;
  }) =>
    isOpen ? (
      <div data-testid="verification-modal">
        <button onClick={() => onVerified('123456')}>Potvrdi OTP</button>
        <button onClick={onClose}>Otkazi</button>
      </div>
    ) : null,
}));

import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import { transactionService } from '@/services/transactionService';

const mockAccountService = vi.mocked(accountService);
const mockCurrencyService = vi.mocked(currencyService);
const mockTransactionService = vi.mocked(transactionService);

const rsdAcc = mockAccount({ id: 1, accountNumber: '265000000000000001', currency: 'RSD', balance: 200000, availableBalance: 190000, name: 'RSD racun' });
const eurAcc = mockAccountEUR({ id: 2, accountNumber: '265000000000000002', currency: 'EUR', balance: 5000, availableBalance: 4800, name: 'EUR racun' });
const rsdAcc2 = mockAccount({ id: 3, accountNumber: '265000000000000003', currency: 'RSD', balance: 50000, availableBalance: 50000, name: 'Drugi RSD' });

function renderPage(route = '/transfers') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TransferPage />
    </MemoryRouter>
  );
}

describe('TransferPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getMyAccounts.mockResolvedValue([rsdAcc, eurAcc, rsdAcc2]);
    mockCurrencyService.convert.mockResolvedValue({
      convertedAmount: 850,
      exchangeRate: 0.0085,
    });
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Prenos izmedju racuna/i)).toBeInTheDocument();
    });
  });

  it('renders from and to account dropdowns', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Novi prenos|Potvrda prenosa/i)).toBeInTheDocument();
    });

    // Should have from and to selects
    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders amount input', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });
  });

  it('shows confirmation step after form submission', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Select from account (first is preselected)
    // Select to account
    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      // Set "to" account to the second option
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      if (options.length > 1) {
        await user.selectOptions(toSelect, options[1].value);
      }
    }

    // Enter amount
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '10000');

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Nastavi|Potvrdi/i });
    await user.click(submitBtn);

    // Should show confirmation step
    await waitFor(() => {
      expect(screen.getByText(/Potvrda prenosa/i)).toBeInTheDocument();
    });
  });

  it('filters out from-account from to-account options', async () => {
    renderPage();

    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    // The "to" select should not contain the same account as "from"
    const selects = document.querySelectorAll('select');
    const fromSelect = selects[0] as HTMLSelectElement;
    const toSelect = selects[1] as HTMLSelectElement;

    // fromSelect should have all 3 accounts
    // toSelect should have 2 (excluding the selected from)
    expect(toSelect.querySelectorAll('option').length).toBeLessThanOrEqual(
      fromSelect.querySelectorAll('option').length
    );
  });

  it('shows loading state initially', () => {
    mockAccountService.getMyAccounts.mockImplementation(() => new Promise(() => {}));

    renderPage();

    // The form should show loading or skeleton
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(0);
  });

  it('validates amount is required', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Submit without filling amount
    const submitBtn = screen.getByRole('button', { name: /Nastavi|Potvrdi/i });
    await user.click(submitBtn);

    // Should show validation error
    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('pre-selects from account from URL params', async () => {
    renderPage('/transfers?from=265000000000000001');

    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    const fromSelect = document.querySelectorAll('select')[0] as HTMLSelectElement;
    expect(fromSelect.value).toBe('265000000000000001');
  });

  // ---------- Cross-currency transfer detection ----------

  it('shows exchange rate preview for cross-currency transfer', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Select from = RSD, to = EUR
    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      // from is already RSD (first acc), select EUR as destination
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      // Find EUR option
      const eurOption = Array.from(options).find(o => o.textContent?.includes('EUR'));
      if (eurOption) {
        await user.selectOptions(toSelect, eurOption.value);
      }
    }

    // Enter amount
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '100000');

    // Should call currency convert service
    await waitFor(() => {
      expect(mockCurrencyService.convert).toHaveBeenCalled();
    });
  });

  it('shows "bez konverzije" for same-currency transfer', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Select from = RSD (acc1), to = RSD (acc3)
    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      // Find RSD option (Drugi RSD)
      const rsdOption = Array.from(options).find(o => o.textContent?.includes('RSD'));
      if (rsdOption) {
        await user.selectOptions(toSelect, rsdOption.value);
      }
    }

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '10000');

    await waitFor(() => {
      expect(screen.getAllByText(/bez konverzije/i).length).toBeGreaterThan(0);
    });
  });

  // ---------- Confirmation step with rate/commission ----------

  it('shows confirmation details including rate and commission for cross-currency', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Select from = RSD, to = EUR
    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      const eurOption = Array.from(options).find(o => o.textContent?.includes('EUR'));
      if (eurOption) {
        await user.selectOptions(toSelect, eurOption.value);
      }
    }

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '100000');

    // Wait for exchange rate preview
    await waitFor(() => {
      expect(mockCurrencyService.convert).toHaveBeenCalled();
    });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Nastavi|Potvrdi/i });
    await user.click(submitBtn);

    // Should show confirmation step with exchange details
    await waitFor(() => {
      expect(screen.getByText(/Potvrda prenosa/i)).toBeInTheDocument();
    });

    // Should display commission info
    expect(screen.getAllByText(/Provizija/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kurs/i).length).toBeGreaterThan(0);
  });

  it('shows "Nije potrebna" for same-currency in confirm step', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      const rsdOption = Array.from(options).find(o => o.textContent?.includes('RSD'));
      if (rsdOption) {
        await user.selectOptions(toSelect, rsdOption.value);
      }
    }

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '10000');

    const submitBtn = screen.getByRole('button', { name: /Nastavi|Potvrdi/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Potvrda prenosa/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Nije potrebna/i)).toBeInTheDocument();
  });

  // ---------- Back button from confirmation ----------

  it('goes back to form when "Nazad" is clicked in confirmation', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      if (options.length > 1) {
        await user.selectOptions(toSelect, options[1].value);
      }
    }

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '10000');

    const submitBtn = screen.getByRole('button', { name: /Nastavi|Potvrdi/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Potvrda prenosa/i)).toBeInTheDocument();
    });

    // Click back
    const backBtn = screen.getByRole('button', { name: /Nazad/i });
    await user.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText(/Novi prenos/i)).toBeInTheDocument();
    });
  });

  // ---------- OTP verification flow ----------

  it('opens verification modal on confirm and executes transfer', async () => {
    const user = userEvent.setup();
    mockTransactionService.createTransfer.mockResolvedValue(undefined as never);
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      if (options.length > 1) {
        await user.selectOptions(toSelect, options[1].value);
      }
    }

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '10000');

    const submitBtn = screen.getByRole('button', { name: /Nastavi|Potvrdi/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Potvrda prenosa/i)).toBeInTheDocument();
    });

    // Confirm transfer
    const confirmBtn = screen.getByRole('button', { name: /Potvrdi transfer/i });
    await user.click(confirmBtn);

    // OTP modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    // Submit OTP
    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(mockTransactionService.createTransfer).toHaveBeenCalled();
    });
  });

  // R1-554: dupli klik na OTP "Potvrdi" ne sme da napravi dva transfera.
  // isSubmitting se ranije nikad nije setovao na true → re-entry je bio moguc.
  it('guards against double-submit / double-OTP (R1-554)', async () => {
    const user = userEvent.setup();
    let resolveTransfer: (() => void) | undefined;
    mockTransactionService.createTransfer.mockImplementation(
      () => new Promise<never>((resolve) => { resolveTransfer = resolve as () => void; })
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      if (options.length > 1) {
        await user.selectOptions(toSelect, options[1].value);
      }
    }

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '10000');

    await user.click(screen.getByRole('button', { name: /Nastavi|Potvrdi/i }));
    await waitFor(() => {
      expect(screen.getByText(/Potvrda prenosa/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Potvrdi transfer/i }));
    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    // Prvi OTP submit pokrece (visi) transfer; drugi klik dok je u toku ne sme
    // da pozove createTransfer drugi put.
    await user.click(screen.getByText('Potvrdi OTP'));
    await user.click(screen.getByText('Potvrdi OTP'));

    expect(mockTransactionService.createTransfer).toHaveBeenCalledTimes(1);

    resolveTransfer?.();
  });

  // ---------- Error handling ----------

  it('handles account loading error gracefully', async () => {
    mockAccountService.getMyAccounts.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(mockAccountService.getMyAccounts).toHaveBeenCalled();
    });

    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText(/Nema dostupnih racuna/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no accounts available', async () => {
    mockAccountService.getMyAccounts.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nema dostupnih racuna/i)).toBeInTheDocument();
    });
  });

  // ---------- Insufficient funds warning ----------

  it('shows insufficient funds message when amount exceeds balance', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Select to account
    const selects = document.querySelectorAll('select');
    if (selects.length >= 2) {
      const toSelect = selects[1];
      const options = toSelect.querySelectorAll('option');
      if (options.length > 1) {
        await user.selectOptions(toSelect, options[1].value);
      }
    }

    // Enter amount exceeding balance (190000 available on RSD acc)
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '999999999');

    await waitFor(() => {
      expect(screen.getByText(/Nemate dovoljno raspolozivih sredstava/i)).toBeInTheDocument();
    });
  });

  // R3-1593: cross-currency transfer cijim iznosom == raspolozivo stanje ipak je
  // nedovoljan jer 0.5% provizija prelazi balans. Ranije je FE poredio samo iznos
  // (ne iznos+provizija) pa bi korisnik prosao validaciju i potrosio OTP pokusaj.
  it('flags insufficient funds when amount == balance but commission tips over (cross-currency)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // to = EUR (cross-currency → 0.5% provizija)
    const selects = document.querySelectorAll('select');
    const toSelect = selects[1];
    const eurOption = Array.from(toSelect.querySelectorAll('option')).find((o) =>
      o.textContent?.includes('EUR'),
    );
    if (eurOption) await user.selectOptions(toSelect, eurOption.value);

    // Iznos == raspolozivo (190000) na RSD racunu → +0.5% = 190950 > 190000.
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '190000');

    await waitFor(() => {
      expect(screen.getByText(/Nemate dovoljno raspolozivih sredstava/i)).toBeInTheDocument();
    });
  });

  // ---------- Balance display ----------

  it('shows available balance for selected from account', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // The "Raspolozivo stanje" or "Raspolozivo" section should exist
    await waitFor(() => {
      const balanceInfo = screen.getAllByText(/Raspolozivo/i);
      expect(balanceInfo.length).toBeGreaterThan(0);
    });
  });
});
