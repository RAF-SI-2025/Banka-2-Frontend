import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfitBankPage from './ProfitBankPage';

const useAuthMock = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/services/profitBankService', () => ({
  default: {
    listActuaryPerformance: vi.fn(),
    listBankFundPositions: vi.fn(),
  },
}));

vi.mock('@/services/investmentFundService', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    invest: vi.fn(),
    withdraw: vi.fn(),
  },
}));

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
    getBankAccounts: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock dialoge: prikazi dugme koje odmah zove onSuccess (da testiramo
// ProfitBank cache-invalidaciju posle mutacije — R1 560).
vi.mock('@/pages/Funds/FundWithdrawDialog', () => ({
  default: ({ open, onSuccess }: { open: boolean; onSuccess: (t: unknown) => void }) =>
    open ? (
      <button type="button" data-testid="mock-withdraw-success" onClick={() => onSuccess({})}>
        confirm-withdraw
      </button>
    ) : null,
}));
vi.mock('@/pages/Funds/FundInvestDialog', () => ({
  default: ({ open, onSuccess }: { open: boolean; onSuccess: () => void }) =>
    open ? (
      <button type="button" data-testid="mock-invest-success" onClick={() => onSuccess()}>
        confirm-invest
      </button>
    ) : null,
}));

import profitBankService from '@/services/profitBankService';
import investmentFundService from '@/services/investmentFundService';
import { accountService } from '@/services/accountService';

const mockedProfitBankService = vi.mocked(profitBankService);
const mockedInvestmentFundService = vi.mocked(investmentFundService);
const mockedAccountService = vi.mocked(accountService);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/employee/profit-bank']}>
      <ProfitBankPage />
    </MemoryRouter>,
  );
}

