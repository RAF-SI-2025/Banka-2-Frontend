import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import watchlistService from '@/services/watchlistService';
import type { WatchlistDto } from '@/types/watchlist';

interface AddToWatchlistButtonProps {
  listingId: number;
  ticker: string;
  variant?: 'icon' | 'full';
}

export default function AddToWatchlistButton({
  listingId,
  ticker,
  variant = 'icon',
}: AddToWatchlistButtonProps) {
  const navigate = useNavigate();
  const [lists, setLists] = useState<WatchlistDto[]>([]);
  const [membership, setMembership] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const loadMembership = useCallback(async (watchlists: WatchlistDto[]) => {
    const entries = await Promise.all(
      watchlists.map(async (wl) => {
        try {
          const items = await watchlistService.listItems(wl.id);
          const hit = items.find((i) => i.listingId === listingId);
          return [wl.id, hit?.id ?? null] as const;
        } catch {
          return [wl.id, null] as const;
        }
      })
    );
    setMembership(Object.fromEntries(entries));
  }, [listingId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await watchlistService.listAll();
      setLists(all);
      await loadMembership(all);
    } catch {
      setLists([]);
      setMembership({});
    } finally {
      setLoading(false);
    }
  }, [loadMembership]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const inAnyList = Object.values(membership).some((id) => id != null);

  const toggleList = async (watchlistId: number) => {
    const itemId = membership[watchlistId];
    setBusyId(watchlistId);
    try {
      if (itemId != null) {
        await watchlistService.removeItem(watchlistId, itemId);
        setMembership((m) => ({ ...m, [watchlistId]: null }));
        toast.success(`${ticker} uklonjen iz liste`);
      } else {
        await watchlistService.addItem(watchlistId, { listingId });
        const items = await watchlistService.listItems(watchlistId);
        const hit = items.find((i) => i.listingId === listingId);
        setMembership((m) => ({ ...m, [watchlistId]: hit?.id ?? null }));
        const wl = lists.find((l) => l.id === watchlistId);
        toast.success(`${ticker} dodat u "${wl?.name ?? 'listu'}"`);
      }
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status !== 409) {
        toast.error('Operacija nije uspela');
      }
      await loadMembership(lists);
    } finally {
      setBusyId(null);
    }
  };

  const trigger = (
    <Button
      variant={variant === 'full' ? 'outline' : 'ghost'}
      size={variant === 'icon' ? 'icon' : 'sm'}
      className={variant === 'icon' ? 'h-8 w-8' : 'gap-2'}
      data-testid={`add-to-watchlist-btn-${listingId}`}
      aria-label="Dodaj na watchlistu"
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : inAnyList ? (
        <BookmarkCheck className="h-4 w-4 text-indigo-600" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {variant === 'full' && <span>{inAnyList ? 'Na watchlisti' : 'Dodaj na watchlistu'}</span>}
    </Button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" data-testid="watchlist-popover">
        <DropdownMenuLabel>Watchliste</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {lists.length === 0 ? (
          <DropdownMenuItem onClick={() => navigate('/watchlist')}>
            Kreiraj prvu listu
          </DropdownMenuItem>
        ) : (
          lists.map((wl) => {
            const checked = membership[wl.id] != null;
            return (
              <DropdownMenuItem
                key={wl.id}
                data-testid={`watchlist-option-${wl.id}`}
                disabled={busyId === wl.id}
                onClick={(e) => {
                  e.preventDefault();
                  void toggleList(wl.id);
                }}
              >
                <span className="flex-1 truncate">{wl.name}</span>
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {wl.itemCount}
                </Badge>
                {checked && <BookmarkCheck className="h-3.5 w-3.5 ml-2 text-indigo-600" />}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/watchlist')}>Upravljaj listama</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
