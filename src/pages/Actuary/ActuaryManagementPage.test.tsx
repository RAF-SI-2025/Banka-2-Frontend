import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActuaryManagementPage from './ActuaryManagementPage';
import { renderWithProviders } from '../../test/test-utils';
import type { ActuaryInfo } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAgents: ActuaryInfo[] = [
  {
    id: 1,
    employeeId: 10,
    employeeName: 'Marko Petrovic',
    employeeEmail: 'marko@banka.rs',
    employeePosition: 'Agent',
    actuaryType: 'AGENT',
    dailyLimit: 100000,
    usedLimit: 35000,
    needApproval: false,
  },
  {
    id: 2,
    employeeId: 20,
    employeeName: 'Ana Jovanovic',
    employeeEmail: 'ana@banka.rs',
    employeePosition: 'Supervizor',
    actuaryType: 'SUPERVISOR',
    dailyLimit: 500000,
    usedLimit: 120000,
    needApproval: true,
  },
];

const mockGetAgents = vi.fn().mockResolvedValue(mockAgents);
const mockUpdateLimit = vi.fn().mockResolvedValue({ ...mockAgents[0], dailyLimit: 200000 });
const mockResetLimit = vi.fn().mockResolvedValue({ ...mockAgents[0], usedLimit: 0 });

vi.mock('../../services/actuaryService', () => ({
  default: {
    getAgents: (...args: unknown[]) => mockGetAgents(...args),
    updateLimit: (...args: unknown[]) => mockUpdateLimit(...args),
    resetLimit: (...args: unknown[]) => mockResetLimit(...args),
  },
}));

describe('ActuaryManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgents.mockResolvedValue(mockAgents);
  });

  it('renders the page header', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Upravljanje aktuarima')).toBeInTheDocument();
    });
  });

  it('renders agent list after loading', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('marko@banka.rs')).toBeInTheDocument();
    });

    expect(screen.getByText('ana@banka.rs')).toBeInTheDocument();
  });

  it('renders agent names split into first/last', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko')).toBeInTheDocument();
    });

    expect(screen.getByText('Petrovic')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Jovanovic')).toBeInTheDocument();
  });

  it('renders actuary type badges', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    expect(screen.getByText('Supervizor')).toBeInTheDocument();
  });

  it('renders table headers', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Ime')).toBeInTheDocument();
    });

    expect(screen.getByText('Prezime')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Pozicija')).toBeInTheDocument();
    expect(screen.getByText('Limit')).toBeInTheDocument();
    expect(screen.getByText('Iskorisceno')).toBeInTheDocument();
    expect(screen.getByText('Need Approval')).toBeInTheDocument();
  });

  it('renders edit limit buttons for each agent', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByTitle('Izmeni limit');
      expect(editButtons.length).toBe(2);
    });
  });

  it('renders reset limit buttons for each agent', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      const resetButtons = screen.getAllByText('Resetuj limit');
      expect(resetButtons.length).toBe(2);
    });
  });

  it('opens edit dialog when clicking edit button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Izmeni limit').length).toBe(2);
    });

    await user.click(screen.getAllByTitle('Izmeni limit')[0]);

    await waitFor(() => {
      expect(screen.getByText(/dnevni limit/i)).toBeInTheDocument();
    });
  });

  it('calls resetLimit after confirming in dialog (R1 561 — ConfirmDialog)', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Resetuj limit').length).toBe(2);
    });

    await user.click(screen.getAllByText('Resetuj limit')[0]);
    // ConfirmDialog se otvara — potvrdi.
    await user.click(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(mockResetLimit).toHaveBeenCalledWith(10);
    });
  });

  it('does not call resetLimit when dialog is cancelled', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Resetuj limit').length).toBe(2);
    });

    await user.click(screen.getAllByText('Resetuj limit')[0]);
    await user.click(await screen.findByRole('button', { name: 'Otkazi' }));

    expect(mockResetLimit).not.toHaveBeenCalled();
  });

  it('shows loading skeletons while loading', () => {
    mockGetAgents.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ActuaryManagementPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no agents found', async () => {
    mockGetAgents.mockResolvedValue([]);

    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema pronadjenih agenata')).toBeInTheDocument();
    });
  });

  it('shows error alert when loading fails', async () => {
    mockGetAgents.mockRejectedValue(new Error('fail'));

    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Greska pri ucitavanju aktuarnih podataka/i)).toBeInTheDocument();
    });
  });

  it('renders filter toggle button', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByTitle('Filteri')).toBeInTheDocument();
    });
  });

  it('shows filter inputs when toggle is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByTitle('Filteri')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Filteri'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Pretraga po email-u')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Pretraga po imenu')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Pretraga po prezimenu')).toBeInTheDocument();
    });
  });

  it('renders refresh button', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Osvezi')).toBeInTheDocument();
    });
  });

  it('displays usage progress bar for each agent', async () => {
    renderWithProviders(<ActuaryManagementPage />);

    await waitFor(() => {
      // Check that usage percentages are displayed
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('24%')).toBeInTheDocument();
    });
  });
});
