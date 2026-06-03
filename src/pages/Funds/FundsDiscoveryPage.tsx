import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PiggyBank,
  Plus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import investmentFundService from '@/services/investmentFundService';
import fundStatisticsService from '@/services/fundStatisticsService';
import type { InvestmentFundSummary } from '@/types/celina4';
import type { FundStatisticsDto } from '@/types/fundStatistics';
import { formatAmount } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
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

// ============================================================
// FE4 (7.2) — Statistika fondova (Developer: Jovan Krunic)
// Tabela fondova prosirena metrikama performansi (B12). Za svaki fond se
// paralelno dohvata GET /funds/{id}/statistics; dok B12 nije dostupan (404)
// ili nema dovoljno istorije, metrike se prikazuju kao „—".
// ============================================================

// FE-FND-04 fix: module-level cache za fund statistics. Pre fix-a, efekat sa
// `[funds]` dep-om je refetch-ovao statistike kad god se funds array preracunao
// (filter/sort change → fetchFunds → setFunds → ovaj useEffect → N+1).
// Sad keshira po fundId, fetch se dogadja samo za fondove koji jos nisu u cache-u.
//
// R1 853: cache je RANIJE bio modul-level bez invalidacije → metrike fonda su
// ostajale zamrznute za citavu SPA sesiju (snapshot scheduler ih azurira na BE,
// ali FE nikad nije refetch-ovao). Dodajemo TTL: ulaz stariji od `STATS_CACHE_TTL_MS`
// se tretira kao odsutan i ponovo dohvata.
const STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuta
type CachedStats = { value: FundStatisticsDto; fetchedAt: number };
const STATS_CACHE = new Map<number, CachedStats>();

/** Vrati kesirane statistike ako postoje i nisu istekle (TTL), inace undefined. */
function readFreshStats(fundId: number, now: number = Date.now()): FundStatisticsDto | undefined {
  const entry = STATS_CACHE.get(fundId);
  if (!entry) return undefined;
  if (now - entry.fetchedAt > STATS_CACHE_TTL_MS) {
    STATS_CACHE.delete(fundId);
    return undefined;
  }
  return entry.value;
}

/** Exposed za test isolation — tests trebaju clear izmedju `it` blokova. */
export function __clearFundStatsCache() {
  STATS_CACHE.clear();
}

/** Sortabilne metricke kolone -> odgovarajuce polje u FundStatisticsDto. */
const METRIC_KEY = {
  annualizedReturn: 'annualizedReturnPercent',
  rewardToVariability: 'rewardToVariabilityRatio',
  maxDrawdown: 'maxDrawdownPercent',
  volatility: 'volatilityPercent',
} as const;

type MetricSortField = keyof typeof METRIC_KEY;
type SortField =
  | 'name'
  | 'fundValue'
  | 'profit'
  | 'minimumContribution'
  | MetricSortField;
type SortDirection = 'asc' | 'desc';

/** Celija tabele za jednu metriku fonda; `null` (nedovoljno istorije / B12 nedostupan) -> „—". */
function MetricCell({
  value,
  suffix = '%',
  colored = false,
}: {
  value: number | null;
  suffix?: string;
  colored?: boolean;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  }
  const formatted = value.toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const colorClass = colored ? (value >= 0 ? 'text-emerald-500' : 'text-red-500') : '';
  return (
    <TableCell className={`text-right font-mono tabular-nums ${colorClass}`}>
      {formatted}
      {suffix}
    </TableCell>
  );
}

