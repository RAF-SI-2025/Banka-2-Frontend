import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewPaymentPage from './NewPaymentPage';
import { mockAccount, mockAccountEUR, mockRecipient } from '@/test/helpers';

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

vi.mock('@/services/paymentRecipientService', () => ({
  paymentRecipientService: {
    getAll: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    createPayment: vi.fn(),
  },
}));

vi.mock('@/services/interbankPaymentService', () => ({
  default: {
    initiatePayment: vi.fn(),
    getStatus: vi.fn(),
    myHistory: vi.fn(),
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
        {/* Pravi VerificationModal hvata onVerified reject u svom onSubmit-u
            (prikaze gresku, dozvoli retry). Mock isto swallow-uje rejection da
            ne procuri unhandled-rejection u testovima koji simuliraju BE gresku. */}
        <button onClick={() => { void onVerified('123456').catch(() => {}); }}>Potvrdi OTP</button>
        <button onClick={onClose}>Otkazi</button>
      </div>
    ) : null,
}));

// toast je mock-ovan da bismo deterministicki proverili "Nastavljam pracenje..."
// poruku pri rehydrate-u inter-bank transakcije iz prethodne sesije.
vi.mock('@/lib/notify', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

import { accountService } from '@/services/accountService';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import { transactionService } from '@/services/transactionService';
import interbankPaymentService from '@/services/interbankPaymentService';
import { toast } from '@/lib/notify';

const mockAccountService = vi.mocked(accountService);
const mockRecipientService = vi.mocked(paymentRecipientService);
const mockTransactionService = vi.mocked(transactionService);
const mockInterbankPaymentService = vi.mocked(interbankPaymentService);

const acc1 = mockAccount({ id: 1, accountNumber: '265000000000000001', balance: 150000, availableBalance: 140000 });
const acc2 = mockAccountEUR({ id: 2, accountNumber: '265000000000000002' });
const recipient1 = mockRecipient({ id: 1, name: 'EPS Srbija', accountNumber: '265000000000000099' });

function renderPage(route = '/payments/new') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <NewPaymentPage />
    </MemoryRouter>
  );
}

/**
 * Spec Sc 12 (Bug T2-005 12.05.2026): Submit forme otvara confirm dialog;
 * "Potvrdi i nastavi" iz dialog-a otvara OTP modal. Pre fix-a klik na
 * "Nastavi na verifikaciju" je direktno otvarao OTP. Helper kombinuje oba
 * koraka da bismo zadrzali tedious test setup.
 */
async function submitAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));
  await waitFor(() => {
    expect(screen.getByTestId('payment-confirm-dialog')).toBeInTheDocument();
  });
  await user.click(screen.getByTestId('payment-confirm-submit'));
}

