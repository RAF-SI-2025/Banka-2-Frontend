// ============================================================
// FE2 - Watchlist + cenovni alarmi | Developer: Antonije Ilic
//
// Stranica za upravljanje listama pracenja hartija od vrednosti.
// Spec: Zadaci_Frontend.pdf, FE2.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  X,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Filter,
  ListPlus,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { watchlistService } from '@/services/watchlistService';
import type {
  WatchlistDto,
  WatchlistItemDto,
  WatchlistFilterType,
} from '@/types/watchlist';
import { WATCHLIST_FILTER_LABELS } from '@/types/watchlist';
import { formatPrice, formatVolumeCompact } from '@/utils/formatters';

const FILTER_OPTIONS: WatchlistFilterType[] = ['ALL', 'STOCK', 'FUTURES', 'FOREX', 'OPTION'];

const TYPE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'info' | 'warning'> = {
  STOCK: 'info',
  FUTURES: 'warning',
  FOREX: 'secondary',
  OPTION: 'default',
};

function PercentBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold font-mono tabular-nums ${
        positive
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
          : 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20'
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [watchlists, setWatchlists] = useState<WatchlistDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [items, setItems] = useState<WatchlistItemDto[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [filter, setFilter] = useState<WatchlistFilterType>('ALL');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<WatchlistDto | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<WatchlistDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Initial load
  useEffect(() => {
    let active = true;
    setLoadingLists(true);
    watchlistService
      .listMyWatchlists()
      .then((list) => {
        if (!active) return;
        setWatchlists(list);
        if (list.length > 0 && selectedId === null) {
          setSelectedId(list[0].id);
        }
      })
      .catch(() => {
        if (active) toast.error('Neuspeh ucitavanja watchlista');
      })
      .finally(() => {
        if (active) setLoadingLists(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load items for selected watchlist
  useEffect(() => {
    if (selectedId === null) {
      setItems([]);
      return;
    }
    let active = true;
    setLoadingItems(true);
    watchlistService
      .listItems(selectedId)
      .then((list) => {
        if (active) setItems(list);
      })
      .catch(() => {
        if (active) {
          toast.error('Neuspeh ucitavanja stavki');
          setItems([]);
        }
      })
      .finally(() => {
        if (active) setLoadingItems(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectedWatchlist = useMemo(
    () => watchlists.find((w) => w.id === selectedId) ?? null,
    [watchlists, selectedId]
  );

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter((it) => String(it.listingType).toUpperCase() === filter);
  }, [items, filter]);

  // --- Actions ----------------------------------------------------------

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      toast.error('Naziv liste je obavezan');
      return;
    }
    setCreating(true);
    try {
      const created = await watchlistService.createWatchlist({ name });
      setWatchlists((prev) => [...prev, created]);
      setSelectedId(created.id);
      setCreateOpen(false);
      setCreateName('');
      toast.success(`Lista "${created.name}" je kreirana`);
    } catch {
      toast.error('Neuspeh kreiranja liste');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error('Naziv liste je obavezan');
      return;
    }
    if (name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    try {
      const updated = await watchlistService.renameWatchlist(renameTarget.id, { name });
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setRenameTarget(null);
      toast.success('Lista je preimenovana');
    } catch {
      toast.error('Neuspeh preimenovanja');
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await watchlistService.deleteWatchlist(deleteTarget.id);
      const remaining = watchlists.filter((w) => w.id !== deleteTarget.id);
      setWatchlists(remaining);
      if (selectedId === deleteTarget.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      setDeleteTarget(null);
      toast.success('Lista je obrisana');
    } catch {
      toast.error('Neuspeh brisanja');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveItem(item: WatchlistItemDto) {
    if (selectedId === null) return;
    try {
      // P1-fe-contracts-1: BE ruta brise po listingId, ne po item PK.
      await watchlistService.removeItem(selectedId, item.listingId);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // R1 854: optimisticki azuriraj `itemCount` badge u listi watchlista —
      // pre fix-a je ostajao zastareo (vecdi broj) dok se cela lista ne refetch-uje.
      setWatchlists((prev) =>
        prev.map((w) =>
          w.id === selectedId
            ? { ...w, itemCount: Math.max(0, (w.itemCount ?? 0) - 1) }
            : w
        )
      );
      toast.success(`${item.listingTicker} uklonjeno`);
    } catch {
      toast.error('Neuspeh uklanjanja');
    }
  }

  // --- Render -----------------------------------------------------------

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="watchlist-page">
      <div className="mb-6">
        <PageHeader
          icon={<Bookmark className="h-5 w-5" />}
          title="Watchlist"
          description="Tvoje liste pracenih hartija"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Levo: lista watchlists */}
        <aside className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Moje liste
            </h2>
            <Button
              size="sm"
              onClick={() => {
                setCreateName('');
                setCreateOpen(true);
              }}
              data-testid="create-watchlist-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova lista
            </Button>
          </div>

          {loadingLists ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-muted/40 animate-pulse"
                  data-testid="watchlist-skeleton"
                />
              ))}
            </div>
          ) : watchlists.length === 0 ? (
            <Card className="p-6 text-center">
              <Bookmark className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nemate watchlist-a. Kreirajte prvu klikom na "Nova lista".
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {watchlists.map((w) => {
                const isActive = w.id === selectedId;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(w.id)}
                      data-testid={`watchlist-card-${w.id}`}
                      className={`w-full text-left rounded-lg border p-3 transition-all flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/30 shadow-sm'
                          : 'hover:bg-accent border-border'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                          {w.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {w.itemCount ?? 0} {(w.itemCount ?? 0) === 1 ? 'stavka' : 'stavki'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameTarget(w);
                            setRenameValue(w.name);
                          }}
                          data-testid={`rename-watchlist-${w.id}`}
                          aria-label="Preimenuj listu"
                          title="Preimenuj"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(w);
                          }}
                          data-testid={`delete-watchlist-${w.id}`}
                          aria-label="Obrisi listu"
                          title="Obrisi"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Desno: items u izabranoj listi */}
        <section className="lg:col-span-2 space-y-4">
          {selectedWatchlist ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold truncate">{selectedWatchlist.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {filteredItems.length}{' '}
                    {filteredItems.length === 1 ? 'hartija' : 'hartija'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  {FILTER_OPTIONS.map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(f)}
                      data-testid={`watchlist-filter-${f.toLowerCase()}`}
                    >
                      {WATCHLIST_FILTER_LABELS[f]}
                    </Button>
                  ))}
                </div>
              </div>

              {loadingItems ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded bg-muted/40 animate-pulse"
                      data-testid="watchlist-item-skeleton"
                    />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ListPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">Lista je prazna</p>
                  <p className="text-xs">
                    Dodajte hartije sa{' '}
                    <button
                      type="button"
                      className="underline text-indigo-600 dark:text-indigo-400 hover:opacity-80"
                      onClick={() => navigate('/securities')}
                    >
                      Securities
                    </button>{' '}
                    stranice klikom na ikonu Bookmark.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-xs font-semibold uppercase">Ticker</TableHead>
                        <TableHead className="text-xs font-semibold uppercase">Tip</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-right">
                          Trenutna cena
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-right">
                          Dnevna promena
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-right">
                          Volume
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-right w-[140px]">
                          Akcije
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const typeUpper = String(item.listingType).toUpperCase();
                        const variant = TYPE_BADGE_VARIANT[typeUpper] ?? 'secondary';
                        return (
                          <TableRow
                            key={item.id}
                            data-testid={`watchlist-item-row-${item.id}`}
                            className="border-b border-border/30"
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-mono font-bold">{item.listingTicker}</span>
                                {item.listingName && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                                    {item.listingName}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={variant}>{typeUpper}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatPrice(item.currentPrice ?? null)}
                            </TableCell>
                            <TableCell className="text-right">
                              <PercentBadge value={item.dailyChangePercent ?? null} />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                              {item.volume != null ? formatVolumeCompact(item.volume) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    navigate(`/orders/new?listingId=${item.listingId}`)
                                  }
                                  title="Trguj"
                                  aria-label={`Trguj ${item.listingTicker}`}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveItem(item)}
                                  data-testid={`remove-item-${item.id}`}
                                  title="Ukloni iz liste"
                                  aria-label={`Ukloni ${item.listingTicker}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          ) : !loadingLists && watchlists.length === 0 ? (
            <Card className="p-12 text-center">
              <Bookmark className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nemate ni jednu listu</h3>
              <p className="text-sm text-muted-foreground">
                Kreirajte prvu listu klikom na "Nova lista" levo.
              </p>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-sm text-muted-foreground">Izaberi listu sa leve strane.</p>
            </Card>
          )}
        </section>
      </div>

      {/* Create dialog */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 animate-in fade-in" />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl p-6 w-full max-w-md border"
            data-testid="create-watchlist-dialog"
          >
            <Dialog.Title className="text-lg font-semibold mb-1">Nova lista</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mb-4">
              Daj listi smisleno ime da je lakse pronadjes kasnije.
            </Dialog.Description>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="watchlist-name">Naziv liste</Label>
                <Input
                  id="watchlist-name"
                  data-testid="create-watchlist-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="npr. Tehnoloske akcije"
                  maxLength={64}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Otkazi
                </Button>
                <Button type="submit" disabled={creating} data-testid="create-watchlist-submit">
                  {creating ? 'Kreiranje...' : 'Kreiraj'}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Rename dialog */}
      <Dialog.Root
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 animate-in fade-in" />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl p-6 w-full max-w-md border"
            data-testid="rename-watchlist-dialog"
          >
            <Dialog.Title className="text-lg font-semibold mb-1">Preimenuj listu</Dialog.Title>
            <form onSubmit={handleRename} className="space-y-4 mt-3">
              <div className="space-y-2">
                <Label htmlFor="rename-input">Novi naziv</Label>
                <Input
                  id="rename-input"
                  data-testid="rename-watchlist-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={64}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameTarget(null)}
                  disabled={renaming}
                >
                  Otkazi
                </Button>
                <Button type="submit" disabled={renaming}>
                  {renaming ? 'Cuvanje...' : 'Sacuvaj'}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirm */}
      <Dialog.Root
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 animate-in fade-in" />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl p-6 w-full max-w-md border"
            data-testid="delete-watchlist-dialog"
          >
            <Dialog.Title className="text-lg font-semibold mb-1">
              Obrisi watchlistu?
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Lista "{deleteTarget?.name}" i sve stavke u njoj ce biti obrisane. Ova akcija se ne
              moze poništiti.
            </Dialog.Description>
            <div className="flex justify-end gap-2 mt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Otkazi
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                data-testid="confirm-delete-watchlist"
              >
                {deleting ? 'Brisanje...' : 'Obrisi'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
