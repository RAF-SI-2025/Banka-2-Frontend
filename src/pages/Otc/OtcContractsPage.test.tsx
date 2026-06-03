import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from '@/lib/notify';
import OtcContractsPage from './OtcContractsPage';

const mockListContracts = vi.fn();
const mockExercise = vi.fn();
vi.mock('@/services/otcService', () => ({
  default: {
    listMyContracts: (...a: unknown[]) => mockListContracts(...a),
    exerciseContract: (...a: unknown[]) => mockExercise(...a),
  },
}));
vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));
vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn().mockResolvedValue([
      { id: 1, status: 'ACTIVE', currency: 'USD', accountNumber: '222000111' },
    ]),
    getBankAccounts: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, isAdmin: false, isAgent: false, isSupervisor: false }),
}));
vi.mock('./OtcInterBankContractsTab', () => ({
  default: () => <div data-testid="inter-bank-contracts">[InterBank Contracts]</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListContracts.mockResolvedValue([
    {
      id: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
      buyerId: 1, buyerName: 'Stefan', sellerId: 2, sellerName: 'Milica',
      quantity: 5, strikePrice: 100, premium: 10, currentPrice: 100,
      settlementDate: '2026-06-04', status: 'ACTIVE',
      createdAt: '2026-05-09T10:00:00',
    },
  ]);
});

describe('OtcContractsPage', () => {
  it('renders 2 filter chip lines (source + status)', async () => {
    render(<MemoryRouter><OtcContractsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Iz nase banke/i));
    // Source chip "Sve" — exact match
    expect(screen.getByRole('button', { name: /^Sve$/i })).toBeInTheDocument();
    // Status chip "Svi" — exact match
    expect(screen.getByRole('button', { name: /^Svi$/i })).toBeInTheDocument();
  });

  it('shows Iskoristi button only for buyer', async () => {
    render(<MemoryRouter><OtcContractsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));
    expect(screen.getByRole('button', { name: /Iskoristi/i })).toBeInTheDocument();
  });

  // P0-F1/N1 — exercise lazni uspeh
  it('shows SUCCESS toast when SAGA completes (sagaStatus=COMPLETED, status=EXERCISED)', async () => {
    mockExercise.mockResolvedValue({
      sagaId: 's1', sagaStatus: 'COMPLETED', currentStep: 5, id: 1, status: 'EXERCISED',
    });
    const user = userEvent.setup();
    render(<MemoryRouter><OtcContractsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));

    await user.click(screen.getByRole('button', { name: /Iskoristi/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('iskoriscen'),
      );
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does NOT show success on SAGA rollback (sagaStatus=COMPENSATED, status=ACTIVE)', async () => {
    mockExercise.mockResolvedValue({
      sagaId: 's2', sagaStatus: 'COMPENSATED', currentStep: 3, id: 1, status: 'ACTIVE',
    });
    const user = userEvent.setup();
    render(<MemoryRouter><OtcContractsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));

    await user.click(screen.getByRole('button', { name: /Iskoristi/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('rollback'),
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  // R1 481: "Iskoristi" je onemoguceno kad je settlementDate prosao i klik ne poziva exercise.
  it('disables Iskoristi i ne poziva exercise kad je settlement prosao', async () => {
    mockListContracts.mockResolvedValue([
      {
        id: 2, listingTicker: 'AAPL', listingName: 'Apple Inc.', listingCurrency: 'USD',
        buyerId: 1, buyerName: 'Stefan', sellerId: 2, sellerName: 'Milica',
        quantity: 5, strikePrice: 100, premium: 10, currentPrice: 100,
        settlementDate: '2020-01-01', status: 'ACTIVE', // prosao
        createdAt: '2019-12-01T10:00:00',
      },
    ]);
    const user = userEvent.setup();
    render(<MemoryRouter><OtcContractsPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));

    const exerciseBtn = screen.getByRole('button', { name: /Iskoristi/i });
    expect(exerciseBtn).toBeDisabled();
    await user.click(exerciseBtn);
    expect(mockExercise).not.toHaveBeenCalled();
  });
});
