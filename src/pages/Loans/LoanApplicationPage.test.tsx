import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoanApplicationPage from './LoanApplicationPage';
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

vi.mock('@/services/creditService', () => ({
  creditService: {
    apply: vi.fn(),
  },
}));

// ACCEPTED-DEVIATION (user-directed 03.06): zahtev za kredit se podnosi direktno,
// bez OTP modala. OTP ostaje samo na placanju/transferu.

import { accountService } from '@/services/accountService';
import { creditService } from '@/services/creditService';

const mockAccountService = vi.mocked(accountService);
const mockCreditService = vi.mocked(creditService);

const rsdAcc = mockAccount({ id: 1, accountNumber: '265000000000000001', currency: 'RSD', name: 'Tekuci RSD' });
const eurAcc = mockAccountEUR({ id: 2, accountNumber: '265000000000000002', currency: 'EUR', name: 'Devizni EUR' });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/loans/apply']}>
      <LoanApplicationPage />
    </MemoryRouter>
  );
}

describe('LoanApplicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getMyAccounts.mockResolvedValue([rsdAcc, eurAcc]);
    mockCreditService.apply.mockResolvedValue({ id: 1 });
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za kredit/i)).toBeInTheDocument();
    });
  });

  it('renders multi-step indicator', async () => {
    renderPage();

    await waitFor(() => {
      // "Tip kredita" appears in step indicator, section header, and label
      expect(screen.getAllByText(/Tip kredita/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Iznos i period/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Licni podaci/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Potvrda/i).length).toBeGreaterThan(0);
  });

  it('renders loan type selection', async () => {
    renderPage();

    await waitFor(() => {
      // Loan type options
      expect(screen.getByText(/GOTOVINSKI|Gotovinski/i)).toBeInTheDocument();
    });
  });

  it('renders amount input', async () => {
    renderPage();

    await waitFor(() => {
      // "Iznos" label matches both the number input and the range slider (aria-label="Iznos kredita")
      expect(screen.getByLabelText('Iznos')).toBeInTheDocument();
    });
  });

  it('renders repayment period selection', async () => {
    renderPage();

    await waitFor(() => {
      // Label "Period otplate (meseci)" links to the select
      expect(screen.getByLabelText('Period otplate (meseci)')).toBeInTheDocument();
    });
  });

  it('renders account selection', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Racun za isplatu')).toBeInTheDocument();
    });
  });

  it('shows monthly payment calculation', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Iznos')).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText('Iznos');
    await user.clear(amountInput);
    await user.type(amountInput, '1000000');

    // The calculator should show monthly payment estimate
    await waitFor(() => {
      expect(screen.getByText(/Mesecna rata|mesecna rata/i)).toBeInTheDocument();
    });
  });

  it('filters accounts by selected currency', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Racun za isplatu')).toBeInTheDocument();
    });

    // Default currency is RSD, so only RSD accounts should be in dropdown
    const accountSelect = screen.getByLabelText('Racun za isplatu') as HTMLSelectElement;
    const options = Array.from(accountSelect.options);

    // Should contain the RSD account
    const hasRsd = options.some(opt => opt.textContent?.includes('RSD') || opt.value === rsdAcc.accountNumber);
    expect(hasRsd).toBe(true);
  });

  it('renders phone number field', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Kontakt telefon')).toBeInTheDocument();
    });
  });

  it('renders loan purpose field', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Svrha kredita')).toBeInTheDocument();
    });
  });

  it('shows interest rate type selection', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Fiksn|FIKSNI/i)).toBeInTheDocument();
    });
  });

  it('renders submit button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Posalji zahtev/i })).toBeInTheDocument();
    });
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Posalji zahtev/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Posalji zahtev/i }));

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('submits loan application with valid data', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Iznos')).toBeInTheDocument();
    });

    // Fill form
    const amountInput = screen.getByLabelText('Iznos');
    await user.clear(amountInput);
    await user.type(amountInput, '500000');

    const purposeInput = screen.getByLabelText('Svrha kredita');
    await user.type(purposeInput, 'Kupovina opreme');

    const phoneInput = screen.getByLabelText('Kontakt telefon');
    await user.type(phoneInput, '0611234567');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Posalji zahtev/i });
    await user.click(submitBtn);

    // ACCEPTED-DEVIATION (user-directed 03.06): submit poziva apply direktno, bez OTP.
    await waitFor(() => {
      expect(mockCreditService.apply).toHaveBeenCalled();
    });
    expect(mockCreditService.apply).toHaveBeenCalledWith(
      expect.not.objectContaining({ otpCode: expect.anything() })
    );
  });

  it('shows loan calculation preview', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Iznos')).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText('Iznos');
    await user.clear(amountInput);
    await user.type(amountInput, '1000000');

    // Should show calculation details
    await waitFor(() => {
      // Look for any calculation display (rate, total, etc.)
      const calcTexts = screen.queryAllByText(/kamatna stopa|Ukupno|EKS|Kalkulacija/i);
      expect(calcTexts.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // R1-254 / TEST-fe-banking-10: FE kalkulator (efektivna stopa, mesecna rata,
  // ukupno) je ORIJENTACIONA procena — NIJE obavezujuca ponuda. BE je merodavan
  // pri odobravanju. Dva invarijanta koja pinemo:
  //   1) disclaimer ("orijentaciona procena") MORA biti vidljiv da izmisljeni
  //      brojevi ne izgledaju kao stvarni uslovi (Luka pref "ne lazni podaci");
  //   2) FE-procenjena stopa/rata se NE salju u BE apply payload — BE racuna
  //      svoje uslove; salju se samo sirova polja forme (bez OTP — uklonjen 03.06).
  // ---------------------------------------------------------------------------

  it('renders the "orijentaciona procena" disclaimer (estimate is informative, not binding)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Iznos')).toBeInTheDocument();
    });

    // Disclaimer mora biti prisutan u kalkulator kartici.
    expect(
      screen.getByText(/orijentaciona procena/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Konacne uslove\s+kredita utvrdjuje banka/i)
    ).toBeInTheDocument();
  });

  it('does NOT send FE-estimated rate/monthlyPayment/total in the apply payload (BE authoritative)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Iznos')).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText('Iznos');
    await user.clear(amountInput);
    await user.type(amountInput, '500000');

    await user.type(screen.getByLabelText('Svrha kredita'), 'Kupovina opreme');
    await user.type(screen.getByLabelText('Kontakt telefon'), '0611234567');

    await user.click(screen.getByRole('button', { name: /Posalji zahtev/i }));

    await waitFor(() => {
      expect(mockCreditService.apply).toHaveBeenCalled();
    });

    const payload = mockCreditService.apply.mock.calls[0][0] as Record<string, unknown>;

    // BE-merodavni: FE procene (annualRate / effectiveRate / monthlyPayment /
    // totalRepayment / totalInterest) NE smeju da procure u apply payload —
    // klijent ne sme "ponuditi" sopstvenu kamatnu stopu.
    expect(payload).not.toHaveProperty('annualRate');
    expect(payload).not.toHaveProperty('effectiveRate');
    expect(payload).not.toHaveProperty('nominalRate');
    expect(payload).not.toHaveProperty('interestRate');
    expect(payload).not.toHaveProperty('monthlyPayment');
    expect(payload).not.toHaveProperty('totalRepayment');
    expect(payload).not.toHaveProperty('totalInterest');

    // Sirova polja forme JESU poslata (BE racuna ostalo). OTP se vise ne salje.
    expect(payload).toMatchObject({
      loanType: 'GOTOVINSKI',
      amount: 500000,
      currency: 'RSD',
    });
    expect(payload).not.toHaveProperty('otpCode');
  });
});