describe('ProfitBankPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProfitBankService.listActuaryPerformance.mockResolvedValue([
      { employeeId: 1, name: 'Marko Petrovic', position: 'SUPERVISOR', totalProfitRsd: 25000, ordersDone: 7 },
      { employeeId: 2, name: 'Tamara Pavlovic', position: 'AGENT', totalProfitRsd: 12000, ordersDone: 4 },
    ]);
    mockedProfitBankService.listBankFundPositions.mockResolvedValue([
      {
        id: 10,
        fundId: 5,
        fundName: 'Alpha Fund',
        userId: 99,
        userRole: 'CLIENT',
        userName: 'Banka 2',
        totalInvested: 100000,
        currentValue: 120000,
        percentOfFund: 15,
        profit: 20000,
        lastModifiedAt: '2026-04-28T10:00:00Z',
      },
    ]);
    mockedInvestmentFundService.list.mockResolvedValue([
      {
        id: 5,
        name: 'Alpha Fund',
        description: '',
        minimumContribution: 1000,
        fundValue: 800000,
        profit: 50000,
        managerName: 'Marko',
        inceptionDate: '2026-01-01',
      },
    ]);
    mockedAccountService.getBankAccounts.mockResolvedValue([] as never);
  });

  it('redirects non-supervisors to /home', () => {
    useAuthMock.mockReturnValue({ isSupervisor: false, isAdmin: false });
    const { container } = renderPage();
    expect(container.textContent).not.toContain('Profit Banke');
    expect(mockedProfitBankService.listActuaryPerformance).not.toHaveBeenCalled();
  });

  it('renders actuary tab content for supervisors', async () => {
    useAuthMock.mockReturnValue({ isSupervisor: true, isAdmin: false });
    renderPage();

    expect(await screen.findByText('Profit Banke')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
      expect(screen.getByText('Tamara Pavlovic')).toBeInTheDocument();
    });
  });

  it('switches to positions tab and shows Uplati/Povuci buttons', async () => {
    useAuthMock.mockReturnValue({ isSupervisor: true, isAdmin: false });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Profit Banke');
    await user.click(screen.getByRole('tab', { name: /Pozicije u fondovima/i }));

    expect(await screen.findByText('Alpha Fund')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uplati u ime banke/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Povuci u ime banke/i })).toBeInTheDocument();
  });

  it('shows empty state when bank has no positions', async () => {
    useAuthMock.mockReturnValue({ isSupervisor: true, isAdmin: false });
    mockedProfitBankService.listBankFundPositions.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Profit Banke');
    await user.click(screen.getByRole('tab', { name: /Pozicije u fondovima/i }));

    expect(await screen.findByText(/Banka trenutno nema pozicije u fondovima/i)).toBeInTheDocument();
  });

  // ---------- Per-fund holdings breakdown (Spec Celina 4 (Nova) §4585-4628) ----------

  it('expands fund detail breakdown with holdings on click', async () => {
    useAuthMock.mockReturnValue({ isSupervisor: true, isAdmin: false });
    mockedInvestmentFundService.get.mockResolvedValue({
      id: 5,
      name: 'Alpha Fund',
      description: 'Tech sector fund',
      managerName: 'Marko Petrovic',
      managerEmployeeId: 1,
      fundValue: 800000,
      liquidAmount: 200000,
      profit: 50000,
      minimumContribution: 1000,
      accountNumber: '222001100000000005',
      holdings: [
        {
          listingId: 101,
          ticker: 'AAPL',
          name: 'Apple Inc.',
          quantity: 50,
          currentPrice: 175.50,
          change: 2.30,
          volume: 1000,
          initialMarginCost: 9650,
          acquisitionDate: '2026-03-15',
        },
        {
          listingId: 102,
          ticker: 'MSFT',
          name: 'Microsoft Corp.',
          quantity: 30,
          currentPrice: 410.20,
          change: -1.80,
          volume: 800,
          initialMarginCost: 13540,
          acquisitionDate: '2026-04-01',
        },
      ],
      performance: [],
      inceptionDate: '2026-01-01',
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Profit Banke');
    await user.click(screen.getByRole('tab', { name: /Pozicije u fondovima/i }));
    await screen.findByText('Alpha Fund');

    // Initial state: breakdown nije renderovan
    expect(screen.queryByTestId('bank-fund-breakdown-5')).not.toBeInTheDocument();

    // Klik na expand dugme
    await user.click(screen.getByTestId('bank-fund-expand-5'));

    // Breakdown renderovan
    await waitFor(() => {
      expect(screen.getByTestId('bank-fund-breakdown-5')).toBeInTheDocument();
    });

    // Service pozvan
    expect(mockedInvestmentFundService.get).toHaveBeenCalledWith(5);

    // Holdings se prikazuju
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();

    // Mini KPI kartice
    expect(screen.getByText(/Menadzer/i)).toBeInTheDocument();
    expect(screen.getByText(/Likvidnost/i)).toBeInTheDocument();
  });

  it('collapses breakdown when clicking expand button again', async () => {
    useAuthMock.mockReturnValue({ isSupervisor: true, isAdmin: false });
    mockedInvestmentFundService.get.mockResolvedValue({
      id: 5,
      name: 'Alpha Fund',
      description: '',
      managerName: 'Marko',
      managerEmployeeId: 1,
      fundValue: 800000,
      liquidAmount: 200000,
      profit: 50000,
      minimumContribution: 1000,
      accountNumber: '222001100000000005',
      holdings: [],
      performance: [],
      inceptionDate: '2026-01-01',
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Profit Banke');
    await user.click(screen.getByRole('tab', { name: /Pozicije u fondovima/i }));
    await screen.findByText('Alpha Fund');

    await user.click(screen.getByTestId('bank-fund-expand-5'));
    await waitFor(() => {
      expect(screen.getByTestId('bank-fund-breakdown-5')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('bank-fund-expand-5'));
    await waitFor(() => {
      expect(screen.queryByTestId('bank-fund-breakdown-5')).not.toBeInTheDocument();
    });
  });

  // R1 560: posle withdraw mutacije keshirani fund detail mora biti re-fetch-ovan.
  it('invalidira fund detail cache posle withdraw-a (re-fetch dok je red otvoren)', async () => {
    useAuthMock.mockReturnValue({ isSupervisor: true, isAdmin: false });
    mockedInvestmentFundService.get.mockResolvedValue({
      id: 5,
      name: 'Alpha Fund',
      description: '',
      managerName: 'Marko',
      managerEmployeeId: 1,
      fundValue: 800000,
      liquidAmount: 200000,
      profit: 50000,
      minimumContribution: 1000,
      accountNumber: '222001100000000005',
      holdings: [],
      performance: [],
      inceptionDate: '2026-01-01',
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Profit Banke');
    await user.click(screen.getByRole('tab', { name: /Pozicije u fondovima/i }));
    await screen.findByText('Alpha Fund');

    // Otvori detalj (keshira get(5) — poziv #1).
    await user.click(screen.getByTestId('bank-fund-expand-5'));
    await waitFor(() => {
      expect(mockedInvestmentFundService.get).toHaveBeenCalledTimes(1);
    });

    // Otvori withdraw dialog i potvrdi (onSuccess → invalidateFundDetail).
    await user.click(screen.getByRole('button', { name: /Povuci u ime banke/i }));
    await user.click(await screen.findByTestId('mock-withdraw-success'));

    // Cache invalidiran + red je otvoren → get(5) ponovo pozvan (poziv #2).
    await waitFor(() => {
      expect(mockedInvestmentFundService.get).toHaveBeenCalledTimes(2);
    });
    expect(mockedProfitBankService.listBankFundPositions).toHaveBeenCalled();
  });
});
