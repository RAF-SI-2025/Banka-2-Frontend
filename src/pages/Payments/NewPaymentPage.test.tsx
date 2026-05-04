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
        <button onClick={() => onVerified('123456')}>Potvrdi OTP</button>
        <button onClick={onClose}>Otkazi</button>
      </div>
    ) : null,
}));

import { accountService } from '@/services/accountService';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import { transactionService } from '@/services/transactionService';
import interbankPaymentService from '@/services/interbankPaymentService';

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

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Nastavi na verifikaciju/i });
    await user.click(submitBtn);

    await waitFor(() => {
      // Should show validation errors
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
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
    const submitBtn = screen.getByRole('button', { name: /Nastavi na verifikaciju/i });
    await user.click(submitBtn);

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

  it('allows changing payment code value', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Sifra placanja/i)).toBeInTheDocument();
    });

    const paymentCodeInput = screen.getByLabelText(/Sifra placanja/i) as HTMLInputElement;
    await user.clear(paymentCodeInput);
    await user.type(paymentCodeInput, '220');
    expect(paymentCodeInput.value).toBe('220');
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

    const submitBtn = screen.getByRole('button', { name: /Nastavi na verifikaciju/i });
    await user.click(submitBtn);

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
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
    const submitBtn = screen.getByRole('button', { name: /Nastavi na verifikaciju/i });
    await user.click(submitBtn);

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
    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

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

    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

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

    // Submit i potvrdi OTP
    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

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

    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

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

    await user.click(screen.getByRole('button', { name: /Nastavi na verifikaciju/i }));

    await waitFor(() => {
      expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Potvrdi OTP'));

    await waitFor(() => {
      expect(screen.getByTestId('interbank-stuck-warning')).toBeInTheDocument();
    });

    expect(screen.getByText(/zaglavljena/i)).toBeInTheDocument();
  });
});