describe('NewPaymentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Cisti aktivni inter-bank txId iz sessionStorage izmedju testova —
    // recovery useEffect na mount-u inace re-trigger-uje getStatus poziv
    // sa stale txId-em iz prethodnog testa.
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
    mockAccountService.getMyAccounts.mockResolvedValue([acc1, acc2]);
    mockRecipientService.getAll.mockResolvedValue([recipient1]);
    mockInterbankPaymentService.initiatePayment.mockResolvedValue({
      id: 11,
      transactionId: 'tx-11',
      status: 'INITIATED',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '111000000000000001',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
    });
    mockInterbankPaymentService.getStatus.mockResolvedValue({
      id: 11,
      transactionId: 'tx-11',
      status: 'COMMITTED',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '111000000000000001',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
    });
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Novi platni nalog/i)).toBeInTheDocument();
    });
  });

  it('renders all form fields after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Izaberite racun/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Racun primaoca/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Naziv primaoca/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sifra placanja/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Svrha placanja/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Poziv na broj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Referentni broj/i)).toBeInTheDocument();
  });

  it('has payment code default value of 289', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Sifra placanja/i)).toBeInTheDocument();
    });

    const paymentCodeInput = screen.getByLabelText(/Sifra placanja/i) as HTMLInputElement;
    expect(paymentCodeInput.value).toBe('289');
  });

  it('shows loading skeleton initially', () => {
    mockAccountService.getMyAccounts.mockImplementation(() => new Promise(() => {}));

    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('populates sender account dropdown', async () => {
    renderPage();

    await waitFor(() => {
      const select = screen.getByLabelText(/Izaberite racun/i) as HTMLSelectElement;
      // Should have 3 options: empty + 2 accounts
      expect(select.options.length).toBe(3);
    });
  });

  it('populates saved recipients dropdown', async () => {
    renderPage();

    await waitFor(() => {
      const select = screen.getByLabelText(/Sacuvani primalac/i) as HTMLSelectElement;
      // "Bez sablona" + EPS Srbija
      expect(select.options.length).toBe(2);
    });
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Negativan test — submit prazne forme: zod validacija mora pasti,
    // confirm dialog NE sme da se prikaze.
    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId('payment-confirm-dialog')).not.toBeInTheDocument();
  });

  it('opens verification modal on valid submission', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Fill mandatory fields
    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '222000000000000099');

    const recipientNameInput = screen.getByLabelText(/Naziv primaoca/i);
    await user.type(recipientNameInput, 'Test Primalac');

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');

    const purposeInput = screen.getByLabelText(/Svrha placanja/i);
    await user.type(purposeInput, 'Test placanje');

    // Submit
    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });
  });

  it('renders live preview card', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pregled naloga/i)).toBeInTheDocument();
    });
  });

  it('pre-selects account from URL search params', async () => {
    renderPage('/payments/new?from=265000000000000001');

    await waitFor(() => {
      const select = screen.getByLabelText(/Izaberite racun/i) as HTMLSelectElement;
      expect(select.value).toBe('265000000000000001');
    });
  });

  // ---------- Payment code field ----------

  // R1-325: sifra placanja je sada dropdown validnih PaymentCode vrednosti (default 289),
  // ne free-text — korisnik vise ne moze ukucati nevazecu sifru koju BE odbija.
  it('allows changing payment code via dropdown (R1-325)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Sifra placanja/i)).toBeInTheDocument();
    });

    const paymentCodeSelect = screen.getByLabelText(/Sifra placanja/i) as HTMLSelectElement;
    expect(paymentCodeSelect.tagName).toBe('SELECT');
    expect(paymentCodeSelect.value).toBe('289'); // default
    await user.selectOptions(paymentCodeSelect, '220');
    expect(paymentCodeSelect.value).toBe('220');
  });

  // ---------- Recipient from saved list ----------

  it('fills recipient fields when selecting saved recipient', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      const select = screen.getByLabelText(/Sacuvani primalac/i) as HTMLSelectElement;
      expect(select.options.length).toBe(2);
    });

    // Select saved recipient
    const recipientSelect = screen.getByLabelText(/Sacuvani primalac/i);
    await user.selectOptions(recipientSelect, '265000000000000099');

    // Recipient account number should be filled
    await waitFor(() => {
      const toInput = screen.getByLabelText(/Racun primaoca/i) as HTMLInputElement;
      expect(toInput.value).toBe('265000000000000099');
    });
  });

  it('auto-fills recipient name from saved recipients list', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Sacuvani primalac/i)).toBeInTheDocument();
    });

    const recipientSelect = screen.getByLabelText(/Sacuvani primalac/i);
    await user.selectOptions(recipientSelect, '265000000000000099');

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/Naziv primaoca/i) as HTMLInputElement;
      expect(nameInput.value).toBe('EPS Srbija');
    });
  });

  // ---------- Currency display ----------

  it('shows currency of selected from account', async () => {
    renderPage();

    await waitFor(() => {
      // Should display currency badge/info
      expect(screen.getAllByText(/RSD/i).length).toBeGreaterThan(0);
    });
  });

  it('updates currency when changing sender account', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Izaberite racun/i)).toBeInTheDocument();
    });

    // Switch to EUR account
    const select = screen.getByLabelText(/Izaberite racun/i);
    await user.selectOptions(select, '265000000000000002');

    await waitFor(() => {
      expect(screen.getAllByText(/EUR/i).length).toBeGreaterThan(0);
    });
  });

  // ---------- Form field validation ----------

  it('validates recipient account number is required', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Fill only amount and purpose, skip recipient fields
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');

    const purposeInput = screen.getByLabelText(/Svrha placanja/i);
    await user.type(purposeInput, 'Test');

    // Negativan test — validacija mora pasti, confirm dialog se NE otvara.
    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
    // Confirm dialog ne sme da se prikaze posle invalid submit-a.
    expect(screen.queryByTestId('payment-confirm-dialog')).not.toBeInTheDocument();
  });

  // ---------- Verification modal interaction ----------

  it('calls createPayment via OTP modal after valid submission', async () => {
    const user = userEvent.setup();
    mockTransactionService.createPayment.mockResolvedValue(undefined as never);
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Fill all mandatory fields
    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '222000000000000099');

    const recipientNameInput = screen.getByLabelText(/Naziv primaoca/i);
    await user.type(recipientNameInput, 'Test Primalac');

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');

    const purposeInput = screen.getByLabelText(/Svrha placanja/i);
    await user.type(purposeInput, 'Test placanje');

    // Submit
    await submitAndConfirm(user);

    // OTP modal opens
    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    // Enter OTP
    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(mockTransactionService.createPayment).toHaveBeenCalled();
    });
  });

  it('routes to interbank service when receiver prefix is not 222', async () => {
    const user = userEvent.setup();
    mockTransactionService.createPayment.mockResolvedValue(undefined as never);
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Racun primaoca/i), '111000000000000001');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Interbank Receiver');
    await user.clear(screen.getByLabelText(/Iznos/i));
    await user.type(screen.getByLabelText(/Iznos/i), '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Interbank payment');
    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(mockInterbankPaymentService.initiatePayment).toHaveBeenCalled();
      expect(mockTransactionService.createPayment).not.toHaveBeenCalled();
    });
  });

  it('closes verification modal on cancel', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Fill mandatory fields
    await user.type(screen.getByLabelText(/Racun primaoca/i), '265000000000000099');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Test');
    await user.clear(screen.getByLabelText(/Iznos/i));
    await user.type(screen.getByLabelText(/Iznos/i), '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Test');

    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    // Cancel
    await user.click(screen.getByText('Otkazi'));

    await waitFor(() => {
      expect(screen.queryByTestId('verification-modal')).not.toBeInTheDocument();
    });
  });

  // ---------- Error handling ----------

  it('handles account/recipients load failure', async () => {
    mockAccountService.getMyAccounts.mockRejectedValue(new Error('Network error'));
    mockRecipientService.getAll.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(mockAccountService.getMyAccounts).toHaveBeenCalled();
    });

    // Page should still render without crashing
    expect(screen.getByText(/Novi platni nalog/i)).toBeInTheDocument();
  });

  // ---------- Live preview ----------

  it('updates live preview when filling form fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pregled naloga/i)).toBeInTheDocument();
    });

    // Fill recipient name
    const recipientNameInput = screen.getByLabelText(/Naziv primaoca/i);
    await user.type(recipientNameInput, 'Test Primalac Preview');

    // Preview should update with the typed name
    await waitFor(() => {
      expect(screen.getByText(/Test Primalac Preview/i)).toBeInTheDocument();
    });
  });

  // ---------- Optional fields ----------

  it('allows model and call number fields to be empty', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    });

    const modelInput = screen.getByLabelText(/Model/i) as HTMLInputElement;
    const callNumberInput = screen.getByLabelText(/Poziv na broj/i) as HTMLInputElement;

    // Both should be empty by default
    expect(modelInput.value).toBe('');
    expect(callNumberInput.value).toBe('');
  });

  // ---------- Inter-bank warning banner (Celina 5 (Nova)) ----------

  it('does not show inter-bank banner for empty recipient account', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Racun primaoca/i)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('interbank-warning-banner')).not.toBeInTheDocument();
  });

  it('does not show inter-bank banner for our-bank prefix (222)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Racun primaoca/i)).toBeInTheDocument();
    });

    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '222000000000000099');

    expect(screen.queryByTestId('interbank-warning-banner')).not.toBeInTheDocument();
  });

  it('shows inter-bank banner when recipient account starts with foreign prefix (444)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Racun primaoca/i)).toBeInTheDocument();
    });

    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '444000000000000099');

    await waitFor(() => {
      expect(screen.getByTestId('interbank-warning-banner')).toBeInTheDocument();
    });

    // Banner sadrzi prefix iz unosa + 2PC tekst
    expect(screen.getByText(/Medjubankarsko placanje/i)).toBeInTheDocument();
    expect(screen.getByText(/2-Phase Commit/i)).toBeInTheDocument();
    expect(screen.getByText('444')).toBeInTheDocument();
  });

  it('hides inter-bank banner when user clears recipient account back to empty', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Racun primaoca/i)).toBeInTheDocument();
    });

    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '444000000000000099');

    await waitFor(() => {
      expect(screen.getByTestId('interbank-warning-banner')).toBeInTheDocument();
    });

    await user.clear(toAccountInput);

    await waitFor(() => {
      expect(screen.queryByTestId('interbank-warning-banner')).not.toBeInTheDocument();
    });
  });

  it('shows inter-bank banner for prefix 333 (Banka 3)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Racun primaoca/i)).toBeInTheDocument();
    });

    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '333000000000000099');

    await waitFor(() => {
      expect(screen.getByTestId('interbank-warning-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('333')).toBeInTheDocument();
  });

  // ---------- F) Inter-bank stepper modal (visual progress) ----------

  it('renders 4-step stepper when inter-bank tracking is active', async () => {
    const user = userEvent.setup();

    // BE prvo vraca PREPARED (faza 2 active), pa COMMITTED (faza 4 done)
    mockInterbankPaymentService.getStatus
      .mockResolvedValueOnce({
        id: 11,
        transactionId: 'tx-11',
        status: 'PREPARED',
        senderAccountNumber: '265000000000000001',
        receiverAccountNumber: '444000000000000099',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-01-01T00:00:00',
      })
      .mockResolvedValue({
        id: 11,
        transactionId: 'tx-11',
        status: 'COMMITTED',
        senderAccountNumber: '265000000000000001',
        receiverAccountNumber: '444000000000000099',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-01-01T00:00:00',
      });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    // Fill form sa inter-bank brojem racuna
    const toAccountInput = screen.getByLabelText(/Racun primaoca/i);
    await user.type(toAccountInput, '444000000000000099');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Test');
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Test inter-bank');

    // Submit, potvrdi confirm dialog, pa OTP
    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi OTP'));

    // Stepper se pojavljuje
    await waitFor(() => {
      expect(screen.getByTestId('interbank-stepper')).toBeInTheDocument();
    });

    // 4 koraka su prisutna
    expect(screen.getByTestId('interbank-step-INITIATED')).toBeInTheDocument();
    expect(screen.getByTestId('interbank-step-PREPARED')).toBeInTheDocument();
    expect(screen.getByTestId('interbank-step-COMMITTING')).toBeInTheDocument();
    expect(screen.getByTestId('interbank-step-COMMITTED')).toBeInTheDocument();
  });

  it('shows retry button in STUCK warning and refreshes status when clicked', async () => {
    const user = userEvent.setup();

    mockInterbankPaymentService.initiatePayment.mockResolvedValue({
      id: 13,
      transactionId: 'tx-13',
      status: 'STUCK',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '444000000000000099',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
      failureReason: 'Banka primaoca nije odgovorila',
    });
    // Prvi initiate vraca STUCK; drugi getStatus (nakon retry click-a) vraca COMMITTED
    mockInterbankPaymentService.getStatus.mockResolvedValue({
      id: 13,
      transactionId: 'tx-13',
      status: 'COMMITTED',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '444000000000000099',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Racun primaoca/i), '444000000000000099');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Test');
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Test');

    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(screen.getByTestId('interbank-stuck-retry-btn')).toBeInTheDocument();
    });

    // Klik na retry
    await user.click(screen.getByTestId('interbank-stuck-retry-btn'));

    // Status modal se osvezava na COMMITTED — STUCK warning nestaje
    await waitFor(() => {
      expect(screen.queryByTestId('interbank-stuck-warning')).not.toBeInTheDocument();
    });

    expect(mockInterbankPaymentService.getStatus).toHaveBeenCalledWith('tx-13');
  });

  it('shows STUCK warning alert when transaction is stuck', async () => {
    const user = userEvent.setup();

    // Initiate vec vraca STUCK (npr. po 2 minuta polling-a iz prethodne sesije)
    mockInterbankPaymentService.initiatePayment.mockResolvedValue({
      id: 12,
      transactionId: 'tx-12',
      status: 'STUCK',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '444000000000000099',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
      failureReason: 'Banka primaoca nije odgovorila u 2 minuta',
    });
    mockInterbankPaymentService.getStatus.mockResolvedValue({
      id: 12,
      transactionId: 'tx-12',
      status: 'STUCK',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '444000000000000099',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
      failureReason: 'Banka primaoca nije odgovorila u 2 minuta',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Racun primaoca/i), '444000000000000099');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Test');
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Test');

    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(screen.getByTestId('interbank-stuck-warning')).toBeInTheDocument();
    });

    expect(screen.getByText(/zaglavljena/i)).toBeInTheDocument();
  });

  // ---------- G) Inter-bank rehydrate iz sessionStorage (Sc 11) ----------
  // TEST-fe-banking-1: ako korisnik reloaduje stranicu dok je inter-bank
  // placanje u toku, txId je perzistiran u sessionStorage. Na mount-u recovery
  // useEffect fetch-uje status i prikazuje tracking modal. Pinujemo tri grane:
  //   1) terminal status na rehydrate -> modal + key ocistjen (bez polling-a);
  //   2) non-terminal -> modal + "Nastavljam pracenje" toast (resume);
  //   3) getStatus 404/throw -> tihi cleanup key-a, bez modala.

  it('rehydrates inter-bank tracking modal from sessionStorage on mount (terminal status)', async () => {
    // Aktivan txId iz "prethodne sesije" + BE vraca terminal COMMITTED.
    window.sessionStorage.setItem('interbank-active-tx', 'tx-77');
    mockInterbankPaymentService.getStatus.mockResolvedValue({
      id: 77,
      transactionId: 'tx-77',
      status: 'COMMITTED',
      senderAccountNumber: '265000000000000001',
      receiverAccountNumber: '444000000000000099',
      amount: 5000,
      currency: 'RSD',
      createdAt: '2026-01-01T00:00:00',
    });

    renderPage();

    // Recovery useEffect fetch-uje status sacuvanog txId-a...
    await waitFor(() => {
      expect(mockInterbankPaymentService.getStatus).toHaveBeenCalledWith('tx-77');
    });

    // ...i prikazuje tracking modal sa tim statusom.
    await waitFor(() => {
      expect(screen.getByTestId('interbank-status-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('interbank-status-badge').textContent).toBe('COMMITTED');

    // Terminal status -> aktivni txId je ocistjen iz sessionStorage.
    await waitFor(() => {
      expect(window.sessionStorage.getItem('interbank-active-tx')).toBeNull();
    });
  });

  it('rehydrates and resumes polling (toast) when saved tx is still in-progress', async () => {
    window.sessionStorage.setItem('interbank-active-tx', 'tx-88');
    // Prvi getStatus (recovery) -> non-terminal PREPARED; svi naredni -> COMMITTED
    // (zatvara polling loop bez beskonacnog cekanja).
    mockInterbankPaymentService.getStatus
      .mockResolvedValueOnce({
        id: 88,
        transactionId: 'tx-88',
        status: 'PREPARED',
        senderAccountNumber: '265000000000000001',
        receiverAccountNumber: '444000000000000099',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-01-01T00:00:00',
      })
      .mockResolvedValue({
        id: 88,
        transactionId: 'tx-88',
        status: 'COMMITTED',
        senderAccountNumber: '265000000000000001',
        receiverAccountNumber: '444000000000000099',
        amount: 5000,
        currency: 'RSD',
        createdAt: '2026-01-01T00:00:00',
      });

    renderPage();

    // Modal se pojavljuje u PREPARED (in-progress) stanju...
    await waitFor(() => {
      expect(screen.getByTestId('interbank-status-modal')).toBeInTheDocument();
    });

    // ...i resume toast je emitovan (pre nego sto polling krene).
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringMatching(/Nastavljam pracenje inter-bank/i)
      );
    });
  });

  it('silently clears stale txId on mount when getStatus rejects (no modal)', async () => {
    window.sessionStorage.setItem('interbank-active-tx', 'tx-stale');
    mockInterbankPaymentService.getStatus.mockRejectedValue(new Error('404 not found'));

    renderPage();

    // Recovery fetch je pokusan...
    await waitFor(() => {
      expect(mockInterbankPaymentService.getStatus).toHaveBeenCalledWith('tx-stale');
    });

    // ...key je ocistjen, modal se NE prikazuje.
    await waitFor(() => {
      expect(window.sessionStorage.getItem('interbank-active-tx')).toBeNull();
    });
    expect(screen.queryByTestId('interbank-status-modal')).not.toBeInTheDocument();
  });

  // ---------- H) Sc11: praznjenje polja primaoca na intra-bank "racun ne postoji" ----------
  // TEST-fe-banking-2 [SPEC Celina 2 Sc11]: kada BE javi da racun primaoca ne
  // postoji za intra-bank placanje, polje primaoca (broj racuna + naziv) MORA
  // da se ocisti — uneti broj racuna je nevalidan. NewPaymentPage onVerified
  // catch detektuje "racun ... ne postoji" gresku (404 + message body) i prazni
  // toAccountNumber/recipientName, uz toast i re-throw (da VerificationModal
  // prikaze gresku; OTP pokusaji se NE dekrementiraju — R1-253).
  // FIXED 03.06: catalog CODE_QUALITY.md `NewPaymentPage.tsx onVerified catch`.
  it('[TEST-fe-banking-2] clears recipient fields on intra-bank "racun ne postoji" error', async () => {
    // delay: null -> userEvent kuca sinhrono (bez per-char event-loop yield-a).
    // Ovaj test kuca 18-cifreni racun + naziv + iznos + svrhu; pod paralelnim
    // CPU load-om default delay je flake-ovao 5s timeout. Sinhroni unos uklanja
    // scheduling overhead i drzi test deterministicki ispod limita.
    const user = userEvent.setup({ delay: null });
    // BE odbija intra-bank placanje (racun primaoca ne postoji).
    mockTransactionService.createPayment.mockRejectedValue({
      response: { status: 404, data: { message: 'Racun primaoca ne postoji.' } },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const toAccountInput = screen.getByLabelText(/Racun primaoca/i) as HTMLInputElement;
    await user.type(toAccountInput, '222000000000000099');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Nepostojeci Primalac');
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Test Sc11');

    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi OTP'));

    // createPayment je pozvan i odbijen (404).
    await waitFor(() => {
      expect(mockTransactionService.createPayment).toHaveBeenCalled();
    });

    // Greska je surface-ovana korisniku.
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Racun primaoca ne postoji.');
    });

    // Spec Sc11: polje broja racuna primaoca je ocisceno...
    await waitFor(() => {
      expect((screen.getByLabelText(/Racun primaoca/i) as HTMLInputElement).value).toBe('');
    });
    // ...kao i naziv primaoca.
    expect((screen.getByLabelText(/Naziv primaoca/i) as HTMLInputElement).value).toBe('');
  });

  // TEST-fe-banking-2 (kontra-test): polje primaoca NE sme da se ocisti na
  // nepovezanu gresku (npr. nedovoljno sredstava) — brisemo samo na
  // "racun ne postoji". Stiti od over-eager clear-a.
  it('[TEST-fe-banking-2] does NOT clear recipient fields on unrelated intra-bank error', async () => {
    // delay: null -> sinhroni unos (vidi gornji test). Sprecava flaky 5s timeout
    // pod paralelnim load-om (gate je ovde prijavio "Test timed out in 5000ms").
    const user = userEvent.setup({ delay: null });
    mockTransactionService.createPayment.mockRejectedValue({
      response: { status: 400, data: { message: 'Nedovoljno sredstava na racunu.' } },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Racun primaoca/i), '222000000000000099');
    await user.type(screen.getByLabelText(/Naziv primaoca/i), 'Validan Primalac');
    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');
    await user.type(screen.getByLabelText(/Svrha placanja/i), 'Test Sc11 kontra');

    await submitAndConfirm(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(mockTransactionService.createPayment).toHaveBeenCalled();
    });

    // Polje ostaje popunjeno — greska nije "racun ne postoji".
    expect((screen.getByLabelText(/Racun primaoca/i) as HTMLInputElement).value).toBe(
      '222000000000000099'
    );
    expect((screen.getByLabelText(/Naziv primaoca/i) as HTMLInputElement).value).toBe(
      'Validan Primalac'
    );
  });
});
