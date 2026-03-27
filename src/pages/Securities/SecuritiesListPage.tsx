import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  LineChart, Line, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Listing, PaginatedResponse } from '@/types/celina3';
import listingService from '@/services/listingService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ListingTab = 'STOCK' | 'FUTURES' | 'FOREX';

const TAB_LABELS: Record<ListingTab, string> = {
  STOCK: 'Akcije',
  FUTURES: 'Futures',
  FOREX: 'Forex',
};

const TAB_ICONS: Record<ListingTab, string> = {
  STOCK: 'STCK',
  FUTURES: 'FUTR',
  FOREX: 'FX',
};

const PAGE_SIZE = 20;

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '-';
  return price.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(vol: number | null | undefined): string {
  if (vol == null) return '-';
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toLocaleString('sr-RS');
}

// Deterministic sparkline based on ticker string so it doesn't change on re-render
function generateStableSparkline(ticker: string, price: number): number[] {
  const seed = ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const points: number[] = [];
  let p = price * 0.98;
  let s = seed;
  for (let i = 0; i < 7; i++) {
    s = (s * 9301 + 49297) % 233280;
    const rnd = s / 233280;
    p += (rnd - 0.48) * price * 0.02;
    points.push(Math.round(p * 100) / 100);
  }
  return points;
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map((v, i) => ({ v, i }));
  const color = positive ? '#10B981' : '#EF4444';
  return (
    <div className="w-[60px] h-[30px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolumeBar({ volume, maxVolume }: { volume: number; maxVolume: number }) {
  const pct = maxVolume > 0 ? Math.min((volume / maxVolume) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs tabular-nums">{formatVolume(volume)}</span>
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500/40 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SecuritiesListPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const isClient = !isAdmin;

  const [activeTab, setActiveTab] = useState<ListingTab>('STOCK');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginatedResponse<Listing> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on tab/search change
  useEffect(() => { setPage(0); }, [activeTab, debouncedSearch]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listingService.getAll(activeTab, debouncedSearch, page, PAGE_SIZE);
      setData(result);
    } catch {
      setData({ content: [], totalPages: 0, totalElements: 0, number: 0, size: PAGE_SIZE } as PaginatedResponse<Listing>);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await listingService.refresh();
      toast.success('Cene uspesno osvezene');
      fetchData();
    } catch {
      toast.error('Greska pri osvezavanju cena');
    } finally {
      setRefreshing(false);
    }
  };

  const tabs: ListingTab[] = isClient ? ['STOCK', 'FUTURES'] : ['STOCK', 'FUTURES', 'FOREX'];
  const listings = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  // Compute market overview from current listings
  const overview = useMemo(() => {
    if (listings.length === 0) return null;
    const totalVolume = listings.reduce((sum, l) => sum + (l.volume ?? 0), 0);
    let topGainer = listings[0];
    let topLoser = listings[0];
    for (const l of listings) {
      if ((l.changePercent ?? 0) > (topGainer.changePercent ?? 0)) topGainer = l;
      if ((l.changePercent ?? 0) < (topLoser.changePercent ?? 0)) topLoser = l;
    }
    return { totalVolume, topGainer, topLoser, count: data?.totalElements ?? listings.length };
  }, [listings, data?.totalElements]);

  const maxVolume = useMemo(
    () => Math.max(...listings.map(l => l.volume ?? 0), 1),
    [listings]
  );

  return (
    <div className="container mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hartije od vrednosti</h1>
            <p className="text-sm text-muted-foreground">
              Pregledajte i trgujte akcijama, futures ugovorima{!isClient && ' i forex parovima'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Osvezi cene
        </Button>
      </div>

      {/* Market Overview Cards */}
      {!loading && overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total count */}
          <Card className="border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ukupno hartija</p>
                  <p className="text-xl font-bold font-mono tabular-nums">{overview.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Gainer */}
          <Card className="border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Najveci rast</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-sm">{overview.topGainer.ticker}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-semibold">
                      +{(overview.topGainer.changePercent ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Loser */}
          <Card className="border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Najveci pad</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-sm">{overview.topLoser.ticker}</span>
                    <span className="text-red-600 dark:text-red-400 font-mono text-sm font-semibold">
                      {(overview.topLoser.changePercent ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Volume */}
          <Card className="border-0 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ukupan promet</p>
                  <p className="text-xl font-bold font-mono tabular-nums">{formatVolume(overview.totalVolume)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs + Search row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Pill-style tabs with gradient */}
        <div className="flex gap-1 bg-muted/60 dark:bg-slate-800/60 p-1 rounded-xl border border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`font-mono text-[10px] tracking-wider ${activeTab === tab ? 'text-white/70' : 'text-muted-foreground/60'}`}>
                  {TAB_ICONS[tab]}
                </span>
                {TAB_LABELS[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pretrazi po ticker-u ili nazivu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/30 dark:bg-slate-800/40 border-border/50"
          />
        </div>
      </div>

      {/* Trading Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between bg-muted/20 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <span className="font-semibold text-sm">{TAB_LABELS[activeTab]}</span>
            {data && (
              <Badge variant="secondary" className="text-xs font-mono">
                {data.totalElements}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className="font-mono">LIVE</span>
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-muted-foreground">Nema hartija</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {debouncedSearch
                  ? `Nema rezultata za "${debouncedSearch}"`
                  : 'Nema dostupnih hartija za ovaj tip'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 dark:bg-slate-900/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 w-[130px]">Ticker</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Naziv</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Cena</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Promena</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-center w-[80px]">Trend</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Bid</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Ask</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Volume</TableHead>
                    {activeTab === 'FUTURES' && <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Istek</TableHead>}
                    {activeTab === 'FOREX' && <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Par</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((listing) => {
                    const change = listing.priceChange ?? 0;
                    const changePct = listing.changePercent ?? 0;
                    const isPositive = change >= 0;
                    const sparkData = generateStableSparkline(listing.ticker, listing.price);

                    return (
                      <TableRow
                        key={listing.id}
                        className="cursor-pointer group transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-b border-border/30"
                        onClick={() => navigate(`/securities/${listing.id}`)}
                      >
                        {/* Ticker with colored left border */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-0.5 h-8 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="font-mono text-sm font-bold tracking-wide text-foreground">
                              {listing.ticker}
                            </span>
                          </div>
                        </TableCell>
                        {/* Name */}
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-sm truncate max-w-[180px]">{listing.name || '-'}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{listing.exchangeAcronym}</span>
                          </div>
                        </TableCell>
                        {/* Price */}
                        <TableCell className="text-right py-3">
                          <span className="font-mono text-sm font-bold tabular-nums">
                            {formatPrice(listing.price)}
                          </span>
                        </TableCell>
                        {/* Change badge */}
                        <TableCell className="text-right py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold font-mono tabular-nums ${
                              isPositive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20'
                            }`}>
                              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                            </span>
                          </div>
                        </TableCell>
                        {/* Mini sparkline */}
                        <TableCell className="py-3">
                          <div className="flex justify-center">
                            <MiniSparkline data={sparkData} positive={isPositive} />
                          </div>
                        </TableCell>
                        {/* Bid */}
                        <TableCell className="text-right py-3">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatPrice(listing.bid)}
                          </span>
                        </TableCell>
                        {/* Ask */}
                        <TableCell className="text-right py-3">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatPrice(listing.ask)}
                          </span>
                        </TableCell>
                        {/* Volume with bar */}
                        <TableCell className="text-right py-3">
                          <VolumeBar volume={listing.volume ?? 0} maxVolume={maxVolume} />
                        </TableCell>
                        {activeTab === 'FUTURES' && (
                          <TableCell className="py-3">
                            <span className="text-xs font-mono text-muted-foreground">
                              {listing.settlementDate
                                ? new Date(listing.settlementDate).toLocaleDateString('sr-RS')
                                : '-'}
                            </span>
                          </TableCell>
                        )}
                        {activeTab === 'FOREX' && (
                          <TableCell className="py-3">
                            <span className="font-mono text-xs font-semibold">
                              {listing.ticker || '-'}
                            </span>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-muted/10">
              <p className="text-xs text-muted-foreground font-mono">
                Strana {page + 1} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-8 text-xs"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Prethodna
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-8 text-xs"
                >
                  Sledeca
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
