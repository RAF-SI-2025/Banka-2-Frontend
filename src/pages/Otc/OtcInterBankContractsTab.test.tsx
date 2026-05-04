import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OtcInterBankContractsTab from './OtcInterBankContractsTab';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'stefan.jovanovic@gmail.com',
      username: 'client-1',
      firstName: 'Stefan',
      lastName: 'Jovanovic',
      permissions: [],
    },
    isAdmin: false,
    isAgent: false,
    isSupervisor: false,
  }),
}));

vi.mock('@/services/interbankOtcService', () => ({
  default: {
    listMyContracts: vi.fn(),
    exerciseContract: vi.fn(),
  },
}));

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
    getBankAccounts: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import interbankOtcService from '@/services/interbankOtcService';
import { accountService } from '@/services/accountService';
import api from '@/services/api';
import { toast } from '@/lib/notify';

const mockedInterbankOtcService = vi.mocked(interbankOtcService);
const mockedAccountService = vi.mocked(accountService);
const mockedApi = vi.mocked(api);
const mockedToast = vi.mocked(toast);

const activeBuyerContract = {
  id: 'contract-1',
  listingId: 11,
  listingTicker: 'AAPL',
  listingName: 'Apple Inc.',
  listingCurrency: 'USD',
  buyerUserId: 'client-1',
  buyerBankCode: 'BANKA1',
  buyerName: 'Stefan Jovanovic',
  sellerUserId: 'remote-seller',
  sellerBankCode: 'BANKA2',
  sellerName: 'Remote Seller',
  quantity: 8,
  strikePrice: 100,
  premium: 25,
  currentPrice: 126,
  settlementDate: '2099-05-10',
  status: 'ACTIVE' as const,
  createdAt: '2026-04-25T10:00:00Z',
};

const sellerSideContract = {
  ...activeBuyerContract,
  id: 'contract-2',
  listingTicker: 'MSFT',
  buyerUserId: 'partner-1',
  buyerName: 'Partner Buyer',
  sellerUserId: 'client-1',
  sellerName: 'Stefan Jovanovic',
};

const expiredContract = {
  ...activeBuyerContract,
  id: 'contract-3',
  listingTicker: 'NVDA',
  settlementDate: '2020-01-10',
  status: 'EXPIRED' as const,
};

const accounts = [
  {
    id: 1,
    accountNumber: '222000000000000001',
    currency: 'USD',
    availableBalance: 5000,
    balance: 5000,
    status: 'ACTIVE',
  },
  {
    id: 2,
    accountNumber: '222000000000000002',
    currency: 'USD',
    availableBalance: 9000,
    balance: 9000,
    status: 'ACTIVE',
  },
];

