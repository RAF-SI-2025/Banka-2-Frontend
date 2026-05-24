// ============================================================
// FE1 - In-app notifikacije + zaglavlje | Developer: Marta Suljagic
// FE2 - Watchlist quick access | Developer: Antonije Ilic
// Horizontalna traka zaglavlja aplikacije (topbar)
//
// NAPOMENA: ThemeToggle se NE renderuje ovde — vec postoji u ClientSidebar
// (dole iznad logout dugmeta). Duplikat bi pravio 2 elementa sa istim
// data-testid="theme-toggle" sto Cypress klikove rusi sa "2 elements" greskom.
// Konvencija ustanovljena 03.05.2026 (vidi CLAUDE.md).
// ============================================================

import NotificationBell from '../shared/NotificationBell';
import WatchlistQuickAccess from '../watchlist/WatchlistQuickAccess';

export default function Header() {
  return (
    <header
      data-testid="app-header"
      className="fixed top-0 right-0 z-40 h-14 md:left-64 bg-background/80 backdrop-blur-sm border-b flex items-center px-4 gap-2"
    >
      <div className="flex-1 min-w-0 flex items-center">
        <WatchlistQuickAccess />
      </div>
      <NotificationBell />
    </header>
  );
}
