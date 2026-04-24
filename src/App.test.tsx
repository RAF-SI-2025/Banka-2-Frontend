import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock heavy page components to keep tests fast
vi.mock('./pages/Landing/LandingPage', () => ({
  default: () => <div data-testid="landing-page">LandingPage</div>,
}));
vi.mock('./pages/Login/LoginPage', () => ({
  default: () => <div data-testid="login-page">LoginPage</div>,
}));
vi.mock('./pages/ForgotPassword/ForgotPasswordPage', () => ({
  default: () => <div data-testid="forgot-password-page">ForgotPasswordPage</div>,
}));
vi.mock('./pages/ResetPassword/ResetPasswordPage', () => ({
  default: () => <div data-testid="reset-password-page">ResetPasswordPage</div>,
}));
vi.mock('./pages/ActivateAccount/ActivateAccountPage', () => ({
  default: () => <div data-testid="activate-account-page">ActivateAccountPage</div>,
}));
vi.mock('./pages/Error/NotFoundPage', () => ({
  default: () => <div data-testid="not-found-page">NotFoundPage</div>,
}));
vi.mock('./pages/Error/ForbiddenPage', () => ({
  default: () => <div data-testid="forbidden-page">ForbiddenPage</div>,
}));
vi.mock('./pages/Error/ServerErrorPage', () => ({
  default: () => <div data-testid="server-error-page">ServerErrorPage</div>,
}));

// Mock all protected route pages
vi.mock('./pages/HomePage/HomePage', () => ({ default: () => <div>HomePage</div> }));
vi.mock('./pages/Accounts/AccountListPage', () => ({ default: () => <div>AccountListPage</div> }));
vi.mock('./pages/Accounts/AccountDetailsPage', () => ({ default: () => <div>AccountDetailsPage</div> }));
vi.mock('./pages/Accounts/BusinessAccountDetailsPage', () => ({ default: () => <div>BusinessAccountDetailsPage</div> }));
vi.mock('./pages/Payments/NewPaymentPage', () => ({ default: () => <div>NewPaymentPage</div> }));
vi.mock('./pages/Payments/PaymentHistoryPage', () => ({ default: () => <div>PaymentHistoryPage</div> }));
vi.mock('./pages/Payments/RecipientsPage', () => ({ default: () => <div>RecipientsPage</div> }));
vi.mock('./pages/Transfers/TransferPage', () => ({ default: () => <div>TransferPage</div> }));
vi.mock('./pages/Transfers/TransferHistoryPage', () => ({ default: () => <div>TransferHistoryPage</div> }));
vi.mock('./pages/Exchange/ExchangePage', () => ({ default: () => <div>ExchangePage</div> }));
vi.mock('./pages/Cards/CardListPage', () => ({ default: () => <div>CardListPage</div> }));
vi.mock('./pages/Loans/LoanListPage', () => ({ default: () => <div>LoanListPage</div> }));
vi.mock('./pages/Loans/LoanApplicationPage', () => ({ default: () => <div>LoanApplicationPage</div> }));
vi.mock('./pages/Employee/CreateAccountPage', () => ({ default: () => <div>CreateAccountPage</div> }));
vi.mock('./pages/Employee/AccountsPortalPage', () => ({ default: () => <div>AccountsPortalPage</div> }));
vi.mock('./pages/Employee/AccountCardsPage', () => ({ default: () => <div>AccountCardsPage</div> }));
vi.mock('./pages/Employee/ClientsPortalPage', () => ({ default: () => <div>ClientsPortalPage</div> }));
vi.mock('./pages/Employee/LoanRequestsPage', () => ({ default: () => <div>LoanRequestsPage</div> }));
vi.mock('./pages/Employee/AllLoansPage', () => ({ default: () => <div>AllLoansPage</div> }));
vi.mock('./pages/Employee/AccountRequestsPage', () => ({ default: () => <div>AccountRequestsPage</div> }));
vi.mock('./pages/Employee/CardRequestsPage', () => ({ default: () => <div>CardRequestsPage</div> }));
vi.mock('./pages/Securities/SecuritiesListPage', () => ({ default: () => <div>SecuritiesListPage</div> }));
vi.mock('./pages/Securities/SecuritiesDetailsPage', () => ({ default: () => <div>SecuritiesDetailsPage</div> }));
vi.mock('./pages/Orders/CreateOrderPage', () => ({ default: () => <div>CreateOrderPage</div> }));
vi.mock('./pages/Orders/OrdersListPage', () => ({ default: () => <div>OrdersListPage</div> }));
vi.mock('./pages/Orders/MyOrdersPage', () => ({ default: () => <div>MyOrdersPage</div> }));
vi.mock('./pages/Portfolio/PortfolioPage', () => ({ default: () => <div>PortfolioPage</div> }));
vi.mock('./pages/Actuary/ActuaryManagementPage', () => ({ default: () => <div>ActuaryManagementPage</div> }));
vi.mock('./pages/Tax/TaxPortalPage', () => ({ default: () => <div>TaxPortalPage</div> }));
vi.mock('./pages/Exchanges/ExchangesPage', () => ({ default: () => <div>ExchangesPage</div> }));
vi.mock('./pages/Margin/MarginAccountsPage', () => ({ default: () => <div>MarginAccountsPage</div> }));
vi.mock('./pages/Employee/SupervisorDashboardPage', () => ({ default: () => <div>SupervisorDashboardPage</div> }));
vi.mock('./pages/Admin/EmployeeListPage', () => ({ default: () => <div>EmployeeListPage</div> }));
vi.mock('./pages/Admin/EmployeeCreatePage', () => ({ default: () => <div>EmployeeCreatePage</div> }));
vi.mock('./pages/Admin/EmployeeEditPage', () => ({ default: () => <div>EmployeeEditPage</div> }));

