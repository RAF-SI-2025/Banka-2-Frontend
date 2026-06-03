import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import { Permission } from '../types';

// ---------------------------------------------------------------------------
// Mock useAuth
// ---------------------------------------------------------------------------
const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderRoute(
  props: {
    adminOnly?: boolean;
    employeeOnly?: boolean;
    supervisorOnly?: boolean;
    noAgentOnly?: boolean;
    tradeGate?: boolean;
    requiredPermission?: Permission;
  } = {},
  initialPath = '/protected'
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute {...props} />}>
          <Route path="/protected" element={<div data-testid="child">Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        <Route path="/403" element={<div data-testid="forbidden-page">Forbidden</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders auth loading splash while loading (spec UX polish)', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      hasPermission: () => false,
      isAdmin: false,
    });

    renderRoute();
    // Splash sa gradient halo + spinner umesto null/blank UI
    expect(screen.getByTestId('auth-loading-splash')).toBeInTheDocument();
    expect(screen.getByText(/Ucitavanje sesije/i)).toBeInTheDocument();
  });

  it('redirects to /login if no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
    });

    renderRoute();
    expect(screen.getByTestId('login-page')).toBeTruthy();
  });

  it('redirects to /403 if adminOnly and user is not admin', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
    });

    renderRoute({ adminOnly: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('renders children if user is admin on adminOnly route', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.ADMIN,
      isAdmin: true,
    });

    renderRoute({ adminOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByTestId('child').textContent).toBe('Protected Content');
  });

  it('renders children for authenticated user without special requirements', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
    });

    renderRoute();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('redirects to /403 if requiredPermission is not met', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
    });

    renderRoute({ requiredPermission: Permission.ADMIN });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('renders children when requiredPermission is met', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.ADMIN,
      isAdmin: true,
    });

    renderRoute({ requiredPermission: Permission.ADMIN });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Edge cases: permission-based routing
  // ---------------------------------------------------------------------------

  it('redirects to /403 when user has TRADE_STOCKS but route requires ADMIN', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'broker@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.TRADE_STOCKS,
      isAdmin: false,
    });

    renderRoute({ requiredPermission: Permission.ADMIN });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('renders children when user has TRADE_STOCKS and route requires TRADE_STOCKS', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'broker@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.TRADE_STOCKS,
      isAdmin: false,
    });

    renderRoute({ requiredPermission: Permission.TRADE_STOCKS });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders children when user has multiple permissions and route requires one of them', () => {
    const userPermissions = [Permission.ADMIN, Permission.TRADE_STOCKS, Permission.VIEW_STOCKS];
    mockUseAuth.mockReturnValue({
      user: {
        email: 'superuser@banka.rs',
        role: 'ADMIN',
        permissions: userPermissions,
      },
      isLoading: false,
      hasPermission: (p: Permission) => userPermissions.includes(p),
      isAdmin: true,
    });

    renderRoute({ requiredPermission: Permission.VIEW_STOCKS });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('redirects to /403 when user has multiple permissions but not the required one', () => {
    const userPermissions = [Permission.VIEW_STOCKS, Permission.TRADE_STOCKS];
    mockUseAuth.mockReturnValue({
      user: {
        email: 'broker@banka.rs',
        role: 'EMPLOYEE',
        permissions: userPermissions,
      },
      isLoading: false,
      hasPermission: (p: Permission) => userPermissions.includes(p),
      isAdmin: false,
    });

    renderRoute({ requiredPermission: Permission.CREATE_CONTRACTS });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('allows admin to access adminOnly route even without requiredPermission', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isLoading: false,
      hasPermission: () => true,
      isAdmin: true,
    });

    renderRoute({ adminOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders loading splash during loading even when user data exists (isLoading takes priority)', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isLoading: true,
      hasPermission: () => true,
      isAdmin: true,
    });

    renderRoute();
    // isLoading takes priority — splash is rendered, not the protected child
    expect(screen.getByTestId('auth-loading-splash')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('redirects to /login when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
    });

    renderRoute();
    expect(screen.getByTestId('login-page')).toBeTruthy();
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('renders children when no props are passed and user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
    });

    // No adminOnly, no requiredPermission
    renderRoute({});
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('checks adminOnly before requiredPermission (non-admin blocked even with permission)', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'employee@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.TRADE_STOCKS,
      isAdmin: false,
    });

    // adminOnly = true, but user is not admin => /403 regardless of permission
    renderRoute({ adminOnly: true, requiredPermission: Permission.TRADE_STOCKS });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // supervisorOnly — Celina 3 supervisor portali + Celina 4 (Nova) Profit Banke
  // ---------------------------------------------------------------------------

  it('redirects to /403 when supervisorOnly and user is plain agent', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'agent@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.AGENT, Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => [Permission.AGENT, Permission.TRADE_STOCKS].includes(p),
      isAdmin: false,
      isSupervisor: false,
      isAgent: true,
    });

    renderRoute({ supervisorOnly: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('renders children when supervisorOnly and user is supervisor (not admin)', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'supervisor@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.SUPERVISOR, Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => [Permission.SUPERVISOR, Permission.TRADE_STOCKS].includes(p),
      isAdmin: false,
      isSupervisor: true,
      isAgent: false,
    });

    renderRoute({ supervisorOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders children when supervisorOnly and user is admin (admins are supervisors per spec)', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.ADMIN,
      isAdmin: true,
      isSupervisor: true,
      isAgent: false,
    });

    renderRoute({ supervisorOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('redirects to /403 when supervisorOnly and user is plain client', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });

    renderRoute({ supervisorOnly: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // noAgentOnly — Celina 4 (Nova) §137-141 OTC pristup (klijent + supervizor da, agent ne)
  // ---------------------------------------------------------------------------

  it('redirects to /403 when noAgentOnly and user is plain agent', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'agent@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.AGENT, Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => [Permission.AGENT, Permission.TRADE_STOCKS].includes(p),
      isAdmin: false,
      isSupervisor: false,
      isAgent: true,
    });

    renderRoute({ noAgentOnly: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('renders children when noAgentOnly and user is client', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [Permission.TRADE_STOCKS] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.TRADE_STOCKS,
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });

    renderRoute({ noAgentOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders children when noAgentOnly and user is supervisor', () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: 'supervisor@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.SUPERVISOR],
      },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.SUPERVISOR,
      isAdmin: false,
      isSupervisor: true,
      isAgent: false,
    });

    renderRoute({ noAgentOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders children when noAgentOnly and user is dual-role agent+supervisor', () => {
    // Edge case: user koji je i AGENT i SUPERVISOR (npr. supervisor postavljen za agenta)
    // — supervisor-status pobedjuje, ima OTC pristup
    mockUseAuth.mockReturnValue({
      user: {
        email: 'dual@banka.rs',
        role: 'EMPLOYEE',
        permissions: [Permission.AGENT, Permission.SUPERVISOR],
      },
      isLoading: false,
      hasPermission: (p: Permission) => [Permission.AGENT, Permission.SUPERVISOR].includes(p),
      isAdmin: false,
      isSupervisor: true,
      isAgent: true,
    });

    renderRoute({ noAgentOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // tradeGate (1761) — kreiranje naloga: admin/supervizor ILI klijent sa
  // TRADE_STOCKS. Klijent bez permisije / cist employee / agent → /403.
  // ---------------------------------------------------------------------------

  it('tradeGate: redirects to /403 for client WITHOUT TRADE_STOCKS', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });

    renderRoute({ tradeGate: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  it('tradeGate: renders children for client WITH TRADE_STOCKS', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'klijent@banka.rs', role: 'CLIENT', permissions: [Permission.TRADE_STOCKS] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.TRADE_STOCKS,
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });

    renderRoute({ tradeGate: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('tradeGate: renders children for supervisor (buys in name of fund, no TRADE_STOCKS perm)', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'supervisor@banka.rs', role: 'EMPLOYEE', permissions: [Permission.SUPERVISOR] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.SUPERVISOR,
      isAdmin: false,
      isSupervisor: true,
      isAgent: false,
    });

    renderRoute({ tradeGate: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('tradeGate: renders children for admin', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@banka.rs', role: 'ADMIN', permissions: [Permission.ADMIN] },
      isLoading: false,
      hasPermission: () => false,
      isAdmin: true,
      isSupervisor: true,
      isAgent: false,
    });

    renderRoute({ tradeGate: true });
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('tradeGate: redirects to /403 for plain employee without supervisor/admin/trade', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'agent@banka.rs', role: 'EMPLOYEE', permissions: [Permission.AGENT] },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.AGENT,
      isAdmin: false,
      isSupervisor: false,
      isAgent: true,
    });

    renderRoute({ tradeGate: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // TEST-fe-authz-1 — isSupervisor string-coupling drift NE sme tiho da
  // demotuje supervizora na supervisorOnly rutama. AuthContext izvodi
  // isSupervisor iz dediciranog `position` polja (P1-fe-mobile-authz-1 1760)
  // PORED Permission.SUPERVISOR string-a. Ovde pinemo da ProtectedRoute postuje
  // taj derived flag: kad je isSupervisor=true (preko position=SUPERVISOR), a
  // permissions lista NE sadrzi literal "SUPERVISOR" string, ruta i dalje
  // renderuje child (ne /403). Time se brani od BE schema drift-a.
  // ---------------------------------------------------------------------------

  it('supervisorOnly: renders child when isSupervisor is true via position-drift (permissions lacks SUPERVISOR string)', () => {
    // Schema drift: BE poslao position=SUPERVISOR (AuthContext -> isSupervisor=true),
    // ali permissions lista NE sadrzi Permission.SUPERVISOR string (samo TRADE_STOCKS).
    mockUseAuth.mockReturnValue({
      user: {
        email: 'supervisor@banka.rs',
        role: 'EMPLOYEE',
        position: 'SUPERVISOR',
        permissions: [Permission.TRADE_STOCKS], // <-- SUPERVISOR string fali
      },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.TRADE_STOCKS,
      isAdmin: false,
      isSupervisor: true, // <-- derived iz position-a, ne iz permissions string-a
      isAgent: false,
    });

    renderRoute({ supervisorOnly: true });
    // NIJE demotovan na /403 — derived isSupervisor flag se postuje.
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.queryByTestId('forbidden-page')).toBeNull();
  });

  it('noAgentOnly: renders child when isSupervisor is true via position-drift (dual agent+supervisor not demoted)', () => {
    // position=SUPERVISOR + AGENT permisija — supervisor status pobedjuje,
    // OTP/noAgentOnly ruta ostaje dostupna iako permissions NEMA SUPERVISOR string.
    mockUseAuth.mockReturnValue({
      user: {
        email: 'dual@banka.rs',
        role: 'EMPLOYEE',
        position: 'SUPERVISOR',
        permissions: [Permission.AGENT],
      },
      isLoading: false,
      hasPermission: (p: Permission) => p === Permission.AGENT,
      isAdmin: false,
      isSupervisor: true,
      isAgent: false, // AuthContext: isAgent je false kad je isSupervisor true
    });

    renderRoute({ noAgentOnly: true });
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.queryByTestId('forbidden-page')).toBeNull();
  });

  it('supervisorOnly: still redirects to /403 when isSupervisor is false (genuine non-supervisor, no false grant)', () => {
    // Kontra-test: obican EMPLOYEE bez supervizor-statusa (position=AGENT) NE sme
    // proci supervisorOnly rutu — derived-flag mehanizam ne sme over-grant-ovati.
    mockUseAuth.mockReturnValue({
      user: {
        email: 'agent@banka.rs',
        role: 'EMPLOYEE',
        position: 'AGENT',
        permissions: [Permission.AGENT, Permission.TRADE_STOCKS],
      },
      isLoading: false,
      hasPermission: (p: Permission) => [Permission.AGENT, Permission.TRADE_STOCKS].includes(p),
      isAdmin: false,
      isSupervisor: false,
      isAgent: true,
    });

    renderRoute({ supervisorOnly: true });
    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
    expect(screen.queryByTestId('child')).toBeNull();
  });
});
