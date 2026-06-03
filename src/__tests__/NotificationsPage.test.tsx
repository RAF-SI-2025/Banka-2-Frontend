import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationsPage from '../pages/Notifications/NotificationsPage';
import { notificationService } from '../services/notificationService';
import type { NotificationDto } from '../types/notification';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/notificationService', () => ({
  notificationService: {
    listNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockList = vi.mocked(notificationService.listNotifications);
const mockUnread = vi.mocked(notificationService.getUnreadCount);
const mockMarkAsRead = vi.mocked(notificationService.markAsRead);
const mockMarkAll = vi.mocked(notificationService.markAllAsRead);

function makeItem(id: number, overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id,
    type: 'GENERAL',
    title: `Naslov ${id}`,
    body: `Poruka ${id}`,
    read: false,
    createdAt: '2026-05-25T10:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnread.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
    });
    mockMarkAsRead.mockResolvedValue(undefined);
    mockMarkAll.mockResolvedValue(undefined);
  });

  it('renders empty state when no notifications', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeTruthy();
      expect(screen.getByText(/nemate notifikacija/i)).toBeTruthy();
    });
  });

  it('renders list of notifications', async () => {
    mockList.mockResolvedValue({
      content: [
        makeItem(1, { type: 'ORDER_EXECUTED', title: 'Order #5 izvrsen', read: false }),
        makeItem(2, { type: 'PAYMENT', title: 'Stigla uplata', read: true }),
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('notification-row-1')).toBeTruthy();
      expect(screen.getByTestId('notification-row-2')).toBeTruthy();
    });
    expect(screen.getByText('Order #5 izvrsen')).toBeTruthy();
  });

  it('shows unread dot only on unread items', async () => {
    mockList.mockResolvedValue({
      content: [
        makeItem(1, { read: false }),
        makeItem(2, { read: true }),
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('notification-row-1')).toBeTruthy());
    expect(screen.queryByTestId('unread-dot-1')).toBeTruthy();
    expect(screen.queryByTestId('unread-dot-2')).toBeNull();
  });

  it('filters to unread when Neprocitane tab clicked', async () => {
    renderPage();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('filter-unread'));
    await waitFor(() => {
      const lastCall = mockList.mock.calls[mockList.mock.calls.length - 1];
      expect(lastCall?.[0]).toMatchObject({ onlyUnread: true });
    });
  });

  it('shows pagination and navigates to next page', async () => {
    mockList.mockResolvedValue({
      content: [makeItem(1)],
      totalElements: 30,
      totalPages: 2,
      number: 0,
      size: 20,
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('page-indicator')).toBeTruthy());
    expect(screen.getByTestId('page-indicator').textContent).toMatch(/Strana 1 od 2/i);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('next-page'));
    await waitFor(() => {
      const lastCall = mockList.mock.calls[mockList.mock.calls.length - 1];
      expect(lastCall?.[0]).toMatchObject({ page: 1, size: 20 });
    });
  });

  it('mark-all button is disabled when no unread', async () => {
    mockUnread.mockResolvedValue({ count: 0 });
    renderPage();
    await waitFor(() => {
      const btn = screen.getByTestId('mark-all-read-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it('mark-all button calls markAllAsRead and refetches', async () => {
    mockUnread.mockResolvedValue({ count: 3 });
    mockList.mockResolvedValue({
      content: [makeItem(1, { read: false })],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    renderPage();
    await waitFor(() => {
      const btn = screen.getByTestId('mark-all-read-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('mark-all-read-btn'));
    await waitFor(() => expect(mockMarkAll).toHaveBeenCalled());
  });

  it('clicking a row marks as read and navigates if related entity present', async () => {
    mockList.mockResolvedValue({
      content: [
        makeItem(7, {
          type: 'ORDER_EXECUTED',
          read: false,
          referenceType: 'ORDER',
          referenceId: 99,
        }),
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('notification-row-7')).toBeTruthy());
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByTestId('notification-row-7'));
    });
    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith(7);
      expect(mockNavigate).toHaveBeenCalledWith('/orders/my');
    });
  });

  it('clicking an already-read row does not call markAsRead but still navigates', async () => {
    mockList.mockResolvedValue({
      content: [
        makeItem(8, {
          read: true,
          referenceType: 'PAYMENT',
        }),
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('notification-row-8')).toBeTruthy());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('notification-row-8'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/payments/history'));
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });
});
