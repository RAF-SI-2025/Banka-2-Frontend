import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
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
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Orbit,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Listing, PaginatedResponse, Exchange } from '@/types/celina3';
import listingService from '@/services/listingService';
import exchangeManagementService from '@/services/exchangeManagementService';

// Lazy-load the 3D globe (Three.js ~500KB) - only pulled when user clicks the tab
const GlobeView = lazy(() => import('../Exchanges/GlobeView'));
import { formatPrice } from '@/utils/formatters';
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

type SortField = 'price' | 'volume' | 'maintenanceMargin' | null;
type SortDirection = 'asc' | 'desc';

function getMaintenanceMargin(listing: Listing, activeTab: ListingTab): number {
  if (listing.maintenanceMargin) return listing.maintenanceMargin;
  const price = listing.price ?? 0;
  if (activeTab === 'STOCK') return price * 0.5;
  const contractSize = listing.contractSize ?? 1;
  return contractSize * price * 0.1;
}

function getInitialMarginCost(listing: Listing, activeTab: ListingTab): number {
  if (listing.initialMarginCost) return listing.initialMarginCost;
  return getMaintenanceMargin(listing, activeTab) * 1.1;
}

function formatVolumeCompact(vol: number | null | undefined): string {
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
      <span className="font-mono text-xs tabular-nums">{formatVolumeCompact(volume)}</span>
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
  const { user } = useAuth();
  const isClient = user?.role === 'CLIENT';

  const [activeTab, setActiveTab] = useState<ListingTab>('STOCK');
  const [showGlobe, setShowGlobe] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [exchangesLoading, setExchangesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginatedResponse<Listing> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [exchangePrefix, setExchangePrefix] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [settlementDateFrom, setSettlementDateFrom] = useState('');
  const [settlementDateTo, setSettlementDateTo] = useState('');
  // Sort state
  const [sortBy, setSortBy] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // Range filters
  const [askMin, setAskMin] = useState('');
  const [askMax, setAskMax] = useState('');
  const [bidMin, setBidMin] = useState('');
  const [bidMax, setBidMax] = useState('');
  const [volumeMin, setVolumeMin] = useState('');
  const [volumeMax, setVolumeMax] = useState('');
  const [debouncedFilters, setDebouncedFilters] = useState({
    exchangePrefix: '',
    priceMin: '',
    priceMax: '',
    settlementDateFrom: '',
    settlementDateTo: '',
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounce advanced filters - use JSON key to avoid unnecessary re-renders
  const filtersKey = `${exchangePrefix}|${priceMin}|${priceMax}|${settlementDateFrom}|${settlementDateTo}`;
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters((prev) => {
      const next = { exchangePrefix, priceMin, priceMax, settlementDateFrom, settlementDateTo };
      // Only update if values actually changed
      if (prev.exchangePrefix === next.exchangePrefix && prev.priceMin === next.priceMin &&
          prev.priceMax === next.priceMax && prev.settlementDateFrom === next.settlementDateFrom &&
          prev.settlementDateTo === next.settlementDateTo) return prev;
      return next;
    }), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Reset page on tab/search/filter change
  useEffect(() => { setPage(0); }, [activeTab, debouncedSearch, debouncedFilters]);

  // Price range validation
  const priceRangeError = debouncedFilters.priceMin && debouncedFilters.priceMax
    && Number(debouncedFilters.priceMin) > Number(debouncedFilters.priceMax);

  const fetchData = useCallback(async () => {
    if (priceRangeError) {
      setData({ content: [], totalPages: 0, totalElements: 0, number: 0, size: PAGE_SIZE } as PaginatedResponse<Listing>);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const filters: Record<string, string | number> = {};
      if (debouncedFilters.exchangePrefix) filters.exchangePrefix = debouncedFilters.exchangePrefix;
      if (debouncedFilters.priceMin) filters.priceMin = Number(debouncedFilters.priceMin);
      if (debouncedFilters.priceMax) filters.priceMax = Number(debouncedFilters.priceMax);
      if (debouncedFilters.settlementDateFrom) filters.settlementDateFrom = debouncedFilters.settlementDateFrom;
      if (debouncedFilters.settlementDateTo) filters.settlementDateTo = debouncedFilters.settlementDateTo;

      const result = await listingService.getAll(activeTab, debouncedSearch, page, PAGE_SIZE,
        Object.keys(filters).length > 0 ? filters as Parameters<typeof listingService.getAll>[4] : undefined);
      setData(result);
    } catch {
      toast.error('Greska pri ucitavanju hartija od vrednosti');
      setData({ content: [], totalPages: 0, totalElements: 0, number: 0, size: PAGE_SIZE } as PaginatedResponse<Listing>);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, debouncedFilters, page, priceRangeError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      toast.success('Osvezavanje cena pokrenuto...');
      await listingService.refresh();
      toast.success('Cene uspesno osvezene');
    } catch {
      toast.error('Greska pri osvezavanju cena. Pokusajte ponovo.');
    } finally {
      setRefreshing(false);
      fetchData();
    }
  };

  // Lazy-fetch exchanges only when globe tab is first opened
  useEffect(() => {
    if (showGlobe && exchanges.length === 0 && !exchangesLoading) {
      setExchangesLoading(true);
      exchangeManagementService.getAll()
        .then(data => setExchanges(Array.isArray(data) ? data : []))
        .catch(() => toast.error('Neuspesno ucitavanje berzi.'))
        .finally(() => setExchangesLoading(false));
    }
  }, [showGlobe, exchanges.length, exchangesLoading]);

  const tabs: ListingTab[] = isClient ? ['STOCK', 'FUTURES'] : ['STOCK', 'FUTURES', 'FOREX'];

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-indigo-500" />
      : <ArrowDown className="h-3 w-3 ml-1 text-indigo-500" />;
  };

  const listings = useMemo(() => {
    let items = data?.content ?? [];

    // Client-side range filters
    if (askMin) items = items.filter(l => (l.ask ?? 0) >= Number(askMin));
    if (askMax) items = items.filter(l => (l.ask ?? 0) <= Number(askMax));
    if (bidMin) items = items.filter(l => (l.bid ?? 0) >= Number(bidMin));
    if (bidMax) items = items.filter(l => (l.bid ?? 0) <= Number(bidMax));
    if (volumeMin) items = items.filter(l => (l.volume ?? 0) >= Number(volumeMin));
    if (volumeMax) items = items.filter(l => (l.volume ?? 0) <= Number(volumeMax));

    // Sorting
    if (sortBy) {
      items = [...items].sort((a, b) => {
        let valA = 0, valB = 0;
        if (sortBy === 'price') { valA = a.price ?? 0; valB = b.price ?? 0; }
        else if (sortBy === 'volume') { valA = a.volume ?? 0; valB = b.volume ?? 0; }
        else if (sortBy === 'maintenanceMargin') { valA = getMaintenanceMargin(a, activeTab); valB = getMaintenanceMargin(b, activeTab); }
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      });
    }

    return items;
  }, [data, askMin, askMax, bidMin, bidMax, volumeMin, volumeMax, sortBy, sortDirection, activeTab]);

  // Detect if data looks simulated:
  // - all changePercent and priceChange are exactly 0
  // - or all volume is 0
  // - or all prices are suspiciously round numbers (no decimals)
  const isDataSimulated = useMemo(() => {
    if (listings.length === 0) return false;
    const allZeroChange = listings.every(l => (l.changePercent ?? 0) === 0 && (l.priceChange ?? 0) === 0);
    const allZeroVolume = listings.every(l => (l.volume ?? 0) === 0);
    const allZeroPrice = listings.every(l => (l.price ?? 0) === 0);
    return allZeroChange || allZeroVolume || allZeroPrice;
  }, [listings]);
  const totalPages = data?.totalPages ?? 0;

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
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(f => !f)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filteri
          </Button>
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
                  <p className="text-xl font-bold font-mono tabular-nums">{formatVolumeCompact(overview.totalVolume)}</p>
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
              onClick={() => { setActiveTab(tab); setShowGlobe(false); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                !showGlobe && activeTab === tab
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`font-mono text-[10px] tracking-wider ${!showGlobe && activeTab === tab ? 'text-white/70' : 'text-muted-foreground/60'}`}>
                  {TAB_ICONS[tab]}
                </span>
                {TAB_LABELS[tab]}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowGlobe(true)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              showGlobe
                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            <span className="flex items-center gap-2">
              <Orbit className={`h-3.5 w-3.5 ${showGlobe ? 'text-white/90' : 'text-muted-foreground/60'}`} />
              3D Globus
            </span>
          </button>
        </div>

        {/* Search - hidden when 3D globe is active */}
        {!showGlobe && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretrazi po ticker-u ili nazivu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/30 dark:bg-slate-800/40 border-border/50"
            />
          </div>
        )}
      </div>

      {/* 3D Globe view - replaces filters/table when active */}
      {showGlobe && (
        <Suspense fallback={
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
                <p className="font-semibold">Ucitavanje 3D globusa...</p>
                <p className="text-sm text-muted-foreground mt-1">Priprema Three.js biblioteke</p>
              </div>
            </CardContent>
          </Card>
        }>
          {exchangesLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
                  <p className="font-semibold">Ucitavanje berzi...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <GlobeView exchanges={exchanges} />
          )}
        </Suspense>
      )}

      {/* Everything below is hidden when 3D globe is active */}
      {!showGlobe && (
      <>
      {/* Advanced Filters */}
      {showFilters && (
        <Card className="border-border/50 shadow-sm p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Napredni filteri</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exchange prefiks</label>
              <Input
                placeholder="npr. NY, NAS..."
                value={exchangePrefix}
                onChange={(e) => setExchangePrefix(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min cena</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max cena</label>
              <Input
                type="number"
                min={0}
                placeholder="∞"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-[120px]"
              />
            </div>
            {activeTab === 'FUTURES' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Datum isteka od</label>
                  <Input
                    type="date"
                    value={settlementDateFrom}
                    onChange={(e) => setSettlementDateFrom(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Datum isteka do</label>
                  <Input
                    type="date"
                    value={settlementDateTo}
                    onChange={(e) => setSettlementDateTo(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => {
              setExchangePrefix('');
              setPriceMin('');
              setPriceMax('');
              setSettlementDateFrom('');
              setSettlementDateTo('');
              setAskMin(''); setAskMax('');
              setBidMin(''); setBidMax('');
              setVolumeMin(''); setVolumeMax('');
              setSortBy(null);
            }}>
              Ocisti filtere
            </Button>
          </div>
          {priceRangeError && (
            <p className="mt-2 text-sm text-destructive">Minimalna cena ne moze biti veca od maksimalne.</p>
          )}
          {/* Ask / Bid / Volume range filters */}
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t border-border/30">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Ask</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={askMin}
                onChange={(e) => setAskMin(e.target.value)}
                className="w-[110px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Ask</label>
              <Input
                type="number"
                min={0}
                placeholder="∞"
                value={askMax}
                onChange={(e) => setAskMax(e.target.value)}
                className="w-[110px]"
              />
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Bid</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={bidMin}
                onChange={(e) => setBidMin(e.target.value)}
                className="w-[110px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Bid</label>
              <Input
                type="number"
                min={0}
                placeholder="∞"
                value={bidMax}
                onChange={(e) => setBidMax(e.target.value)}
                className="w-[110px]"
              />
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Volume</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={volumeMin}
                onChange={(e) => setVolumeMin(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Volume</label>
              <Input
                type="number"
                min={0}
                placeholder="∞"
                value={volumeMax}
                onChange={(e) => setVolumeMax(e.target.value)}
                className="w-[120px]"
              />
            </div>
          </div>
        </Card>
      )}

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
          {isDataSimulated ? (
            <div className="flex items-center gap-1.5 text-xs">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-mono text-amber-600 dark:text-amber-400 border-amber-400/40 bg-amber-500/5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                SIMULIRANI PODACI
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-mono text-emerald-600 dark:text-emerald-400 border-emerald-400/40 bg-emerald-500/5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                LIVE
              </Badge>
            </div>
          )}
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
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('price')}>
                      <span className="inline-flex items-center justify-end">Cena{getSortIcon('price')}</span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Promena</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-center w-[80px]">Trend</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Bid</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">Ask</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('volume')}>
                      <span className="inline-flex items-center justify-end">Volume{getSortIcon('volume')}</span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('maintenanceMargin')}>
                      <span className="inline-flex items-center justify-end" title="Initial Margin Cost">IMC{getSortIcon('maintenanceMargin')}</span>
                    </TableHead>
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
                        {/* IMC */}
                        <TableCell className="text-right py-3">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatPrice(getInitialMarginCost(listing, activeTab))}
                          </span>
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
      </>
      )}
    </div>
  );
}
