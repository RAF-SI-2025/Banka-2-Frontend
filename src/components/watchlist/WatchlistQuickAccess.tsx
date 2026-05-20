import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import watchlistService from '@/services/watchlistService';
import type { WatchlistItemDto } from '@/types/watchlist';
import { cn } from '@/lib/utils';

const REFRESH_MS = 30_000;

function formatPrice(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('sr-RS', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString('sr-RS', { maximumFractionDigits: 2 });
  }
}

function pctClass(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return 'text-muted-foreground';
  return pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
}

export default function WatchlistQuickAccess({ maxItems = 8 }: { maxItems?: number }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchlistItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [extraCount, setExtraCount] = useState(0);

  const listingIds = useMemo(() => items.map((i) => i.listingId), [items]);

  const loadItems = useCallback(async () => {
    try {
      const lists = await watchlistService.listAll();
      if (lists.length === 0) {
        setItems([]);
        setExtraCount(0);
        return;
      }
      const primary = lists[0];
      const allItems = await watchlistService.listItems(primary.id);
      const seen = new Set<number>();
      const unique: WatchlistItemDto[] = [];
      for (const item of allItems) {
        if (seen.has(item.listingId)) continue;
        seen.add(item.listingId);
        unique.push(item);
      }
      setExtraCount(Math.max(0, unique.length - maxItems));
      setItems(unique.slice(0, maxItems));
    } catch {
      setItems([]);
      setExtraCount(0);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  const refreshPrices = useCallback(async () => {
    if (listingIds.length === 0) return;
    try {
      const snapshot = await watchlistService.fetchMarketSnapshot(listingIds);
      const byListing = new Map(snapshot.map((s) => [s.listingId, s]));
      setItems((prev) =>
        prev.map((item) => {
          const snap = byListing.get(item.listingId);
          if (!snap) return item;
          return {
            ...item,
            currentPrice: snap.currentPrice ?? item.currentPrice,
            priceChangePct: snap.priceChangePct ?? item.priceChangePct,
            volume: snap.volume ?? item.volume,
          };
        })
      );
    } catch {
      /* tihi fail pri refresh-u */
    }
  }, [listingIds]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (listingIds.length === 0) return;
    void refreshPrices();
    const id = window.setInterval(() => void refreshPrices(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [listingIds, refreshPrices]);

  if (loading) {
    return (
      <div
        data-testid="watchlist-quick-access"
        className="hidden lg:flex items-center gap-2 max-w-md overflow-hidden"
      >
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="watchlist-quick-access"
      className="hidden lg:flex items-center gap-1 max-w-[min(52vw,640px)] overflow-x-auto scrollbar-hidden mr-2"
    >
      {items.map((item) => (
        <button
          key={item.listingId}
          type="button"
          data-testid={`quick-access-item-${item.ticker}`}
          title={`${item.name} · ${item.exchange} · vol: ${item.volume ?? '—'}`}
          onClick={() => navigate(`/securities/${item.listingId}`)}
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 hover:bg-muted/60 transition-colors text-xs"
        >
          <span className="font-mono font-semibold">{item.ticker}</span>
          <span
            data-testid={`quick-access-price-${item.ticker}`}
            className="font-mono tabular-nums text-muted-foreground"
          >
            {formatPrice(item.currentPrice, item.currency)}
          </span>
          <span className={cn('font-mono tabular-nums', pctClass(item.priceChangePct))}>
            {item.priceChangePct != null && Number.isFinite(item.priceChangePct)
              ? `${item.priceChangePct > 0 ? '+' : ''}${item.priceChangePct.toFixed(2)}%`
              : '—'}
          </span>
        </button>
      ))}
      {extraCount > 0 && (
        <Link
          to="/watchlist"
          className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-1"
        >
          +{extraCount} vise
        </Link>
      )}
    </div>
  );
}
