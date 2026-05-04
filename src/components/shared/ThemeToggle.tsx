//
// Theme toggle dugme — Light / Dark / System.
// 3-state cycle button (klik prolazi: System → Light → Dark → System ...).
// Vec postoji ThemeContext koji upravlja root .light / .dark klasama.
//

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  /** "compact" — samo 32px ikona; "full" — ikona + tekst label */
  variant?: 'compact' | 'full';
  className?: string;
}

const NEXT_THEME: Record<string, 'light' | 'dark' | 'system'> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export default function ThemeToggle({ variant = 'compact', className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = theme === 'light' ? 'Svetlo' : theme === 'dark' ? 'Tamno' : 'Sistem';
  const ariaLabel = `Trenutna tema: ${label}. Klik za sledecu.`;

  const handleClick = () => {
    setTheme(NEXT_THEME[theme] ?? 'system');
  };

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        title={ariaLabel}
        data-testid="theme-toggle"
        className={`flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors ${className}`}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid="theme-toggle"
      className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-background hover:bg-accent transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
