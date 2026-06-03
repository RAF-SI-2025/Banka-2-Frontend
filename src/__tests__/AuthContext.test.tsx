import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AUTH_UNAUTHORIZED_EVENT } from '../services/authEvents';
import { Permission } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock authService — login + logout (Opc.1 server-side blacklist endpoint)
vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock jwt decoder
vi.mock('../utils/jwt', () => ({
  decodeJwt: vi.fn(),
}));

// Mock employeeService — login-flow fetchuje permisije iz backenda;
// default response vraca praznu stranicu, a pojedinacni testovi mogu da
// override-uju pretpostavljeno ponasanje.
vi.mock('../services/employeeService', () => ({
  employeeService: {
    getAll: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 }),
  },
}));

// Mock clientService — CLIENT role lookup (T4A-017 canTradeStocks).
// AuthContext koristi `getMe` (self-lookup) za CLIENT role; `getAll` ostaje za
// kompatibilnost sa nekoliko legacy testova koji jos uvek mockuju paged endpoint.
vi.mock('../services/clientService', () => ({
  clientService: {
    getAll: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 }),
    getMe: vi.fn().mockRejectedValue(new Error('not mocked')),
  },
}));

// react-router-dom mock: AuthProvider sada koristi useNavigate (FE-SHR-01).
// U test-u nemamo BrowserRouter wrapper, pa mock-ujemo useNavigate da vraca stub.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { authService } from '../services/authService';
import { decodeJwt } from '../utils/jwt';
import { employeeService } from '../services/employeeService';
import { clientService } from '../services/clientService';