/** Ikonica smera sortiranja u zaglavlju kolone tabele. */
function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
}) {
  if (activeField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return direction === 'asc' ? (
    <ArrowUp className="h-3 w-3 ml-1" />
  ) : (
    <ArrowDown className="h-3 w-3 ml-1" />
  );
}

export default function FundsDiscoveryPage() {
  const navigate = useNavigate();
  const { isSupervisor } = useAuth();

  const [funds, setFunds] = useState<InvestmentFundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // FE4 (7.2) — metrike fondova, keširane po fundId.
  const [fundStats, setFundStats] = useState<Record<number, FundStatisticsDto>>({});
  // true kad je bar jedan ciklus dohvatanja metrika završen (za „nedostupno" poruku).
  const [statsChecked, setStatsChecked] = useState(false);
  // Numericki filteri (min/max) — string state za UX (prazno polje = bez filtera).
  const [minContribution, setMinContribution] = useState('');
  const [maxContribution, setMaxContribution] = useState('');
  const [minFundValue, setMinFundValue] = useState('');
  const [maxFundValue, setMaxFundValue] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [maxProfit, setMaxProfit] = useState('');
  const [debouncedFilters, setDebouncedFilters] = useState({
    minContribution: '', maxContribution: '',
    minFundValue: '', maxFundValue: '',
    minProfit: '', maxProfit: '',
  });

  // Debounce search + numeric filters (jedan timer za sve da bi se izbegao spam BE poziva)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedFilters({
        minContribution, maxContribution,
        minFundValue, maxFundValue,
        minProfit, maxProfit,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, minContribution, maxContribution, minFundValue, maxFundValue, minProfit, maxProfit]);

  const parseNum = (s: string): number | undefined => {
    if (!s.trim()) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      // Metricke kolone BE ne zna da sortira — za njih ne saljemo sort param,
      // sortiranje tih kolona radi client-side `sortedFunds`.
      const isMetricSort = sortBy in METRIC_KEY;
      const result = await investmentFundService.list({
        search: debouncedSearch || undefined,
        sort: isMetricSort ? undefined : sortBy,
        direction: isMetricSort ? undefined : sortDirection,
        minContribution: parseNum(debouncedFilters.minContribution),
        maxContribution: parseNum(debouncedFilters.maxContribution),
        minFundValue: parseNum(debouncedFilters.minFundValue),
        maxFundValue: parseNum(debouncedFilters.maxFundValue),
        minProfit: parseNum(debouncedFilters.minProfit),
        maxProfit: parseNum(debouncedFilters.maxProfit),
      });
      setFunds(result);
    } catch {
      toast.error('Greška pri učitavanju fondova');
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortBy, sortDirection, debouncedFilters]);

  useEffect(() => { fetchFunds(); }, [fetchFunds]);

  // FE-FND-04 fix: keshirano per fundId u STATS_CACHE — fetch samo za nove
  // fondove. Pre fix-a: dep `funds` → svaki filter/sort change triggera N+1
  // ponavljanje GET /funds/{id}/statistics. Sad rezultat se reuse-uje.
  useEffect(() => {
    if (funds.length === 0) return;
    let cancelled = false;

    // Inicijalno setuj postojeci (jos uvek svez) cache (sync) tako da UI vec moze
    // da prikaze metrike za poznate fondove pre nego sto fetch zavrsi. Istekle
    // ulaze `readFreshStats` izbacuje pa se tretiraju kao da nedostaju.
    const now = Date.now();
    const initialMap: Record<number, FundStatisticsDto> = {};
    funds.forEach((f) => {
      const cached = readFreshStats(f.id, now);
      if (cached) initialMap[f.id] = cached;
    });
    setFundStats(initialMap);

    // Identifikuj fondove koji nemaju (svez) keshiran rezultat.
    const missingIds = funds.map((f) => f.id).filter((id) => initialMap[id] === undefined);

    if (missingIds.length === 0) {
      setStatsChecked(true);
      return;
    }

    void Promise.allSettled(
      missingIds.map((id) => fundStatisticsService.getFundStatistics(id)),
    ).then((results) => {
      if (cancelled) return;
      const updated: Record<number, FundStatisticsDto> = { ...initialMap };
      results.forEach((r, i) => {
        const fid = missingIds[i];
        if (r.status === 'fulfilled') {
          STATS_CACHE.set(fid, { value: r.value, fetchedAt: Date.now() });
          updated[fid] = r.value;
        }
      });
      setFundStats(updated);
      setStatsChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [funds]);

  // Metricka vrednost fonda za sortiranje; null ako stats nema ili metrika nije izracunata.
  const metricValue = useCallback(
    (fundId: number, field: MetricSortField): number | null => {
      const stats = fundStats[fundId];
      if (!stats) return null;
      const v = stats[METRIC_KEY[field]];
      return typeof v === 'number' ? v : null;
    },
    [fundStats],
  );

  // Client-side sort fallback (in case backend doesn't sort)
  const sortedFunds = useMemo(() => {
    const sorted = [...funds];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'sr-RS');
          break;
        case 'fundValue':
          cmp = a.fundValue - b.fundValue;
          break;
        case 'profit':
          cmp = a.profit - b.profit;
          break;
        case 'minimumContribution':
          cmp = a.minimumContribution - b.minimumContribution;
          break;
        case 'annualizedReturn':
        case 'rewardToVariability':
        case 'maxDrawdown':
        case 'volatility': {
          const av = metricValue(a.id, sortBy);
          const bv = metricValue(b.id, sortBy);
          // Fondovi bez metrike uvek idu na kraj, nezavisno od smera sortiranja.
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          cmp = av - bv;
          break;
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [funds, sortBy, sortDirection, metricValue]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PiggyBank className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Investicioni fondovi</h1>
        </div>
        {isSupervisor && (
          <Button onClick={() => navigate('/funds/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Kreiraj fond
          </Button>
        )}
      </div>

      {/* Search + numericki filteri */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po nazivu ili opisu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Min. ulog (RSD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="od"
                  value={minContribution}
                  onChange={e => setMinContribution(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="do"
                  value={maxContribution}
                  onChange={e => setMaxContribution(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Vrednost fonda (RSD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="od"
                  value={minFundValue}
                  onChange={e => setMinFundValue(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="do"
                  value={maxFundValue}
                  onChange={e => setMaxFundValue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Profit (RSD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="od"
                  value={minProfit}
                  onChange={e => setMinProfit(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="do"
                  value={maxProfit}
                  onChange={e => setMaxProfit(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : sortedFunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Nema dostupnih fondova</p>
              {debouncedSearch && (
                <p className="text-sm mt-1">Pokušajte sa drugačijim terminom pretrage</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {statsChecked && funds.length > 0 && Object.keys(fundStats).length === 0 && (
                <p className="px-6 pt-4 text-xs text-muted-foreground">
                  Metrike fondova trenutno nisu dostupne (B12 endpoint još nije aktivan).
                </p>
              )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Naziv
                      <SortIcon field="name" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Opis</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('minimumContribution')}
                  >
                    <div className="flex items-center justify-end">
                      Min. ulog
                      <SortIcon field="minimumContribution" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('fundValue')}
                  >
                    <div className="flex items-center justify-end">
                      Vrednost
                      <SortIcon field="fundValue" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('profit')}
                  >
                    <div className="flex items-center justify-end">
                      Profit
                      <SortIcon field="profit" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('annualizedReturn')}
                    title="Anualizovani (godišnji) prinos"
                  >
                    <div className="flex items-center justify-end">
                      Godišnji prinos
                      <SortIcon field="annualizedReturn" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('rewardToVariability')}
                    title="Odnos prinosa i rizika (Sharpe-like) — viši je bolji"
                  >
                    <div className="flex items-center justify-end">
                      Prinos/rizik
                      <SortIcon field="rewardToVariability" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('maxDrawdown')}
                    title="Maksimalni pad vrednosti od vrha do dna"
                  >
                    <div className="flex items-center justify-end">
                      Max pad
                      <SortIcon field="maxDrawdown" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('volatility')}
                    title="Volatilnost — standardna devijacija mesečnih prinosa"
                  >
                    <div className="flex items-center justify-end">
                      Volatilnost
                      <SortIcon field="volatility" activeField={sortBy} direction={sortDirection} />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFunds.map(fund => (
                  <TableRow
                    key={fund.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/funds/${fund.id}`)}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">{fund.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fund.managerName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[300px]">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {fund.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatAmount(fund.minimumContribution)} RSD
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">
                      {formatAmount(fund.fundValue)} RSD
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {fund.profit >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={`font-mono tabular-nums font-medium ${
                            fund.profit >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {formatAmount(fund.profit)} RSD
                        </span>
                      </div>
                    </TableCell>
                    <MetricCell value={metricValue(fund.id, 'annualizedReturn')} colored />
                    <MetricCell value={metricValue(fund.id, 'rewardToVariability')} suffix="" />
                    <MetricCell value={metricValue(fund.id, 'maxDrawdown')} colored />
                    <MetricCell value={metricValue(fund.id, 'volatility')} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
