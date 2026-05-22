// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// Testovi za NotificationBell komponentu
// ============================================================

import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationBell from './NotificationBell';

// Mocks
vi.mock('@/services/notificationService', () => ({
  notificationService: {
    getUnreadCount: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ============================================================
// Tests
// ============================================================

describe('NotificationBell', () => {
  const mockNavigate = vi.fn();
  const mockGetUnreadCount = vi.mocked(notificationService.getUnreadCount);
  const mockUseAuth = vi.mocked(useAuth);
  const mockUseNavigate = vi.mocked(useNavigate);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockGetUnreadCount.mockResolvedValue({ count: 0 });
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, email: 'test@banka.rs', role: 'CLIENT', firstName: 'Test', lastName: 'User', username: 'test', permissions: [] },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderuje dugme sa data-testid="notification-bell"', () => {
    render(<NotificationBell />);
    const button = screen.getByTestId('notification-bell');
    expect(button).toBeInTheDocument();
  });

  it('ne renderuje bedž kad je unreadCount === 0', () => {
    mockGetUnreadCount.mockResolvedValue({ count: 0 });
    render(<NotificationBell />);
    
    const badge = screen.queryByTestId('notification-badge');
    expect(badge).not.toBeInTheDocument();
  });

  it('renderuje bedž sa brojem kad je unreadCount > 0', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 5 });
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      const badge = screen.getByTestId('notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('5');
    });
  });

  it('prikazuje "9+" kad je unreadCount > 9', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 15 });
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      const badge = screen.getByTestId('notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('9+');
    });
  });

  it('poziva getUnreadCount pri mount-u i postavlja count', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 3 });
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    });
  });

  it('pokreće polling na svakih 30s i ažurira count', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 1 });
    
    render(<NotificationBell />);
    
    // Prvi poziv (mount)
    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    });

    // Preskoči 30s
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Trebalo bi da bude pozvan drugi put
    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
    });

    // Ponovo preskoči 30s
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(3);
    });
  });

  it('čisti interval pri unmount-u (nema memory leak)', async () => {
    const { unmount } = render(<NotificationBell />);
    
    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    });

    // Preskoči 30s (trebalo bi da se pozove)
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
    });

    // Unmount komponente
    unmount();

    // Preskoči 30s ponovo - ne bi trebalo da se pozove jer je interval cleared
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Trebalo bi da ostane na 2 poziva
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('klik na dugme navigira na /notifications', async () => {
    render(<NotificationBell />);
    
    const button = screen.getByTestId('notification-bell');
    await act(async () => {
      button.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('aria-label sadrži broj nepročitanih kad count > 0', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 4 });
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      const button = screen.getByTestId('notification-bell');
      expect(button).toHaveAttribute('aria-label', 'Notifikacije, 4 nepročitanih');
    });
  });

  it('ne renderuje se kad korisnik nije prijavljen', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
    });

    const { container } = render(<NotificationBell />);
    expect(container.firstChild).toBeEmptyDOMNode();
    expect(mockGetUnreadCount).not.toHaveBeenCalled();
  });
});

