import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtcOffersAndContractsPage from './OtcOffersAndContractsPage';

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

vi.mock('@/services/otcService', () => ({
  default: {
    listMyActiveOffers: vi.fn(),
    listMyContracts: vi.fn(),
    acceptOffer: vi.fn(),
    declineOffer: vi.fn(),
    counterOffer: vi.fn(),
    exerciseContract: vi.fn(),
  },
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

import otcService from '@/services/otcService';
import interbankOtcService from '@/services/interbankOtcService';
import { accountService } from '@/services/accountService';

const mockedOtcService = vi.mocked(otcService);
const mockedInterbankOtcService = vi.mocked(interbankOtcService);
const mockedAccountService = vi.mocked(accountService);

describe('OtcOffersAndContractsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedOtcService.listMyActiveOffers.mockResolvedValue([]);
    mockedOtcService.listMyContracts.mockResolvedValue([]);
    mockedInterbankOtcService.listMyContracts.mockResolvedValue([]);
    mockedAccountService.getMyAccounts.mockResolvedValue([] as never);
  });

  it('renders the local otc tabs by default and keeps the local view visible', async () => {
    render(<OtcOffersAndContractsPage />);

    expect(await screen.findByText('Moji aktivni pregovori')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sklopljeni ugovori \(inter-bank\)/i })).toBeInTheDocument();
    expect(mockedInterbankOtcService.listMyContracts).not.toHaveBeenCalled();
  });

  it('loads the remote contracts tab on demand', async () => {
    const user = userEvent.setup();
    render(<OtcOffersAndContractsPage />);

    await screen.findByText('Moji aktivni pregovori');
    await user.click(screen.getByRole('tab', { name: /Sklopljeni ugovori \(inter-bank\)/i }));

    await waitFor(() => {
      expect(mockedInterbankOtcService.listMyContracts).toHaveBeenCalledWith(undefined);
    });
    expect(await screen.findByText('Sklopljeni inter-bank ugovori')).toBeInTheDocument();
  });
});
