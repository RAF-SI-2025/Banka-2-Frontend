import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivateAccountPage from './ActivateAccountPage';
import { renderWithProviders } from '../../test/test-utils';

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

const mockActivateAccount = vi.fn();
const mockGetTokenStatus = vi.fn();
const mockResendActivation = vi.fn();

vi.mock('../../services/authService', () => ({
  authService: {
    activateAccount: (...args: unknown[]) => mockActivateAccount(...args),
    getActivationTokenStatus: (...args: unknown[]) => mockGetTokenStatus(...args),
    resendActivation: (...args: unknown[]) => mockResendActivation(...args),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/notify', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

/**
 * Helper koji setuje VALID status (default ponasanje za testove koji ocekuju
 * formu). Bug Sc 9 (12.05.2026): pre renderovanja forme FE proverava status
 * tokena — VALID = renderuj formu, USED/EXPIRED/INVALID/ALREADY_ACTIVE =
 * renderuj odgovarajucu stanu poruku.
 */
function mockValidToken() {
  mockGetTokenStatus.mockResolvedValueOnce({
    status: 'VALID',
    expiresAt: '2026-05-13T20:00:00',
    email: 'novi.zaposleni@banka.rs',
  });
}

describe('ActivateAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('shows invalid message when no token in URL', async () => {
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByTestId('activation-token-invalid')).toBeInTheDocument();
    });
    expect(screen.getByText(/nevazeci link za aktivaciju/i)).toBeInTheDocument();
  });

  it('renders activation form when token is VALID', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/aktivacija naloga/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/potvrdite lozinku/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aktiviraj nalog/i })).toBeInTheDocument();
  });

  it('shows password constraint info when form rendered', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByText(/8-32 karaktera/i)).toBeInTheDocument();
    });
  });

  it('validates password - shows error on empty submit', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aktiviraj nalog/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText(/najmanje 8 karaktera/i)).toBeInTheDocument();
    });
  });

  it('validates password mismatch', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'ValidPass12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'Mismatch12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText(/lozinke se ne poklapaju/i)).toBeInTheDocument();
    });
  });

  it('validates password needs uppercase', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'nouppercase12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'nouppercase12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText(/veliko slovo/i)).toBeInTheDocument();
    });
  });

  it('calls activateAccount service with token and password', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    mockActivateAccount.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'ValidPass12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'ValidPass12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(mockActivateAccount).toHaveBeenCalledWith({
        token: 'activation-token-abc',
        password: 'ValidPass12',
      });
    });
  });

  it('shows success message after activation', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    mockActivateAccount.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'ValidPass12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'ValidPass12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText(/nalog uspesno aktiviran/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /idi na prijavu/i })).toBeInTheDocument();
  });

  it('navigates to login from success view', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    mockActivateAccount.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'ValidPass12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'ValidPass12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText(/nalog uspesno aktiviran/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /idi na prijavu/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows server error on failed activation when token is VALID at mount but BE rejects', async () => {
    mockSearchParams = new URLSearchParams('token=valid-token');
    mockValidToken();
    mockActivateAccount.mockRejectedValueOnce({
      response: { data: { message: 'Nesto je puklo' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'ValidPass12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'ValidPass12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText('Nesto je puklo')).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    mockSearchParams = new URLSearchParams('token=activation-token-abc');
    mockValidToken();
    mockActivateAccount.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/nova lozinka/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/nova lozinka/i), 'ValidPass12');
    await user.type(screen.getByLabelText(/potvrdite lozinku/i), 'ValidPass12');
    await user.click(screen.getByRole('button', { name: /aktiviraj nalog/i }));

    await waitFor(() => {
      expect(screen.getByText('Aktivacija...')).toBeInTheDocument();
    });
  });

  // Bug Sc 9 (12.05.2026) novi testovi: pre-check stanja tokena.

  it('shows USED state when activation token already consumed', async () => {
    mockSearchParams = new URLSearchParams('token=already-used-token');
    mockGetTokenStatus.mockResolvedValueOnce({
      status: 'USED',
      expiresAt: '2026-05-13T20:00:00',
      email: 'aktivirao@banka.rs',
    });
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByTestId('activation-token-used')).toBeInTheDocument();
    });
    // Naslov "Link je vec iskoriscen" se pojavljuje u CardTitle; description
    // takodje sadrzi "iskoriscen" pa koristimo getAllByText i proverimo >= 1.
    expect(screen.getAllByText(/iskoriscen/i).length).toBeGreaterThan(0);
    // Forma ne sme da postoji
    expect(screen.queryByLabelText(/nova lozinka/i)).not.toBeInTheDocument();
  });

  it('shows EXPIRED state when activation token expired', async () => {
    mockSearchParams = new URLSearchParams('token=expired-token');
    mockGetTokenStatus.mockResolvedValueOnce({
      status: 'EXPIRED',
      expiresAt: '2026-05-01T20:00:00',
      email: null,
    });
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByTestId('activation-token-expired')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/istekao/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/nova lozinka/i)).not.toBeInTheDocument();
    // Spec Sc 9: EXPIRED ekran nudi "Posalji novi link" dugme.
    expect(screen.getByRole('button', { name: /posalji novi link/i })).toBeInTheDocument();
  });

  // Spec Celina 1 Sc 9: resend activation link sa EXPIRED ekrana.

  it('resends activation link and shows success toast on EXPIRED screen', async () => {
    mockSearchParams = new URLSearchParams('token=expired-token');
    mockGetTokenStatus.mockResolvedValueOnce({
      status: 'EXPIRED',
      expiresAt: '2026-05-01T20:00:00',
      email: null,
    });
    mockResendActivation.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /posalji novi link/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /posalji novi link/i }));

    await waitFor(() => {
      expect(mockResendActivation).toHaveBeenCalledWith('expired-token');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Novi aktivacioni link je poslat ako nalog postoji.',
    );
    // Posle slanja dugme se disable-uje i menja u "Link je poslat".
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /link je poslat/i })).toBeDisabled();
    });
  });

  it('shows error toast when resend fails', async () => {
    mockSearchParams = new URLSearchParams('token=expired-token');
    mockGetTokenStatus.mockResolvedValueOnce({
      status: 'EXPIRED',
      expiresAt: '2026-05-01T20:00:00',
      email: null,
    });
    mockResendActivation.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /posalji novi link/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /posalji novi link/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // Greska ne disable-uje dugme trajno — korisnik moze ponovo da pokusa.
    expect(screen.getByRole('button', { name: /posalji novi link/i })).not.toBeDisabled();
  });

  it('shows ALREADY_ACTIVE state when account already activated', async () => {
    mockSearchParams = new URLSearchParams('token=stale-token');
    mockGetTokenStatus.mockResolvedValueOnce({
      status: 'ALREADY_ACTIVE',
      expiresAt: '2026-05-13T20:00:00',
      email: 'aktivan@banka.rs',
    });
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByTestId('activation-already-active')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/aktivan|aktiviran/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/nova lozinka/i)).not.toBeInTheDocument();
  });

  it('shows INVALID state when BE returns INVALID', async () => {
    mockSearchParams = new URLSearchParams('token=garbage-token');
    mockGetTokenStatus.mockResolvedValueOnce({
      status: 'INVALID',
      expiresAt: null,
      email: null,
    });
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByTestId('activation-token-invalid')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/nova lozinka/i)).not.toBeInTheDocument();
  });

  it('shows INVALID state when token status check throws', async () => {
    mockSearchParams = new URLSearchParams('token=broken');
    mockGetTokenStatus.mockRejectedValueOnce(new Error('network down'));
    renderWithProviders(<ActivateAccountPage />);

    await waitFor(() => {
      expect(screen.getByTestId('activation-token-invalid')).toBeInTheDocument();
    });
  });
});
