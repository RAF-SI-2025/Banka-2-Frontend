import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import watchlistService from '@/services/watchlistService';
import type { WatchlistDto, WatchlistItemDto } from '@/types/watchlist';
import {
  WATCHLIST_FILTER_LABELS,
  matchesWatchlistFilter,
  type WatchlistFilterType,
} from '@/types/watchlist';
import { formatPrice } from '@/utils/formatters';

function pctColor(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return 'text-muted-foreground';
  return pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<WatchlistDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [items, setItems] = useState<WatchlistItemDto[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [filter, setFilter] = useState<WatchlistFilterType>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renameOpen, setRenameOpen] = useState<WatchlistDto | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteOpen, setDeleteOpen] = useState<WatchlistDto | null>(null);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const data = await watchlistService.listAll();
      setLists(data);
      setSelectedId((prev) => {
        if (prev != null && data.some((l) => l.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch {
      toast.error('Neuspesno ucitavanje watchlista');
      setLists([]);
      setSelectedId(null);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  const loadItems = useCallback(async (watchlistId: number) => {
    setLoadingItems(true);
    try {
      const data = await watchlistService.listItems(watchlistId);
      setItems(data);
    } catch {
      toast.error('Neuspesno ucitavanje stavki');
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (selectedId == null) {
      setItems([]);
      return;
    }
    void loadItems(selectedId);
  }, [selectedId, loadItems]);

  const filteredItems = useMemo(
    () => items.filter((i) => matchesWatchlistFilter(i.listingType, filter)),
    [items, filter]
  );

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error('Unesite naziv liste');
      return;
    }
    try {
      const created = await watchlistService.create({ name });
      toast.success('Lista kreirana');
      setCreateOpen(false);
      setCreateName('');
      await loadLists();
      setSelectedId(created.id);
    } catch {
      toast.error('Kreiranje liste nije uspelo');
    }
  };

  const handleRename = async () => {
    if (!renameOpen) return;
    const name = renameName.trim();
    if (!name) {
      toast.error('Unesite naziv liste');
      return;
    }
    try {
      await watchlistService.rename(renameOpen.id, { name });
      toast.success('Lista preimenovana');
      setRenameOpen(null);
      await loadLists();
    } catch {
      toast.error('Preimenovanje nije uspelo');
    }
  };

  const handleDelete = async () => {
    if (!deleteOpen) return;
    try {
      await watchlistService.remove(deleteOpen.id);
      toast.success('Lista obrisana');
      setDeleteOpen(null);
      if (selectedId === deleteOpen.id) setSelectedId(null);
      await loadLists();
    } catch {
      toast.error('Brisanje liste nije uspelo');
    }
  };

  const handleRemoveItem = async (item: WatchlistItemDto) => {
    if (selectedId == null) return;
    try {
      await watchlistService.removeItem(selectedId, item.id);
      toast.success(`${item.ticker} uklonjen`);
      await loadItems(selectedId);
      await loadLists();
    } catch {
      toast.error('Uklanjanje stavke nije uspelo');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="watchlist-page">
      <div className="mb-6">
        <PageHeader
          icon={<Bookmark className="h-5 w-5" />}
          title="Watchliste"
          description="Upravljajte listama pracenja hartija od vrednosti"
          actions={
            <Button data-testid="create-watchlist-btn" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova lista
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vase liste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingLists ? (
              <div className="space-y-2" data-testid="watchlist-lists-loading" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : lists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nemate watchlista. Kliknite &quot;Nova lista&quot; da kreirate prvu.
              </p>
            ) : (
              lists.map((wl) => (
                <div
                  key={wl.id}
                  data-testid={`watchlist-card-${wl.id}`}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedId === wl.id
                      ? 'border-indigo-500/50 bg-indigo-500/5'
                      : 'border-border/50 hover:bg-muted/40'
                  }`}
                  onClick={() => setSelectedId(wl.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{wl.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {wl.itemCount} {wl.itemCount === 1 ? 'stavka' : 'stavki'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        data-testid={`rename-watchlist-${wl.id}`}
                        onClick={() => {
                          setRenameOpen(wl);
                          setRenameName(wl.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        data-testid={`delete-watchlist-${wl.id}`}
                        onClick={() => setDeleteOpen(wl)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Stavke liste</CardTitle>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(WATCHLIST_FILTER_LABELS) as WatchlistFilterType[]).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => setFilter(key)}
                >
                  {WATCHLIST_FILTER_LABELS[key]}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {selectedId == null ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Izaberite listu sa leve strane.
              </div>
            ) : loadingItems ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  {items.length === 0
                    ? 'Lista je prazna. Dodajte hartije sa portala Berza (dugme za watchlistu).'
                    : 'Nema stavki za izabrani filter.'}
                </p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/securities')}>
                  Otvori Berzu
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Ime</TableHead>
                    <TableHead>Berza</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead className="text-right">Cena</TableHead>
                    <TableHead className="text-right">Promena %</TableHead>
                    <TableHead className="text-right">Volumen</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow
                      key={item.id}
                      data-testid={`watchlist-item-row-${item.id}`}
                      className="cursor-pointer"
                      onClick={() => navigate(`/securities/${item.listingId}`)}
                    >
                      <TableCell className="font-mono font-semibold">{item.ticker}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{item.name}</TableCell>
                      <TableCell>{item.exchange}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {item.listingType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {item.currentPrice != null ? formatPrice(item.currentPrice) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono tabular-nums ${pctColor(item.priceChangePct)}`}>
                        {item.priceChangePct != null && Number.isFinite(item.priceChangePct)
                          ? `${item.priceChangePct > 0 ? '+' : ''}${item.priceChangePct.toFixed(2)}%`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                        {item.volume != null ? item.volume.toLocaleString('sr-RS') : '—'}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`remove-item-${item.id}`}
                          onClick={() => void handleRemoveItem(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md" role="dialog">
            <CardHeader>
              <CardTitle>Nova watchlista</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wl-name">Naziv</Label>
                <Input
                  id="wl-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="npr. Favoriti"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Otkazi
                </Button>
                <Button onClick={() => void handleCreate()}>Kreiraj</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md" role="dialog">
            <CardHeader>
              <CardTitle>Preimenuj listu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wl-rename">Naziv</Label>
                <Input
                  id="wl-rename"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRenameOpen(null)}>
                  Otkazi
                </Button>
                <Button onClick={() => void handleRename()}>Sacuvaj</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md" role="dialog">
            <CardHeader>
              <CardTitle>Obrisati listu?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Lista &quot;{deleteOpen.name}&quot; i sve stavke ce biti trajno uklonjene.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteOpen(null)}>
                  Otkazi
                </Button>
                <Button variant="destructive" onClick={() => void handleDelete()}>
                  Obrisi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
