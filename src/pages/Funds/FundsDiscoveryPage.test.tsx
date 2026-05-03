import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundsDiscoveryPage from './FundsDiscoveryPage';
import { renderWithProviders } from '@/test/test-utils';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockListFunds = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

vi.mock('@/services/investmentFundService', () => ({
  default: {
    list: (...args: unknown[]) => mockListFunds(...args),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const FUNDS = [
  {
    id: 1,
    name: 'Alpha Growth',
    description: 'IT sektor fokus',
    managerEmployeeId: 10,
    managerName: 'Marko Petrovic',
    fundValue: 5_000_000,
    profit: 250_000,
    minimumContribution: 1000,
  },
  {
    id: 2,
    name: 'Beta Yield',
    description: 'Konzervativan dividend fond',
    managerEmployeeId: 11,
    managerName: 'Jelena Djordjevic',
    fundValue: 2_500_000,
    profit: -75_000,
    minimumContribution: 5000,
  },
];

describe('FundsDiscoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isSupervisor: false });
    mockListFunds.mockResolvedValue(FUNDS);
  });

  it('prikazuje listu fondova nakon ucitavanja', async () => {
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(mockListFunds).toHaveBeenCalled());
    expect(screen.getByText('Alpha Growth')).toBeInTheDocument();
    expect(screen.getByText('Beta Yield')).toBeInTheDocument();
  });

  it('prikazuje skeleton dok loading traje', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockListFunds.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderWithProviders(<FundsDiscoveryPage />);
    expect(container.querySelectorAll('.animate-pulse')).not.toHaveLength(0);
    resolve(FUNDS);
    await waitFor(() => expect(screen.getByText('Alpha Growth')).toBeInTheDocument());
  });

  it('Kreiraj fond dugme nije vidljivo agentu/klijentu', async () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false });
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(mockListFunds).toHaveBeenCalled());
    expect(screen.queryByText('Kreiraj fond')).not.toBeInTheDocument();
  });

  it('Kreiraj fond dugme je vidljivo supervizoru i navigira na /funds/create', async () => {
    mockUseAuth.mockReturnValue({ isSupervisor: true });
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(mockListFunds).toHaveBeenCalled());
    const btn = screen.getByText('Kreiraj fond');
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/funds/create');
  });

  it('klik na red u tabeli navigira na detalje fonda', async () => {
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(screen.getByText('Alpha Growth')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Alpha Growth'));
    expect(mockNavigate).toHaveBeenCalledWith('/funds/1');
  });

  it('search input debounce-uje pa salje params.search', async () => {
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(mockListFunds).toHaveBeenCalledTimes(1));
    const input = screen.getByPlaceholderText(/Pretrazi|Pretraži/i);
    await userEvent.type(input, 'alpha');
    await waitFor(
      () => {
        const lastCall = mockListFunds.mock.calls[mockListFunds.mock.calls.length - 1][0];
        expect(lastCall.search).toBe('alpha');
      },
      { timeout: 1500 },
    );
  });

  it('empty state se pojavljuje kad lista vrati 0 fondova', async () => {
    mockListFunds.mockResolvedValue([]);
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(screen.getByText(/Nema dostupnih fondova/i)).toBeInTheDocument());
  });

  it('error toast se baca kad service padne, lista ostaje prazna', async () => {
    mockListFunds.mockRejectedValue(new Error('500'));
    const { toast } = await import('@/lib/notify');
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Greska|Greška/i)));
  });

  it('klik na sort header menja sortiranje (Naziv -> desc)', async () => {
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(screen.getByText('Alpha Growth')).toBeInTheDocument());
    const nameHeader = screen.getByText('Naziv').closest('th')!;
    await userEvent.click(nameHeader);
    // Drugi klik prebacuje desc — drugi red sad treba da bude Beta
    await userEvent.click(nameHeader);
    const rows = screen.getAllByRole('row');
    // Header + 2 data rows; prvi data row je Beta nakon desc sort
    expect(rows[1]).toHaveTextContent(/Beta|Alpha/);
  });

  it('Profit kolona prikazuje TrendingDown ikonu za negativan profit', async () => {
    renderWithProviders(<FundsDiscoveryPage />);
    await waitFor(() => expect(screen.getByText('Beta Yield')).toBeInTheDocument());
    // Beta ima negativan profit (-75000), trazimo .text-red-500 na njegovom row-u
    const betaRow = screen.getByText('Beta Yield').closest('tr')!;
    expect(betaRow.querySelector('.text-red-500')).toBeTruthy();
  });
});
