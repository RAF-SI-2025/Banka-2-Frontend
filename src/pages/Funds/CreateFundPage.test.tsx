import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateFundPage from './CreateFundPage';
import { renderWithProviders } from '../../test/test-utils';

const mockNavigate = vi.fn();
const mockCreate = vi.fn();
const mockUseAuth = vi.fn(() => ({ isSupervisor: true }));
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/investmentFundService', () => ({
  default: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('CreateFundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isSupervisor: true });
  });

  it('shows required validation errors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateFundPage />);

    await user.click(screen.getByRole('button', { name: /Kreiraj fond/i }));

    expect(await screen.findByText(/Naziv mora imati najmanje 3 karaktera/i)).toBeInTheDocument();
    expect(await screen.findByText(/Minimalna uplata mora biti veća od 0/i)).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('submits valid payload and navigates to details page', async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValueOnce({ id: 73 });
    renderWithProviders(<CreateFundPage />);

    await user.type(screen.getByLabelText(/Naziv fonda/i), 'Test Fond Alpha');
    await user.type(screen.getByLabelText(/Opis fonda/i), 'Test opis fonda');
    await user.clear(screen.getByLabelText(/Minimalna uplata \(RSD\)/i));
    await user.type(screen.getByLabelText(/Minimalna uplata \(RSD\)/i), '1000');
    await user.click(screen.getByRole('button', { name: /Kreiraj fond/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Test Fond Alpha',
        description: 'Test opis fonda',
        minimumContribution: 1000,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Fond kreiran');
      expect(mockNavigate).toHaveBeenCalledWith('/funds/73');
    });
  });

  it('redirects non-supervisor users to /funds with toast', async () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false });
    renderWithProviders(<CreateFundPage />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Nemate dozvolu za pristup ovoj stranici');
      expect(mockNavigate).toHaveBeenCalledWith('/funds');
    });
  });
});
