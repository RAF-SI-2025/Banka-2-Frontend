import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Listing, PaginatedResponse } from '@/types/celina3';
import listingService from '@/services/listingService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Hartije od vrednosti</h1>
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
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Osvezi cene
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretrazi po ticker-u ili nazivu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            {TAB_LABELS[activeTab]}
            {data && (
              <Badge variant="secondary" className="ml-2">
                {data.totalElements}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Nema hartija</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {debouncedSearch
                  ? `Nema rezultata za "${debouncedSearch}"`
                  : 'Nema dostupnih hartija za ovaj tip'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Berza</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-right">Promena</TableHead>
                  <TableHead className="text-right">Promena %</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  {activeTab === 'FUTURES' && <TableHead>Datum isteka</TableHead>}
                  {activeTab === 'FOREX' && <TableHead>Par</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => {
                  const change = listing.priceChange ?? 0;
                  const changePct = listing.changePercent ?? 0;
                  const isPositive = change >= 0;

                  return (
                    <TableRow
                      key={listing.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/securities/${listing.id}`)}
                    >
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-500/30">
                          {listing.ticker}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {listing.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{listing.exchangeAcronym || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(listing.price)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        <span className="inline-flex items-center gap-1">
                          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPrice(Math.abs(change))}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatVolume(listing.volume)}
                      </TableCell>
                      {activeTab === 'FUTURES' && (
                        <TableCell>
                          {listing.settlementDate
                            ? new Date(listing.settlementDate).toLocaleDateString('sr-RS')
                            : '-'}
                        </TableCell>
                      )}
                      {activeTab === 'FOREX' && (
                        <TableCell className="font-mono">
                          {listing.ticker || '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Strana {page + 1} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prethodna
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Sledeca
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
