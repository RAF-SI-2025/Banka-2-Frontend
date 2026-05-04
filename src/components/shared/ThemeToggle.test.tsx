import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';

const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme });
  });

  it('renders compact variant by default', () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label');
    expect(btn.getAttribute('aria-label')).toMatch(/Sistem/i);
  });

  it('cycles theme: system -> light -> dark -> system', async () => {
    const user = userEvent.setup();

    // System -> Light
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme });
    const { rerender } = render(<ThemeToggle />);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');

    // Light -> Dark
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme });
    rerender(<ThemeToggle />);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenLastCalledWith('dark');

    // Dark -> System
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme });
    rerender(<ThemeToggle />);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenLastCalledWith('system');
  });

  it('shows full variant with text label', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme });
    render(<ThemeToggle variant="full" />);
    expect(screen.getByText('Tamno')).toBeInTheDocument();
  });

  it('shows correct icon and label for each theme state', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme });
    const { rerender } = render(<ThemeToggle variant="full" />);
    expect(screen.getByText('Svetlo')).toBeInTheDocument();

    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme });
    rerender(<ThemeToggle variant="full" />);
    expect(screen.getByText('Tamno')).toBeInTheDocument();

    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme });
    rerender(<ThemeToggle variant="full" />);
    expect(screen.getByText('Sistem')).toBeInTheDocument();
  });
});
