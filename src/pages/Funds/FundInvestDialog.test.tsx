import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundInvestDialog from './FundInvestDialog';
import { renderWithProviders } from '@/test/test-utils';

const mockInvest = vi.fn();
const mockGetMyAccounts = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({
      isSupervisor: false,
    }),
  };
});

vi.mock('@/services/investmentFundService', () => ({
  default: {
    invest: (...args: unknown[]) => mockInvest(...args),
  },
}));

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: (...args: unknown[]) => mockGetMyAccounts(...args),
    getBankAccounts: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('FundInvestDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyAccounts.mockResolvedValue([
      {
        id: 11,
        accountNumber: '265000000000000011',
        availableBalance: 200000,
        currency: 'RSD',
        status: 'ACTIVE',
      },
    ]);
    mockInvest.mockResolvedValue({ id: 1, fundId: 5 });
  });

  it('submits valid invest request', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderWithProviders(
      <FundInvestDialog
        fundId={5}
        fundName="Alpha"
        minimumContribution={1000}
        open
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => expect(mockGetMyAccounts).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByLabelText('Valuta')).toHaveValue('RSD');
    });
    await user.type(screen.getByLabelText('Iznos (RSD)'), '5000');
    await user.click(screen.getByRole('button', { name: 'Uplati' }));

    await waitFor(() => {
      expect(mockInvest).toHaveBeenCalledWith(5, {
        amount: 5000,
        currency: 'RSD',
        sourceAccountId: 11,
      });
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
