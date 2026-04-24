import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClientSidebar from '../components/shared/ClientSidebar';
import { Permission } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogout = vi.fn();
const mockSetTheme = vi.fn();
let mockUser: Record<string, unknown> | null = null;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => {
    const role = (mockUser?.role as string | undefined) ?? null;
    const perms = (mockUser?.permissions as string[] | undefined) ?? [];
    const isAdmin = role === 'ADMIN' || perms.includes('ADMIN');
    const isSupervisor = isAdmin || perms.includes('SUPERVISOR');
    const isAgent = perms.includes('AGENT');
    return {
      user: mockUser,
      logout: mockLogout,
      isAdmin,
      isSupervisor,
      isAgent,
      hasPermission: (p: string) => perms.includes(p),
    };
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light' as const,
    setTheme: mockSetTheme,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSidebar() {
  return render(
    <MemoryRouter>
      <ClientSidebar />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClientSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
  });

  describe('Client user', () => {
    beforeEach(() => {
      mockUser = {
        id: 1,
        email: 'klijent@banka.rs',
        username: 'klijent',
        firstName: 'Marko',
        lastName: 'Petrovic',
        role: 'CLIENT',
        permissions: [],
      };
    });

    it('renders the home link', () => {
      renderSidebar();
      expect(screen.getByText('Pocetna')).toBeTruthy();
    });

    it('renders client finance links', () => {
      renderSidebar();
      expect(screen.getByText('Racuni')).toBeTruthy();
      expect(screen.getByText('Placanja')).toBeTruthy();
      expect(screen.getByText('Primaoci')).toBeTruthy();
      expect(screen.getByText('Prenosi')).toBeTruthy();
      expect(screen.getByText('Istorija prenosa')).toBeTruthy();
      expect(screen.getByText('Istorija placanja')).toBeTruthy();
      expect(screen.getByText('Menjacnica')).toBeTruthy();
      expect(screen.getByText('Kartice')).toBeTruthy();
      expect(screen.getByText('Krediti')).toBeTruthy();
    });

    it('renders trading links', () => {
      renderSidebar();
      // 'Berza' appears as both section heading and link label
      expect(screen.getAllByText('Berza').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Portfolio')).toBeTruthy();
      expect(screen.getByText('Moji orderi')).toBeTruthy();
    });

    it('does NOT render employee portal links', () => {
      renderSidebar();
      expect(screen.queryByText('Employee portal')).toBeNull();
      expect(screen.queryByText('Zaposleni')).toBeNull();
      expect(screen.queryByText('Portal racuna')).toBeNull();
      expect(screen.queryByText('Portal klijenata')).toBeNull();
    });

    it('renders user name and role', () => {
      renderSidebar();
      expect(screen.getByText('Marko Petrovic')).toBeTruthy();
      expect(screen.getByText('Klijent')).toBeTruthy();
    });

    it('renders user initials in avatar', () => {
      renderSidebar();
      expect(screen.getByText('MP')).toBeTruthy();
    });

    it('logout button calls logout', async () => {
      const user = userEvent.setup();
      renderSidebar();

      const logoutBtn = screen.getByText('Odjavi se');
      await user.click(logoutBtn);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Admin user', () => {
    beforeEach(() => {
      mockUser = {
        id: 2,
        email: 'admin@banka.rs',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        permissions: [Permission.ADMIN],
      };
    });

    it('renders employee portal links for admin', () => {
      renderSidebar();
      expect(screen.getByText('Zaposleni')).toBeTruthy();
      expect(screen.getByText('Portal racuna')).toBeTruthy();
      expect(screen.getByText('Portal klijenata')).toBeTruthy();
      expect(screen.getByText('Zahtevi za kredit')).toBeTruthy();
      expect(screen.getByText('Svi krediti')).toBeTruthy();
    });

    it('renders Employee portal section heading', () => {
      renderSidebar();
      expect(screen.getByText('Employee portal')).toBeTruthy();
    });

    it('does NOT render client finance links (Moje finansije) for admin', () => {
      renderSidebar();
      expect(screen.queryByText('Moje finansije')).toBeNull();
    });

    it('shows Administrator role label', () => {
      renderSidebar();
      expect(screen.getByText('Administrator')).toBeTruthy();
    });

    it('still renders trading links for admin', () => {
      renderSidebar();
      // 'Berza' appears as both section heading and link label
      expect(screen.getAllByText('Berza').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Portfolio')).toBeTruthy();
    });
  });

  describe('Employee user', () => {
    beforeEach(() => {
      mockUser = {
        id: 3,
        email: 'employee@banka.rs',
        username: 'employee',
        firstName: 'Ana',
        lastName: 'Jovic',
        role: 'EMPLOYEE',
        permissions: [],
      };
    });

    it('renders employee portal links', () => {
      renderSidebar();
      // 'Zaposleni' appears as both the role label and nav link
      expect(screen.getAllByText('Zaposleni').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Portal racuna')).toBeTruthy();
    });

    it('does NOT render client finance links', () => {
      renderSidebar();
      expect(screen.queryByText('Moje finansije')).toBeNull();
    });

    it('shows Zaposleni role label', () => {
      renderSidebar();
      // Za EMPLOYEE rolu "Zaposleni" je samo role label — "Zaposleni" nav link
      // (ka /admin/employees) se prikazuje samo adminu.
      expect(screen.getByText('Zaposleni')).toBeTruthy();
    });
  });

  describe('Theme toggle', () => {
    beforeEach(() => {
      mockUser = {
        id: 1,
        email: 'klijent@banka.rs',
        username: 'k',
        firstName: 'K',
        lastName: 'L',
        role: 'CLIENT',
        permissions: [],
      };
    });

    it('renders theme toggle button with current theme label', () => {
      renderSidebar();
      // Current theme is 'light', so text should be 'Svetlo'
      expect(screen.getByText('Svetlo')).toBeTruthy();
    });
  });

  describe('No user', () => {
    it('renders sidebar with fallback initials "?" when no user', () => {
      mockUser = null;
      renderSidebar();
      expect(screen.getByText('?')).toBeTruthy();
    });
  });
});
