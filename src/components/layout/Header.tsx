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
