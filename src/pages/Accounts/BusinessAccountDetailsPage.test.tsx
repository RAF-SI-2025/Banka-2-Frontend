import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BusinessAccountDetailsPage from './BusinessAccountDetailsPage';
import { mockAccount, mockTransaction, paginatedResponse } from '@/test/helpers';

// ---------- Mocks ----------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/accountService', () => ({
  accountService: {
    getById: vi.fn(),
    updateName: vi.fn(),
    changeLimit: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getAll: vi.fn(),
  },
}));

// Izmena limita zahteva OTP potvrdu pre poziva na backend; simulira se
// automatska verifikacija cim se modal otvori (potpis onVerified(code)).
vi.mock('@/components/shared/VerificationModal', () => ({
  default: ({ isOpen, onVerified }: { isOpen: boolean; onVerified: (code: string) => void | Promise<void> }) => {
    if (isOpen) {
      queueMicrotask(() => {
        void onVerified('123456');
      });
    }
    return null;
  },
}));

import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';

const mockAccountService = vi.mocked(accountService);
const mockTransactionService = vi.mocked(transactionService);

const businessAccount = mockAccount({
  id: 10,
  name: 'Poslovni tekuci',
  accountNumber: '265000000000000010',
  balance: 5000000,
  availableBalance: 4800000,
  reservedBalance: 200000,
  dailyLimit: 1000000,
  monthlyLimit: 10000000,
  dailySpending: 300000,
  monthlySpending: 2000000,
  maintenanceFee: 500,
  status: 'ACTIVE',
  currency: 'RSD',
});

const companyInfo = {
  id: 1,
  companyName: 'Tech Solutions DOO',
  registrationNumber: '12345678',
  taxId: '987654321',
  activityCode: '62.01',
  address: 'Knez Mihailova 10, Beograd',
};

function renderPage(accountId = '10') {
  return render(
    <MemoryRouter initialEntries={[`/accounts/business/${accountId}`]}>
      <Routes>
        <Route path="/accounts/business/:id" element={<BusinessAccountDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BusinessAccountDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getById.mockResolvedValue({ ...businessAccount, company: companyInfo } as never);
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([
      mockTransaction({ id: 1, recipientName: 'Dobavljac A', amount: 150000 }),
      mockTransaction({ id: 2, recipientName: 'Dobavljac B', amount: 80000 }),
    ]));
  });

  it('shows loading skeleton initially', () => {
    mockAccountService.getById.mockImplementation(() => new Promise(() => {}));
    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders account name and status after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Poslovni tekuci')).toBeInTheDocument();
    });
    expect(screen.getByText('Aktivan')).toBeInTheDocument();
    expect(screen.getByText('Poslovni')).toBeInTheDocument();
  });

  it('renders formatted account number', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('265-0000000000000-10')).toBeInTheDocument();
    });
  });

  it('renders company info when available', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Informacije o firmi')).toBeInTheDocument();
    });
    expect(screen.getByText('Tech Solutions DOO')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByText('987654321')).toBeInTheDocument();
    expect(screen.getByText('62.01')).toBeInTheDocument();
    expect(screen.getByText('Knez Mihailova 10, Beograd')).toBeInTheDocument();
  });

  it('does not render company info when not available', async () => {
    mockAccountService.getById.mockResolvedValue(businessAccount as never);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Poslovni tekuci')).toBeInTheDocument();
    });
    expect(screen.queryByText('Informacije o firmi')).not.toBeInTheDocument();
  });

  it('renders balance details', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Stanje racuna')).toBeInTheDocument();
    });
    expect(screen.getByText('Ukupno stanje')).toBeInTheDocument();
    // "Raspolozivo" appears in hero and in card
    expect(screen.getAllByText(/Raspolozivo/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Rezervisano')).toBeInTheDocument();
    expect(screen.getByText(/Odrzavanje/)).toBeInTheDocument();
  });

  it('renders limit and spending progress', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Limiti i potrosnja')).toBeInTheDocument();
    });
    expect(screen.getByText(/Dnevna potrosnja/)).toBeInTheDocument();
    expect(screen.getByText(/Mesecna potrosnja/)).toBeInTheDocument();
  });

  it('renders recent transactions', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Dobavljac A')).toBeInTheDocument();
    });
    expect(screen.getByText('Dobavljac B')).toBeInTheDocument();
  });

  it('shows empty transactions state when no transactions', async () => {
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nema transakcija za ovaj racun/)).toBeInTheDocument();
    });
  });

  it('shows not found state when account is null', async () => {
    mockAccountService.getById.mockRejectedValue(new Error('Not found'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Racun nije pronadjen/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Racun koji trazite ne postoji ili je uklonjen/)).toBeInTheDocument();
  });

  it('navigates back to accounts on back button click', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Poslovni tekuci')).toBeInTheDocument();
    });

    const backBtn = screen.getAllByRole('button', { name: /Nazad na racune/i })[0];
    await user.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/accounts');
  });

  it('renders action buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Poslovni tekuci')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Novo placanje/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prenos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sve transakcije/i })).toBeInTheDocument();
  });

  it('saves new name via accountService.updateName', async () => {
    const user = userEvent.setup();
    mockAccountService.updateName.mockResolvedValue({ ...businessAccount, name: 'Novi naziv' } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Poslovni tekuci')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Novi naziv racuna');
    await user.clear(input);
    await user.type(input, 'Novi naziv');
    await user.click(screen.getByRole('button', { name: /Promeni naziv/i }));

    await waitFor(() => {
      expect(mockAccountService.updateName).toHaveBeenCalledWith(10, 'Novi naziv');
    });
  });

  it('saves limits via accountService.changeLimit', async () => {
    const user = userEvent.setup();
    mockAccountService.changeLimit.mockResolvedValue(undefined as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Poslovni tekuci')).toBeInTheDocument();
    });

    const dailyInput = screen.getByLabelText(/Novi dnevni limit/i);
    const monthlyInput = screen.getByLabelText(/Novi mesecni limit/i);

    await user.clear(dailyInput);
    await user.type(dailyInput, '2000000');
    await user.clear(monthlyInput);
    await user.type(monthlyInput, '20000000');

    await user.click(screen.getByRole('button', { name: /Sacuvaj limite/i }));

    await waitFor(() => {
      expect(mockAccountService.changeLimit).toHaveBeenCalledWith(10, expect.objectContaining({
        dailyLimit: 2000000,
        monthlyLimit: 20000000,
        otpCode: expect.any(String),
      }));
    });
  });
});
