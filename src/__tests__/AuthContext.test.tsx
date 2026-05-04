import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
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

import { authService } from '../services/authService';
import { decodeJwt } from '../utils/jwt';
import { employeeService } from '../services/employeeService';

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
});