// Mock layout components
vi.mock('./components/layout/MainLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    default: () => <div data-testid="main-layout"><Outlet /></div>,
  };
});

// Mock ProtectedRoute - controlled via mockIsAuthenticated / mockIsAdmin / mockIsEmployee
let mockIsAuthenticated = false;
let mockIsAdmin = false;
let mockIsEmployee = false;

vi.mock('./components/layout/ProtectedRoute', async () => {
  const { Navigate, Outlet } = await import('react-router-dom');
  return {
    default: ({ adminOnly, employeeOnly }: { adminOnly?: boolean; employeeOnly?: boolean }) => {
      if (!mockIsAuthenticated) return <Navigate to="/login" replace />;
      if (adminOnly && !mockIsAdmin) return <Navigate to="/403" replace />;
      if (employeeOnly && !mockIsAdmin && !mockIsEmployee) return <Navigate to="/403" replace />;
      return <Outlet />;
    },
  };
});

function renderApp(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

describe('App routing', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockIsAdmin = false;
    mockIsEmployee = false;
  });

  // ---------- Public routes ----------

  it('renders LandingPage at /', () => {
    renderApp('/');
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('renders LoginPage at /login', () => {
    renderApp('/login');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders ForgotPasswordPage at /forgot-password', () => {
    renderApp('/forgot-password');
    expect(screen.getByTestId('forgot-password-page')).toBeInTheDocument();
  });

  it('renders ResetPasswordPage at /reset-password', () => {
    renderApp('/reset-password');
    expect(screen.getByTestId('reset-password-page')).toBeInTheDocument();
  });

  it('renders ActivateAccountPage at /activate-account', () => {
    renderApp('/activate-account');
    expect(screen.getByTestId('activate-account-page')).toBeInTheDocument();
  });

  // ---------- Error pages ----------

  it('renders ForbiddenPage at /403', () => {
    renderApp('/403');
    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
  });

  it('renders ServerErrorPage at /500', () => {
    renderApp('/500');
    expect(screen.getByTestId('server-error-page')).toBeInTheDocument();
  });

  it('renders NotFoundPage for unknown routes', () => {
    renderApp('/some-unknown-route');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });

  // ---------- Protected routes redirect when not authenticated ----------

  it('redirects /home to /login when not authenticated', () => {
    renderApp('/home');
    // Should redirect to login
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('redirects /accounts to /login when not authenticated', () => {
    renderApp('/accounts');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('redirects /cards to /login when not authenticated', () => {
    renderApp('/cards');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  // ---------- Protected routes render when authenticated ----------

  it('renders HomePage at /home when authenticated', () => {
    mockIsAuthenticated = true;
    renderApp('/home');
    expect(screen.getByText('HomePage')).toBeInTheDocument();
  });

  it('renders AccountListPage at /accounts when authenticated', () => {
    mockIsAuthenticated = true;
    renderApp('/accounts');
    expect(screen.getByText('AccountListPage')).toBeInTheDocument();
  });

  it('renders CardListPage at /cards when authenticated', () => {
    mockIsAuthenticated = true;
    renderApp('/cards');
    expect(screen.getByText('CardListPage')).toBeInTheDocument();
  });

  it('redirects /dashboard to /home', () => {
    mockIsAuthenticated = true;
    renderApp('/dashboard');
    expect(screen.getByText('HomePage')).toBeInTheDocument();
  });

  // ---------- Admin-only routes ----------

  it('redirects admin routes to /403 when not admin', () => {
    mockIsAuthenticated = true;
    mockIsAdmin = false;
    renderApp('/admin/employees');
    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
  });

  it('renders admin pages when user is admin', () => {
    mockIsAuthenticated = true;
    mockIsAdmin = true;
    renderApp('/admin/employees');
    expect(screen.getByText('EmployeeListPage')).toBeInTheDocument();
  });

  it('renders employee portal when user is admin', () => {
    mockIsAuthenticated = true;
    mockIsAdmin = true;
    renderApp('/employee/clients');
    expect(screen.getByText('ClientsPortalPage')).toBeInTheDocument();
  });

  it('redirects employee routes to /403 for non-admin users', () => {
    mockIsAuthenticated = true;
    mockIsAdmin = false;
    renderApp('/employee/accounts');
    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
  });
});