describe('OtcInterBankContractsTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    // Clear SAGA recovery key — komponente koje cuvaju aktivni SAGA state
    // u sessionStorage moraju ne curiti taj state izmedju testova jer
    // recovery useEffect na mount-u inace re-trigger-uje api.get pozive.
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
    mockedInterbankOtcService.listMyContracts.mockResolvedValue([
      activeBuyerContract,
      sellerSideContract,
      expiredContract,
    ]);
    mockedAccountService.getMyAccounts.mockResolvedValue(accounts as never);
    mockedApi.get.mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders contracts and shows exercise only for active buyer contracts before settlement', async () => {
    render(<OtcInterBankContractsTab />);

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Iskoristi/i })).toHaveLength(1);
    expect(screen.getAllByText('Aktivan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Istekao').length).toBeGreaterThan(0);
  });

  it('refetches contracts with a status filter', async () => {
    const user = userEvent.setup();
    render(<OtcInterBankContractsTab />);

    await screen.findByText('AAPL');
    await user.click(screen.getByRole('tab', { name: 'Iskoriscen' }));

    await waitFor(() => {
      expect(mockedInterbankOtcService.listMyContracts).toHaveBeenLastCalledWith('EXERCISED');
    });
  });

  it('opens the exercise dialog and falls back to a spinner when currentPhase is missing', async () => {
    const user = userEvent.setup();
    mockedInterbankOtcService.exerciseContract.mockResolvedValue({
      id: 77,
      transactionId: 'otc-tx-1',
      type: 'OTC',
      status: 'INITIATED',
      senderBankCode: 'BANKA1',
      receiverBankCode: 'BANKA2',
      amount: 800,
      currency: 'USD',
      createdAt: '2026-04-25T12:00:00Z',
      retryCount: 0,
    });

    render(<OtcInterBankContractsTab />);

    const contractRow = (await screen.findByText('AAPL')).closest('tr');
    expect(contractRow).not.toBeNull();
    await user.click(within(contractRow as HTMLElement).getByRole('button', { name: /Iskoristi/i }));

    expect(screen.getByRole('dialog', { name: /Iskoristi inter-bank opciju/i })).toBeInTheDocument();
    expect(screen.getByText(/Strike × kolicina/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Racun za placanje strike cene/i), '2');
    await user.click(screen.getByRole('button', { name: /Potvrdi exercise/i }));

    await waitFor(() => {
      expect(mockedInterbankOtcService.exerciseContract).toHaveBeenCalledWith('contract-1', 2);
    });

    expect(await screen.findByText(/Izvrsavanje u toku/i)).toBeInTheDocument();
    expect(screen.getByText(/currentPhase/i)).toBeInTheDocument();
  });

  it('shows all saga phases and polls until the transaction is committed', async () => {
    const user = userEvent.setup();

    mockedInterbankOtcService.listMyContracts
      .mockResolvedValueOnce([activeBuyerContract])
      .mockResolvedValueOnce([{ ...activeBuyerContract, status: 'EXERCISED' }]);
    mockedInterbankOtcService.exerciseContract.mockResolvedValue({
      id: 88,
      transactionId: 'otc-tx-committed',
      type: 'OTC',
      status: 'INITIATED',
      currentPhase: 'RESERVE_FUNDS',
      senderBankCode: 'BANKA1',
      receiverBankCode: 'BANKA2',
      amount: 800,
      currency: 'USD',
      createdAt: '2026-04-25T12:00:00Z',
      retryCount: 0,
    });
    mockedApi.get.mockResolvedValueOnce({
      data: {
        id: 88,
        transactionId: 'otc-tx-committed',
        type: 'OTC',
        status: 'COMMITTED',
        currentPhase: 'FINALIZING',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T12:00:00Z',
        committedAt: '2026-04-25T12:00:09Z',
        retryCount: 0,
      },
    } as never);

    render(<OtcInterBankContractsTab />);

    const contractRow = (await screen.findByText('AAPL')).closest('tr');
    await user.click(within(contractRow as HTMLElement).getByRole('button', { name: /Iskoristi/i }));
    vi.useFakeTimers();
    await act(async () => {
      screen.getByRole('button', { name: /Potvrdi exercise/i }).click();
    });

    expect(screen.getByText('Rezervacija sredstava')).toBeInTheDocument();
    expect(screen.getByText('Rezervacija hartija')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Prenos vlasnistva')).toBeInTheDocument();
    expect(screen.getByText('Finalizacija')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/interbank/payments/otc-tx-committed');
    });
    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith('Inter-bank exercise je uspesno finalizovan.');
    });
    await waitFor(() => {
      expect(mockedInterbankOtcService.listMyContracts).toHaveBeenLastCalledWith(undefined);
    });
  });

  it('shows failure reason when saga is aborted', async () => {
    const user = userEvent.setup();

    mockedInterbankOtcService.exerciseContract.mockResolvedValue({
      id: 99,
      transactionId: 'otc-tx-aborted',
      type: 'OTC',
      status: 'INITIATED',
      currentPhase: 'TRANSFER',
      senderBankCode: 'BANKA1',
      receiverBankCode: 'BANKA2',
      amount: 800,
      currency: 'USD',
      createdAt: '2026-04-25T12:00:00Z',
      retryCount: 0,
    });
    mockedApi.get.mockResolvedValueOnce({
      data: {
        id: 99,
        transactionId: 'otc-tx-aborted',
        type: 'OTC',
        status: 'ABORTED',
        currentPhase: 'TRANSFER',
        senderBankCode: 'BANKA1',
        receiverBankCode: 'BANKA2',
        amount: 800,
        currency: 'USD',
        createdAt: '2026-04-25T12:00:00Z',
        abortedAt: '2026-04-25T12:00:09Z',
        retryCount: 0,
        failureReason: 'Partner banka odbila prenos hartija.',
      },
    } as never);

    render(<OtcInterBankContractsTab />);

    const contractRow = (await screen.findByText('AAPL')).closest('tr');
    await user.click(within(contractRow as HTMLElement).getByRole('button', { name: /Iskoristi/i }));
    vi.useFakeTimers();
    await act(async () => {
      screen.getByRole('button', { name: /Potvrdi exercise/i }).click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    vi.useRealTimers();

    expect(screen.getByText('Partner banka odbila prenos hartija.')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('Partner banka odbila prenos hartija.');
    });
  });
});
