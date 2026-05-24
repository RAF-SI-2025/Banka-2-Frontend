// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// FE2 - Watchlist quick access | Developer: Antonije Ilic
// Testovi za Header komponentu (azurirano za FE2 WatchlistQuickAccess)
// ============================================================

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Header from './Header';

// Mocks
vi.mock('../shared/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">NotificationBell</div>,
}));

vi.mock('../watchlist/WatchlistQuickAccess', () => ({
  default: () => <div data-testid="watchlist-quick-access">WatchlistQuickAccess</div>,
}));

describe('Header', () => {
  it('renderuje header element sa data-testid="app-header"', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header).toBeInTheDocument();
  });

  it('je fiksiran na vrhu sa z-40 i md:left-64', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header.className).toContain('fixed');
    expect(header.className).toContain('top-0');
    expect(header.className).toContain('z-40');
    expect(header.className).toContain('md:left-64');
  });

  it('ima h-14 za fiksnu visinu', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header.className).toContain('h-14');
  });

  it('montira NotificationBell komponentu', () => {
    render(<Header />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('montira WatchlistQuickAccess komponentu (FE2)', () => {
    render(<Header />);
    expect(screen.getByTestId('watchlist-quick-access')).toBeInTheDocument();
  });

  it('ima flex layout sa gap-2', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header.className).toContain('flex');
    expect(header.className).toContain('gap-2');
  });

  it('ima backdrop blur efekt', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header.className).toContain('backdrop-blur-sm');
  });

  it('ima border-bottom', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header.className).toContain('border-b');
  });
});