// ---------------------------------------------------------------------------
// Helper: renders a consumer that exposes context values via data-testid
// ---------------------------------------------------------------------------
function AuthConsumer() {
  const { user, isAuthenticated, isAdmin, isLoading, hasPermission, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="isLoading">{String(isLoading)}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <span data-testid="firstName">{user?.firstName ?? ''}</span>
      <span data-testid="lastName">{user?.lastName ?? ''}</span>
      <span data-testid="role">{user?.role ?? ''}</span>
      <span data-testid="hasAdmin">{String(hasPermission(Permission.ADMIN))}</span>
      <button data-testid="login-btn" onClick={() => login({ email: 'marko.petrovic@banka.rs', password: '123' })} />
      <button data-testid="logout-btn" onClick={() => logout()} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    // FE-AUTH-02 default mount: decodeJwt vraca validan future-exp payload.
    // Pojedinacni testovi override-uju (npr. expired, null, ...).
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'default@banka.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
  });

  it('throws if useAuth is called outside AuthProvider', () => {
    // Suppress React error boundary console.error noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });

  it('starts unauthenticated when sessionStorage is empty', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    expect(screen.getByTestId('email').textContent).toBe('');
  });

  it('auto-loads user from sessionStorage on mount', () => {
    const storedUser = {
      id: 0,
      email: 'admin@banka.rs',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      permissions: [Permission.ADMIN],
    };
    sessionStorage.setItem('accessToken', 'fake-token');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('email').textContent).toBe('admin@banka.rs');
    expect(screen.getByTestId('isAdmin').textContent).toBe('true');
  });

  it('clears sessionStorage on invalid stored user JSON', () => {
    sessionStorage.setItem('accessToken', 'token');
    sessionStorage.setItem('user', '%%%invalid-json%%%');

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });

  it('login sets user state correctly for ADMIN role', async () => {
    const fakeLoginResponse = {
      accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtYXJrby5wZXRyb3ZpY0BiYW5rYS5ycyIsInJvbGUiOiJBRE1JTiIsImFjdGl2ZSI6dHJ1ZSwiZXhwIjoxOTk5OTk5OTk5LCJpYXQiOjE3MDA0MzIwMDB9.fake',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    };

    vi.mocked(authService.login).mockResolvedValue(fakeLoginResponse);
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'marko.petrovic@banka.rs',
      role: 'ADMIN',
      active: true,
      exp: 1999999999,
      iat: 1700432000,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(screen.getByTestId('email').textContent).toBe('marko.petrovic@banka.rs');
    expect(screen.getByTestId('firstName').textContent).toBe('Marko');
    expect(screen.getByTestId('lastName').textContent).toBe('Petrovic');
    expect(screen.getByTestId('role').textContent).toBe('ADMIN');
    expect(screen.getByTestId('isAdmin').textContent).toBe('true');
    expect(screen.getByTestId('hasAdmin').textContent).toBe('true');

    // Verify tokens stored in sessionStorage
    expect(sessionStorage.getItem('accessToken')).toBe(fakeLoginResponse.accessToken);
    expect(sessionStorage.getItem('refreshToken')).toBe(fakeLoginResponse.refreshToken);
    expect(sessionStorage.getItem('user')).toBeTruthy();
  });

  it('login for EMPLOYEE role with SUPERVISOR permission from backend sets supervisor flag', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'ana.jovic@banka.rs',
      role: 'EMPLOYEE',
      active: true,
      exp: 1999999999,
      iat: 1700432000,
    });
    // Backend vraca EMPLOYEE sa SUPERVISOR permisijom — nije admin,
    // ali jeste supervizor prema hijerarhiji iz spec-a (runda 11.04.2026).
    vi.mocked(employeeService.getAll).mockResolvedValue({
      content: [{
        id: 42,
        firstName: 'Ana',
        lastName: 'Jovic',
        email: 'ana.jovic@banka.rs',
        permissions: [Permission.SUPERVISOR],
      } as unknown as Parameters<typeof vi.fn>[0]],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    } as unknown as Awaited<ReturnType<typeof employeeService.getAll>>);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    // EMPLOYEE role + SUPERVISOR perm: isAdmin ostaje false (AuthContext.tsx
    // je namerno razdvojio admin od supervizora nakon runde 11.04.2026).
    expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    expect(screen.getByTestId('hasAdmin').textContent).toBe('false');
  });

  it('login for CLIENT role does not grant admin', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'klijent@banka.rs',
      role: 'CLIENT',
      active: true,
      exp: 1999999999,
      iat: 1700432000,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('isAdmin').textContent).toBe('false');
    expect(screen.getByTestId('hasAdmin').textContent).toBe('false');
  });

  it('login throws when decodeJwt returns null', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'bad-token',
      refreshToken: 'ref',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue(null);

    // Use a component that attempts login and captures the error
    let caughtError: Error | undefined;
    function LoginAttempt() {
      const { login } = useAuth();
      React.useEffect(() => {
        login({ email: 'test@x.rs', password: '123' }).catch((err: Error) => {
          caughtError = err;
        });
      }, [login]);
      return null;
    }

    render(
      <AuthProvider>
        <LoginAttempt />
      </AuthProvider>
    );

    // login() should throw 'Neispravan token' when decodeJwt returns null
    await waitFor(() => {
      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toContain('Neispravan token');
    });
  });

  it('logout clears sessionStorage and user state', async () => {
    // Start with a logged-in user
    const storedUser = {
      id: 0,
      email: 'test@banka.rs',
      username: 'test',
      firstName: 'Test',
      lastName: 'User',
      role: 'ADMIN',
      permissions: [Permission.ADMIN],
    };
    sessionStorage.setItem('accessToken', 'token');
    sessionStorage.setItem('refreshToken', 'rtoken');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('email').textContent).toBe('');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
  });

  it('hasPermission returns false when no user', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('hasAdmin').textContent).toBe('false');
  });

  it('hasPermission returns true when user has the permission', () => {
    const storedUser = {
      id: 0,
      email: 'a@b.rs',
      username: 'a',
      firstName: 'A',
      lastName: 'B',
      role: 'ADMIN',
      permissions: [Permission.ADMIN, Permission.TRADE_STOCKS],
    };
    sessionStorage.setItem('accessToken', 'tok');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('hasAdmin').textContent).toBe('true');
  });

  // ---------------------------------------------------------------------------
  // FE-AUTH-02: JWT exp enforced on mount
  // ---------------------------------------------------------------------------

  it('clears session on mount when access token is stale (exp in past)', () => {
    // decodeJwt cita iz token-a. Mockujemo decode da vrati istekli exp.
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'stale@banka.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) - 60, // 60s u proslosti
      iat: Math.floor(Date.now() / 1000) - 1000,
    });
    sessionStorage.setItem('accessToken', 'stale-token');
    sessionStorage.setItem('refreshToken', 'stale-refresh');
    sessionStorage.setItem('user', JSON.stringify({ id: 1, email: 'stale@banka.rs', role: 'ADMIN', permissions: [] }));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
  });

  it('keeps session on mount when access token has valid exp in future', () => {
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'valid@banka.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1h u buducnosti
      iat: Math.floor(Date.now() / 1000),
    });
    const storedUser = {
      id: 1,
      email: 'valid@banka.rs',
      username: 'valid',
      firstName: 'V',
      lastName: 'U',
      role: 'ADMIN',
      permissions: [Permission.ADMIN],
    };
    sessionStorage.setItem('accessToken', 'fresh-token');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('email').textContent).toBe('valid@banka.rs');
  });

  it('clears session on mount when decodeJwt returns null (corrupted token)', () => {
    vi.mocked(decodeJwt).mockReturnValue(null);
    sessionStorage.setItem('accessToken', 'corrupted-token');
    sessionStorage.setItem('user', JSON.stringify({ id: 1, email: 'x@y.rs', role: 'ADMIN', permissions: [] }));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // FE-AUTH-03: isLoading reflektuje async login + logout
  // ---------------------------------------------------------------------------

  it('isLoading flips true during login then back to false', async () => {
    let resolveLogin: ((value: { accessToken: string; refreshToken: string; tokenType: string }) => void) | undefined;
    vi.mocked(authService.login).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'a@b.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('isLoading').textContent).toBe('false');

    // Pokreni login (ne await-uj jos)
    act(() => {
      screen.getByTestId('login-btn').click();
    });

    // Sad isLoading bi trebao da bude true dok promise nije resolved
    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('true');
    });

    // Resolve promise i sacekaj da login zavrsi
    await act(async () => {
      resolveLogin!({ accessToken: 'tok', refreshToken: 'ref', tokenType: 'Bearer' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
  });

  it('isLoading is false on login failure (decodeJwt returns null)', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'bad',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue(null);

    let caught: Error | undefined;
    function LoginAttempt() {
      const { login } = useAuth();
      React.useEffect(() => {
        login({ email: 'x@y.rs', password: '123' }).catch((e: Error) => {
          caught = e;
        });
      }, [login]);
      return null;
    }

    render(
      <AuthProvider>
        <LoginAttempt />
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(caught).toBeDefined();
    });
    // Posle reject-a, isLoading mora biti vraceno na false (finally)
    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false');
    });
  });

  // ---------------------------------------------------------------------------
  // FE-AUTH-01: permissions construction immutable + ADMIN baseline ne brise BE permisije
  // ---------------------------------------------------------------------------

  it('ADMIN role with empty BE permisije zadrzi ADMIN baseline permisiju', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'admin@banka.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    // BE vraca SUPERVISOR permisiju ali ne ADMIN — admin baseline mora ostati
    vi.mocked(employeeService.getAll).mockResolvedValue({
      content: [
        {
          id: 5,
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@banka.rs',
          permissions: [Permission.SUPERVISOR],
        } as never,
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    } as never);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    // ADMIN baseline + SUPERVISOR iz BE-a — oba moraju biti prisutni
    expect(screen.getByTestId('hasAdmin').textContent).toBe('true');
    expect(screen.getByTestId('isAdmin').textContent).toBe('true');
  });

  it('ADMIN role sa fetch failure zadrzi ADMIN baseline permisiju', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'admin@banka.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    // BE pada — ADMIN baseline mora preziveti
    vi.mocked(employeeService.getAll).mockRejectedValue(new Error('BE down'));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('hasAdmin').textContent).toBe('true');
  });

  it('CLIENT role with canTradeStocks=false does not get TRADE_STOCKS permission', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'klijent@x.rs',
      role: 'CLIENT',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    vi.mocked(clientService.getMe).mockResolvedValue({
      id: 99,
      firstName: 'Klijent',
      lastName: 'X',
      email: 'klijent@x.rs',
      canTradeStocks: false,
    } as never);

    function ClientConsumer() {
      const { user, hasPermission } = useAuth();
      return (
        <>
          <span data-testid="client-id">{user?.id ?? -1}</span>
          <span data-testid="can-trade">{String(hasPermission(Permission.TRADE_STOCKS))}</span>
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthConsumer />
        <ClientConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('client-id').textContent).toBe('99');
    expect(screen.getByTestId('can-trade').textContent).toBe('false');
  });

  it('CLIENT role with canTradeStocks=true gets TRADE_STOCKS permission', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'klijent@x.rs',
      role: 'CLIENT',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    vi.mocked(clientService.getMe).mockResolvedValue({
      id: 99,
      firstName: 'Klijent',
      lastName: 'X',
      email: 'klijent@x.rs',
      canTradeStocks: true,
    } as never);

    function ClientConsumer() {
      const { hasPermission } = useAuth();
      return <span data-testid="can-trade">{String(hasPermission(Permission.TRADE_STOCKS))}</span>;
    }

    render(
      <AuthProvider>
        <AuthConsumer />
        <ClientConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('can-trade').textContent).toBe('true');
  });

  // ---------------------------------------------------------------------------
  // FE-SHR-01: AUTH_UNAUTHORIZED_EVENT listener cleans session + redirects
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // P1-fe-mobile-authz-1 (1560/1598): CLIENT /clients/me fail → FAIL-CLOSED
  // ---------------------------------------------------------------------------

  it('CLIENT whose /clients/me fails gets NO TRADE_STOCKS (fail-closed) and userId 0', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'klijent@x.rs',
      role: 'CLIENT',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    // /clients/me pada (npr. 403 / timeout) — ranije bi vratio [TRADE_STOCKS]
    vi.mocked(clientService.getMe).mockRejectedValue(new Error('boom'));

    function ClientConsumer() {
      const { user, hasPermission } = useAuth();
      return (
        <>
          <span data-testid="client-id">{user?.id ?? -1}</span>
          <span data-testid="can-trade">{String(hasPermission(Permission.TRADE_STOCKS))}</span>
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthConsumer />
        <ClientConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    // FAIL-CLOSED: nema TRADE_STOCKS po default-u, userId 0 (nepoznat)
    expect(screen.getByTestId('can-trade').textContent).toBe('false');
    expect(screen.getByTestId('client-id').textContent).toBe('0');
  });

  // ---------------------------------------------------------------------------
  // P1-fe-mobile-authz-1 (1760): isSupervisor iz dediciranog `position` polja
  // ---------------------------------------------------------------------------

  it('EMPLOYEE with position=SUPERVISOR is supervisor even when permissions lacks SUPERVISOR string', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'ana.jovic@banka.rs',
      role: 'EMPLOYEE',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    // Schema drift: position kaze SUPERVISOR, ali permissions ne sadrzi literal
    // "SUPERVISOR" (npr. samo TRADE_STOCKS). Ranije → tretiran kao EMPLOYEE.
    vi.mocked(employeeService.getAll).mockResolvedValue({
      content: [{
        id: 42,
        firstName: 'Ana',
        lastName: 'Jovic',
        email: 'ana.jovic@banka.rs',
        position: 'SUPERVISOR',
        permissions: [Permission.TRADE_STOCKS],
      } as never],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    } as never);

    function RoleConsumer() {
      const { isSupervisor, isAgent } = useAuth();
      return (
        <>
          <span data-testid="is-supervisor">{String(isSupervisor)}</span>
          <span data-testid="is-agent">{String(isAgent)}</span>
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthConsumer />
        <RoleConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('is-supervisor').textContent).toBe('true');
    expect(screen.getByTestId('is-agent').textContent).toBe('false');
  });

  it('EMPLOYEE with position=AGENT is agent and NOT supervisor', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'r',
      tokenType: 'Bearer',
    });
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'agent@banka.rs',
      role: 'EMPLOYEE',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    vi.mocked(employeeService.getAll).mockResolvedValue({
      content: [{
        id: 7,
        firstName: 'Agent',
        lastName: 'X',
        email: 'agent@banka.rs',
        position: 'AGENT',
        permissions: [Permission.TRADE_STOCKS],
      } as never],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    } as never);

    function RoleConsumer() {
      const { isSupervisor, isAgent } = useAuth();
      return (
        <>
          <span data-testid="is-supervisor">{String(isSupervisor)}</span>
          <span data-testid="is-agent">{String(isAgent)}</span>
        </>
      );
    }

    render(
      <AuthProvider>
        <AuthConsumer />
        <RoleConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('is-agent').textContent).toBe('true');
    expect(screen.getByTestId('is-supervisor').textContent).toBe('false');
  });

  it('handles auth:unauthorized event by clearing session and navigating to /login', async () => {
    const storedUser = {
      id: 1,
      email: 'x@y.rs',
      username: 'x',
      firstName: 'X',
      lastName: 'Y',
      role: 'ADMIN',
      permissions: [Permission.ADMIN],
    };
    vi.mocked(decodeJwt).mockReturnValue({
      sub: 'x@y.rs',
      role: 'ADMIN',
      active: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    sessionStorage.setItem('accessToken', 'tok');
    sessionStorage.setItem('refreshToken', 'rtok');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    // Dispatch event — kao da je api.ts interceptor pao posle refresh greske
    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    // mockNavigate je pozvan jer pathname nije /login (jsdom default je '/')
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
