import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundWithdrawDialog from './FundWithdrawDialog';
import { renderWithProviders } from '@/test/test-utils';

const mockWithdraw = vi.fn();
const mockGetMyAccounts = vi.fn();
const mockToastSuccess = vi.fn();

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
    withdraw: (...args: unknown[]) => mockWithdraw(...args),
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
    error: vi.fn(),
  },
}));

describe('FundWithdrawDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyAccounts.mockResolvedValue([
      {
        id: 21,
        accountNumber: '265000000000000021',
        availableBalance: 100000,
        currency: 'RSD',
        status: 'ACTIVE',
      },
    ]);
  });

  it('shows pending message when withdraw is pending', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    mockWithdraw.mockResolvedValue({
      id: 1,
      amountRsd: 3000,
      status: 'PENDING',
    });

    renderWithProviders(
      <FundWithdrawDialog
        fundId={6}
        fundName="Beta"
        myPosition={{
          id: 1,
          fundId: 6,
          fundName: 'Beta',
          userId: 1,
          userRole: 'CLIENT',
          userName: 'Test',
          totalInvested: 9000,
          currentValue: 8000,
          percentOfFund: 3,
          profit: -1000,
          lastModifiedAt: new Date().toISOString(),
        }}
        open
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => expect(mockGetMyAccounts).toHaveBeenCalled());
    await user.type(screen.getByLabelText('Iznos (RSD)'), '3000');
    await user.click(screen.getByRole('button', { name: 'Povuci' }));

    await waitFor(() => expect(mockWithdraw).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Povlacenje ce biti obradjeno kad fond proda hartije.'
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
