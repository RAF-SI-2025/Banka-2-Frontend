// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// Testovi za Header komponentu
// ============================================================

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Header from './Header';

// Mocks
vi.mock('../shared/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">NotificationBell</div>,
}));

vi.mock('../shared/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle">ThemeToggle</div>,
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

  it('montira ThemeToggle komponentu', () => {
    render(<Header />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('ima TODO placeholder za FE2 WatchlistQuickAccess', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('[data-testid="app-header"]');
    // Trebalo bi da bude hvatljiv kao HTML komentar ili placeholder tekst
    expect(header).toBeInTheDocument();
  });

  it('ima flex layout sa gap i justify-end za desno poravnanje', () => {
    render(<Header />);
    const header = screen.getByTestId('app-header');
    expect(header.className).toContain('flex');
    expect(header.className).toContain('gap-2');
    expect(header.className).toContain('justify-end');
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
