import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeeListPage from './EmployeeListPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Employee, PaginatedResponse } from '../../types';
import { Permission } from '../../types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetAll = vi.fn();

vi.mock('../../services/employeeService', () => ({
  employeeService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}));

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 999, email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: () => true,
      isAdmin: true,
    }),
  };
});

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    firstName: 'Marko',
    lastName: 'Petrovic',
    username: 'marko.petrovic',
    email: 'marko.petrovic@banka.rs',
    position: 'Software Developer',
    phoneNumber: '+381601234567',
    isActive: true,
    permissions: [],
    address: 'Beograd',
    dateOfBirth: '1990-05-15',
    gender: 'M',
    department: 'IT',
    ...overrides,
  };
}

function makePaginatedResponse(employees: Employee[]): PaginatedResponse<Employee> {
  return {
    content: employees,
    totalElements: employees.length,
    totalPages: 1,
    size: 10,
    number: 0,
  };
}

describe('EmployeeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading skeleton initially', () => {
    mockGetAll.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<EmployeeListPage />);

    // Skeleton rows have animate-pulse elements
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('renders employee table after loading', async () => {
    const employees = [
      makeEmployee({ id: 1, firstName: 'Marko', lastName: 'Petrovic' }),
      makeEmployee({ id: 2, firstName: 'Ana', lastName: 'Jovanovic', isActive: false }),
    ];
    mockGetAll.mockResolvedValue(makePaginatedResponse(employees));
    renderWithProviders(<EmployeeListPage />);

    // Advance debounce timer
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });
    expect(screen.getByText('Ana Jovanovic')).toBeInTheDocument();
  });

  it('renders page header', async () => {
    mockGetAll.mockResolvedValue(makePaginatedResponse([]));
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/upravljanje zaposlenima/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no employees', async () => {
    mockGetAll.mockResolvedValue(makePaginatedResponse([]));
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/nema pronadjenih zaposlenih/i)).toBeInTheDocument();
    });
  });

  it('shows error alert on fetch failure', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/greska pri ucitavanju zaposlenih/i)).toBeInTheDocument();
    });
  });

  it('shows stats bar with counts', async () => {
    const employees = [
      makeEmployee({ id: 1, isActive: true }),
      makeEmployee({ id: 2, isActive: true }),
      makeEmployee({ id: 3, isActive: false }),
    ];
    mockGetAll.mockResolvedValue(makePaginatedResponse(employees));
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText('Ukupno')).toBeInTheDocument();
    });
    expect(screen.getByText('Aktivni')).toBeInTheDocument();
    expect(screen.getByText('Neaktivni')).toBeInTheDocument();
  });

  it('navigates to create page when button is clicked', async () => {
    mockGetAll.mockResolvedValue(makePaginatedResponse([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/novi zaposleni/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/novi zaposleni/i));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/employees/new');
  });

  it('shows filter card when filter button is clicked', async () => {
    mockGetAll.mockResolvedValue(makePaginatedResponse([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByTitle('Filteri')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Filteri'));

    expect(screen.getByPlaceholderText(/pretraga po email-u/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pretraga po imenu/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pretraga po prezimenu/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pretraga po poziciji/i)).toBeInTheDocument();
  });

  it('filters trigger new API call', async () => {
    mockGetAll.mockResolvedValue(makePaginatedResponse([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
    });

    // Open filters
    await user.click(screen.getByTitle('Filteri'));

    const initialCalls = mockGetAll.mock.calls.length;

    // Type in the email filter
    await user.type(screen.getByPlaceholderText(/pretraga po email-u/i), 'test');

    // Advance debounce
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockGetAll.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('admin rows are not clickable and have no edit button', async () => {
    const adminEmployee = makeEmployee({
      id: 1,
      firstName: 'Admin',
      lastName: 'User',
      permissions: [Permission.ADMIN],
    });
    mockGetAll.mockResolvedValue(makePaginatedResponse([adminEmployee]));
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Admin badge should be rendered
    expect(screen.getByText('Admin')).toBeInTheDocument();

    // The row should not have a clickable edit button
    const row = screen.getByText('Admin User').closest('tr');
    expect(row).toBeTruthy();
    const editButton = within(row!).queryByTitle(/izmeni zaposlenog/i);
    expect(editButton).not.toBeInTheDocument();
  });

  it('non-admin rows navigate on click', async () => {
    const employee = makeEmployee({ id: 5, firstName: 'Petar', lastName: 'Markovic' });
    mockGetAll.mockResolvedValue(makePaginatedResponse([employee]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText('Petar Markovic')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Petar Markovic'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/employees/5');
  });

  it('pagination info shows correct range', async () => {
    const employees = Array.from({ length: 3 }, (_, i) =>
      makeEmployee({ id: i + 1, firstName: `Emp${i}`, lastName: 'Test' })
    );
    mockGetAll.mockResolvedValue({
      content: employees,
      totalElements: 25,
      totalPages: 3,
      size: 10,
      number: 0,
    });
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/1-10 od 25/)).toBeInTheDocument();
    });
  });

  it('shows active/inactive status badges for employees', async () => {
    const employees = [
      makeEmployee({ id: 1, firstName: 'Active', lastName: 'User', isActive: true }),
      makeEmployee({ id: 2, firstName: 'Inactive', lastName: 'User', isActive: false }),
    ];
    mockGetAll.mockResolvedValue(makePaginatedResponse(employees));
    renderWithProviders(<EmployeeListPage />);
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText('Active User')).toBeInTheDocument();
    });
    expect(screen.getByText('Aktivan')).toBeInTheDocument();
    expect(screen.getByText('Neaktivan')).toBeInTheDocument();
  });
});
