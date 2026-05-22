// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// Horizontalna traka zaglavlja aplikacije (topbar)
// ============================================================

import NotificationBell from '../shared/NotificationBell';
import ThemeToggle from '../shared/ThemeToggle';

export default function Header() {
  return (
    <header
      data-testid="app-header"
      className="fixed top-0 right-0 z-40 h-14 md:left-64 bg-background/80 backdrop-blur-sm border-b flex items-center px-4 gap-2 justify-end"
    >
      <NotificationBell />
      {/* TODO FE2: ovde ide WatchlistQuickAccess */}
      <ThemeToggle variant="compact" />
    </header>
  );
}
