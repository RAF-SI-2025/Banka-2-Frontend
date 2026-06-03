// ============================================================
// FE2 - Watchlist + cenovni alarmi | Developer: Antonije Ilic
//
// Kompaktan widget za sidebar — prikazuje top stavke iz prve watchlist-e
// (5-10), sa polling-om cena svakih 30s. Klik na stavku navigira na
// Securities detalj. Ne montira se ako korisnik nema lista.
//
// Spec: Zadaci_Frontend.pdf, FE2.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { watchlistService } from '@/services/watchlistService';
import { useAuth } from '@/context/AuthContext';
import type { WatchlistItemDto } from '@/types/watchlist';
import { formatPrice } from '@/utils/formatters';

const POLL_INTERVAL_MS = 30_000;
const MAX_ITEMS = 8;

export default function WatchlistQuickAccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchlistItemDto[] | null>(null);
  const [primaryWatchlistId, setPrimaryWatchlistId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    try {
      const lists = await watchlistService.listMyWatchlists();
      if (lists.length === 0) {
        setItems([]);
        setPrimaryWatchlistId(null);
        return;
      }
      const first = lists[0];
      setPrimaryWatchlistId(first.id);
      const itemsData = await watchlistService.listItems(first.id);
      setItems(itemsData.slice(0, MAX_ITEMS));
    } catch {
      // Tihi neuspeh — sidebar widget ne sme da kvari rendering
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(() => {
      void fetchData(true);
    }, POLL_INTERVAL_MS);
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    void fetchData(false);
    if (!document.hidden) startPolling();

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        void fetchData(true);
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [user, fetchData, startPolling, stopPolling]);

  const hasItems = useMemo(() => items !== null && items.length > 0, [items]);

  if (!user) return null;

  return (
    <div
      className="rounded-lg border bg-card/40 backdrop-blur-sm p-2"
      data-testid="watchlist-quick-access"
    >
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pracene hartije
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/watchlist')}
          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
          data-testid="watchlist-quick-access-all"
        >
          Sve <ChevronRight className="h-2.5 w-2.5" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-1" data-testid="watchlist-quick-access-loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : !hasItems ? (
        <div className="text-[10px] text-muted-foreground text-center py-3 px-2">
          Nemate pracene hartije.{' '}
          <button
            type="button"
            onClick={() => navigate('/watchlist')}
            className="underline text-indigo-600 dark:text-indigo-400"
          >
            Dodaj
          </button>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {items!.map((item) => {
            const pct = item.dailyChangePercent ?? null;
            const positive = pct !== null && pct >= 0;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    primaryWatchlistId !== null
                      ? navigate(`/watchlist`)
                      : navigate(`/securities`)
                  }
                  data-testid={`quick-access-item-${item.listingTicker}`}
                  className="w-full grid grid-cols-[minmax(3.5rem,1fr)_auto_auto] items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-accent transition-colors"
                  title={item.listingName ?? item.listingTicker}
                >
                  <span className="font-mono font-semibold text-left whitespace-nowrap">
                    {item.listingTicker}
                  </span>
                  <span
                    className="font-mono tabular-nums text-muted-foreground"
                    data-testid={`quick-access-price-${item.listingTicker}`}
                  >
                    {formatPrice(item.currentPrice ?? null)}
                  </span>
                  {pct !== null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 font-mono tabular-nums text-[10px] font-semibold ${
                        positive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {positive ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5" />
                      )}
                      {positive ? '+' : ''}
                      {pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">—</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
