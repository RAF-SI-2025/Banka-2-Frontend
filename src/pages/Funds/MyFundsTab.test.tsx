import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MyFundsTab from './MyFundsTab';
import { renderWithProviders } from '@/test/test-utils';

const mockUseAuth = vi.fn();
const mockMyPositions = vi.fn();
const mockGetFund = vi.fn();
const mockListFunds = vi.fn();

vi.mock('@/context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

vi.mock('@/services/investmentFundService', () => ({
  default: {
    myPositions: (...args: unknown[]) => mockMyPositions(...args),
    get: (...args: unknown[]) => mockGetFund(...args),
    list: (...args: unknown[]) => mockListFunds(...args),
  },
}));

vi.mock('./FundInvestDialog', () => ({
  default: () => null,
}));

vi.mock('./FundWithdrawDialog', () => ({
  default: () => null,
}));

describe('MyFundsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders client fund position data', async () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, user: { id: 10 } });
    mockMyPositions.mockResolvedValue([
      {
        id: 1,
        fundId: 100,
        fundName: 'Alpha Fund',
        userId: 5,
        userRole: 'CLIENT',
        userName: 'Client',
        totalInvested: 10000,
        currentValue: 12000,
        percentOfFund: 1.2,
        profit: 2000,
        lastModifiedAt: new Date().toISOString(),
      },
    ]);
    mockGetFund.mockResolvedValue({
      id: 100,
      name: 'Alpha Fund',
      description: 'Opis fonda',
      managerEmployeeId: 2,
      managerName: 'Manager',
      fundValue: 500000,
      liquidAmount: 100000,
      profit: 20000,
      minimumContribution: 1000,
      accountNumber: '265',
      holdings: [],
      performance: [],
      inceptionDate: new Date().toISOString(),
    });

    renderWithProviders(<MyFundsTab />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Fund')).toBeInTheDocument();
    });
    expect(screen.getByText('Uplati')).toBeInTheDocument();
    expect(screen.getByText('Povuci')).toBeInTheDocument();
  });

  it('renders supervisor managed funds table', async () => {
    mockUseAuth.mockReturnValue({ isSupervisor: true, user: { id: 55 } });
    mockListFunds.mockResolvedValue([{ id: 201 }, { id: 202 }]);
    mockGetFund.mockImplementation(async (id: number) => ({
      id,
      name: `Fund ${id}`,
      description: 'Desc',
      managerEmployeeId: id === 201 ? 55 : 99,
      managerName: 'Manager',
      fundValue: 500000,
      liquidAmount: 100000,
      profit: 20000,
      minimumContribution: 1000,
      accountNumber: '265',
      holdings: [],
      performance: [],
      inceptionDate: new Date().toISOString(),
    }));

    renderWithProviders(<MyFundsTab />);

    await waitFor(() => {
      expect(screen.getByText('Fund 201')).toBeInTheDocument();
    });
    expect(screen.queryByText('Fund 202')).not.toBeInTheDocument();
    expect(screen.getByText('Likvidnost')).toBeInTheDocument();
  });
});
