import { Component, Fragment, useEffect, useState, useMemo, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Coins,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

import portfolioService from '@/services/portfolioService';
import taxService from '@/services/taxService';
import dividendService from '@/services/dividendService';
import { toast } from '@/lib/notify';
import type { PortfolioItem, PortfolioSummary, TaxBreakdownItemDto } from '@/types/celina3';
import type { DividendPayoutDto } from '@/types/dividend';
import { formatAmount, formatDate, formatDateTime } from '@/utils/formatters';
import { parseNumber } from '@/utils/numberUtils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import MyFundsTab from '@/pages/Funds/MyFundsTab';

// ============================================================
// FE4 (7.1) — Istorija dividendi u portfoliju (Developer: Jovan Krunic)
// Uz svaku STOCK poziciju prikazuje se expand red sa istorijom primljenih
// dividendi (datum isplate, bruto, porez, neto, valuta). Podaci se lazy-load-uju
// sa B9 endpoint-a GET /dividends/by-position/{portfolioId} prvi put kad se
// pozicija razvije; 404/501/405 se tretira kao "BE jos nije dostupan".
// ============================================================

type DividendLoadStatus = 'loading' | 'ready' | 'error' | 'unavailable';

/**
 * Inline panel sa istorijom primljenih dividendi za jednu STOCK poziciju —
 * renderuje se kao expand red ispod reda hartije u tabeli portfolija.
 */
function DividendHistoryPanel({
  status,
  rows,
}: {
  status: DividendLoadStatus | undefined;
  rows: DividendPayoutDto[] | undefined;
}) {
  if (status === undefined || status === 'loading') {
    return (
      <div className="space-y-2 py-2" data-testid="dividend-history-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <Alert data-testid="dividend-history-unavailable">
        <AlertDescription>
          Istorija dividendi trenutno nije dostupna (BE endpoint nije implementiran).
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive" data-testid="dividend-history-error">
        <AlertDescription>
          Greška pri učitavanju istorije dividendi. Pokušajte ponovo kasnije.
        </AlertDescription>
      </Alert>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div
        className="flex flex-col items-center py-6 text-center"
        data-testid="dividend-history-empty"
      >
        <Coins className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Nema primljenih dividendi za ovu poziciju</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Kvartalne isplate dividendi će se prikazati ovde.
        </p>
      </div>
    );
  }

  const totalNet = rows.reduce((sum, r) => sum + (Number(r.netAmount) || 0), 0);
  const currency = rows[0]?.currencyCode ?? '';

  return (
    <div className="space-y-2 py-2" data-testid="dividend-history-table">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Coins className="h-4 w-4 text-amber-500" />
        Istorija primljenih dividendi
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum isplate</TableHead>
            <TableHead className="text-right">Količina</TableHead>
            <TableHead className="text-right">Bruto</TableHead>
            <TableHead className="text-right">Porez</TableHead>
            <TableHead className="text-right">Neto</TableHead>
            <TableHead>Valuta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDate(r.paymentDate)}</TableCell>
              <TableCell className="text-right font-mono">
                {formatAmount(r.quantity, 0)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatAmount(r.grossAmount)}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                {r.taxExempt ? '—' : formatAmount(r.tax)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatAmount(r.netAmount)}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.currencyCode}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-right text-xs text-muted-foreground">
        Ukupno neto primljeno:{' '}
        <span className="font-semibold text-foreground">
          {formatAmount(totalNet)} {currency}
        </span>
      </p>
    </div>
  );
}

function formatPercent(value: number | null | undefined): string {
  const num = typeof value === 'number' ? value : parseNumber(value);
  return `${num.toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function getListingTypeLabel(type: PortfolioItem['listingType']): string {
  switch (type) {
    case 'STOCK':
      return 'Akcija';
    case 'FUTURES':
      return 'Fjučers';
    case 'FOREX':
      return 'Forex';
    default:
      return String(type);
  }
}

function getListingTypeBadgeVariant(
  type: PortfolioItem['listingType']
): 'success' | 'secondary' | 'outline' {
  switch (type) {
    case 'STOCK':
      return 'success';
    case 'FUTURES':
      return 'secondary';
    case 'FOREX':
      return 'outline';
    default:
      return 'outline';
  }
}

function PortfolioProfitChart({ items }: { items: PortfolioItem[] }) {
  const data = useMemo(() => {
    return items.map((item) => ({
      name: item.listingTicker,
      profit: item.profit,
      value: item.quantity * item.currentPrice,
    }));
  }, [items]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
          Profit po hartijama
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatAmount(v, 0)}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              formatter={(value: unknown) => [formatAmount(Number(value)), 'Profit']}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar
              dataKey="profit"
              radius={[4, 4, 0, 0]}
              animationDuration={800}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { profit: number } }) => {
                const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                const fill = (payload?.profit ?? 0) >= 0 ? '#10b981' : '#ef4444';
                const safeWidth = Math.max(0, width);
                const safeHeight = Math.max(0, Math.abs(height));
                const safeY = height < 0 ? y + height : y;
                if (safeWidth === 0 || safeHeight === 0) return <g />;
                return (
                  <rect x={x} y={safeY} width={safeWidth} height={safeHeight} fill={fill} rx={4} ry={4} />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const PIE_COLORS: Record<string, string> = {
  STOCK: '#6366f1',   // indigo
  FUTURES: '#f59e0b', // amber
  FOREX: '#10b981',   // emerald
};

const PIE_LABELS: Record<string, string> = {
  STOCK: 'Akcije',
  FUTURES: 'Fjučersi',
  FOREX: 'Forex',
};

function SummarySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-8 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-9 gap-4">
            {Array.from({ length: 9 }).map((__, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

class ChartErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function PortfolioDistributionChart({ items }: { items: PortfolioItem[] }) {
  const data = useMemo(() => {
    const groups: Record<string, number> = {};
    items.forEach((item) => {
      const type = item.listingType || 'OTHER';
      const value = item.quantity * item.currentPrice;
      groups[type] = (groups[type] ?? 0) + value;
    });
    return Object.entries(groups).map(([type, value]) => ({
      name: PIE_LABELS[type] ?? type,
      value,
      type,
    }));
  }, [items]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
          Distribucija portfolija
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={55}
              paddingAngle={3}
              label={(props: PieLabelRenderProps) =>
                `${String(props.name ?? '')} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`
              }
            >
              {data.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={PIE_COLORS[entry.type] ?? '#94a3b8'}
                  strokeWidth={0}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatAmount(Number(value))}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [publicQuantities, setPublicQuantities] = useState<Record<number, string>>({});
  const [savingPublicId, setSavingPublicId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'funds' | 'tax'>('holdings');

  // P2.4 — per-listing porez breakdown za trenutnog korisnika.
  // Lazy-loaded: fetcha se prvi put kad user otvori "Porez breakdown" tab.
  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdownItemDto[] | null>(null);
  const [taxBreakdownLoading, setTaxBreakdownLoading] = useState(false);
  const [taxBreakdownError, setTaxBreakdownError] = useState<'unavailable' | 'error' | null>(null);

  // FE4 (7.1) — istorija dividendi po STOCK poziciji. Lazy-loaded prvi put kad
  // se pozicija razvije; rezultat se kesira po id-u pozicije.
  const [expandedDividends, setExpandedDividends] = useState<number | null>(null);
  const [dividendCache, setDividendCache] = useState<Record<number, DividendPayoutDto[]>>({});
  const [dividendStatus, setDividendStatus] = useState<Record<number, DividendLoadStatus>>({});

  useEffect(() => {
    if (activeTab !== 'tax') return;
    if (taxBreakdown !== null) return; // vec ucitan
    let cancelled = false;
    setTaxBreakdownLoading(true);
    setTaxBreakdownError(null);
    void taxService
      .getMyPerListingBreakdown()
      .then((items) => {
        if (cancelled) return;
        setTaxBreakdown(Array.isArray(items) ? items : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const httpErr = err as { response?: { status?: number } };
        const httpStatus = httpErr?.response?.status;
        if (httpStatus === 404 || httpStatus === 501 || httpStatus === 405) {
          setTaxBreakdownError('unavailable');
        } else {
          setTaxBreakdownError('error');
        }
        setTaxBreakdown([]);
      })
      .finally(() => {
        if (!cancelled) setTaxBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, taxBreakdown]);

  const loadPortfolio = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    setError('');

    try {
      const [summaryResponse, portfolioResponse] = await Promise.all([
        portfolioService.getSummary(),
        portfolioService.getMyPortfolio(),
      ]);

      const safeSummary = summaryResponse ?? {
        totalValue: 0,
        totalProfit: 0,
        paidTaxThisYear: 0,
        unpaidTaxThisMonth: 0,
      };

      const safeItems = Array.isArray(portfolioResponse) ? portfolioResponse : [];

      setSummary(safeSummary);
      setItems(safeItems);

      const initialPublicValues: Record<number, string> = {};
      safeItems.forEach((item) => {
        initialPublicValues[item.id] = String(item.publicQuantity ?? 0);
      });
      setPublicQuantities(initialPublicValues);
    } catch {
      setError('Greška pri učitavanju portfolija. Pokušajte ponovo.');
      setSummary({
        totalValue: 0,
        totalProfit: 0,
        paidTaxThisYear: 0,
        unpaidTaxThisMonth: 0,
      });
      setItems([]);
      setPublicQuantities({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  const handleSell = (item: PortfolioItem) => {
    navigate(`/orders/new?listingId=${item.listingId}&direction=SELL`);
  };

  const handlePublicQuantityChange = (id: number, e: ChangeEvent<HTMLInputElement>) => {
    setPublicQuantities((prev) => ({
      ...prev,
      [id]: e.target.value,
    }));
  };

  const handleSavePublicQuantity = async (item: PortfolioItem) => {
    const rawValue = publicQuantities[item.id] ?? '0';
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Količina za javni režim mora biti 0 ili veća.');
      return;
    }

    // Spec Celina 4 (Nova): publicQuantity ne sme biti veca od ukupne
    // kolicine akcija. BE inace odbija sa 400, ali UI-side validacija
    // daje brzi feedback bez network round-trip-a.
    const totalQuantity = Number(item.quantity) || 0;
    if (parsed > totalQuantity) {
      toast.error(
        `Javna kolicina (${parsed}) ne moze biti veca od ukupne kolicine (${totalQuantity}).`,
      );
      return;
    }

    setSavingPublicId(item.id);

    try {
      await portfolioService.setPublicQuantity(item.id, parsed);
      if (parsed > 0) {
        toast.success(
          `${parsed} ${item.listingTicker} akcija je sad javno vidljivo na OTC portalu — drugi korisnici mogu da vam posalju ponudu.`,
        );
      } else {
        toast.success(`${item.listingTicker} akcije su uklonjene iz javnog rezima.`);
      }
      // Refetch kompletnog portfolija da garantujemo persist i sync sa backend-om
      await loadPortfolio(false);
    } catch {
      toast.error('Čuvanje javne količine nije uspelo.');
    } finally {
      setSavingPublicId(null);
    }
  };

  // [OT-1218 — REKLASIFIKOVANO] Exercise plain-opcije NE pripada portfolio strani:
  // ListingType = {STOCK, FUTURES, FOREX} (nema OPTION) pa portfolio red nikad ne
  // predstavlja opcionu poziciju. Pravi exercise entry point je lanac opcija na
  // SecuritiesDetailsPage (OptionItem.id = pravi Option.id). Ranije dead-wiring
  // (canExercise / "Iskoristi opciju" dugme + runExerciseOption) je uklonjen jer
  // se nikad nije renderovao u proizvodnji.

  // FE4 (7.1) — expand/collapse istorije dividendi za STOCK poziciju.
  const toggleDividendHistory = (item: PortfolioItem) => {
    const id = item.id;
    if (expandedDividends === id) {
      setExpandedDividends(null);
      return;
    }
    setExpandedDividends(id);

    // Lazy fetch — samo prvi put po poziciji; rezultat ostaje keširan.
    if (dividendStatus[id]) return;
    setDividendStatus((prev) => ({ ...prev, [id]: 'loading' }));
    void dividendService
      .getDividendsByPosition(id)
      .then((rows) => {
        setDividendCache((prev) => ({ ...prev, [id]: Array.isArray(rows) ? rows : [] }));
        setDividendStatus((prev) => ({ ...prev, [id]: 'ready' }));
      })
      .catch((err: unknown) => {
        const httpStatus = (err as { response?: { status?: number } })?.response?.status;
        const next: DividendLoadStatus =
          httpStatus === 404 || httpStatus === 501 || httpStatus === 405
            ? 'unavailable'
            : 'error';
        setDividendStatus((prev) => ({ ...prev, [id]: next }));
      });
  };

  const totalValue = summary?.totalValue ?? 0;
  const totalProfit = summary?.totalProfit ?? 0;
  const paidTaxThisYear = summary?.paidTaxThisYear ?? 0;
  const unpaidTaxThisMonth = summary?.unpaidTaxThisMonth ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Moj portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Pregled hartija od vrednosti u vasem vlasnistvu
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${activeTab === 'holdings' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('holdings')}
        >
          Moje hartije
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${activeTab === 'funds' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('funds')}
        >
          Moji fondovi
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${activeTab === 'tax' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('tax')}
          data-testid="portfolio-tab-tax"
        >
          Porez breakdown
        </button>
      </div>

      {activeTab === 'holdings' ? (
        loading ? (
          <>
            <SummarySkeleton />
            <TableSkeleton />
          </>
        ) : (
          <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ukupna vrednost portfolija
                </CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Wallet className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold">{formatAmount(totalValue)}</div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ukupan profit
                </CardTitle>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    totalProfit >= 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}
                >
                  {totalProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div
                  className={`text-3xl font-bold ${
                    totalProfit >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatAmount(totalProfit)}
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Plaćen porez ove godine
                </CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Receipt className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold">{formatAmount(paidTaxThisYear)}</div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Neplaćen porez za tekući mesec
                </CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Receipt className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {formatAmount(unpaidTaxThisMonth)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Distribution Pie Chart */}
          {items.length > 0 && (
            <ChartErrorBoundary>
              <PortfolioDistributionChart items={items} />
            </ChartErrorBoundary>
          )}

          {/* Profit Bar Chart */}
          {items.length > 0 && (
            <ChartErrorBoundary>
              <PortfolioProfitChart items={items} />
            </ChartErrorBoundary>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                Hartije u vlasnistvu
              </CardTitle>
              {items.some((it) => it.listingType === 'STOCK') && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 <strong>Javni režim:</strong> u koloni "Akcije" za STOCK hartije postoji input
                  &nbsp;+&nbsp; dugme "Učini javnim". Postavite broj akcija koje hocete da budu vidljive
                  na <strong>OTC portalu drugim korisnicima</strong> (oni mogu da vam posalju ponudu za njih).
                  Vase javne akcije ne pojavljuju se u <em>vasem</em> OTC discovery-ju (samo vidite tude),
                  vec gledate stanje pregovora u "Moje OTC ponude i ugovori".
                </p>
              )}
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Briefcase className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Nemate hartije u portfoliju</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kupljene hartije će se prikazati ovde.
                  </p>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader sticky>
                    <TableRow>
                      <TableHead>Tip</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Količina</TableHead>
                      <TableHead>Prosečna cena</TableHead>
                      <TableHead>Trenutna cena</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Profit%</TableHead>
                      <TableHead>ITM</TableHead>
                      <TableHead>Datum isteka</TableHead>
                      <TableHead>Poslednja izmena</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isProfitPositive = item.profit >= 0;
                      const isStock = item.listingType === 'STOCK';
                      const isDividendsOpen = expandedDividends === item.id;

                      return (
                        <Fragment key={item.id}>
                        <TableRow>
                          <TableCell>
                            <Badge variant={getListingTypeBadgeVariant(item.listingType)}>
                              {getListingTypeLabel(item.listingType)}
                            </Badge>
                          </TableCell>

                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {isStock && (
                                <button
                                  type="button"
                                  onClick={() => toggleDividendHistory(item)}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="Istorija dividendi"
                                  aria-expanded={isDividendsOpen}
                                  data-testid={`dividend-toggle-${item.id}`}
                                >
                                  {isDividendsOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              <div>
                                <div>{item.listingTicker}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.listingName}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="font-mono">{formatAmount(item.quantity, 0)}</TableCell>
                          <TableCell className="font-mono">{formatAmount(item.averageBuyPrice)}</TableCell>
                          <TableCell className="font-mono">{formatAmount(item.currentPrice)}</TableCell>

                          <TableCell
                            className={`font-mono font-semibold ${
                              isProfitPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {isProfitPositive ? '+' : ''}{formatAmount(item.profit)}
                          </TableCell>

                          <TableCell
                            className={`font-mono font-semibold ${
                              isProfitPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {isProfitPositive ? '+' : ''}{formatPercent(item.profitPercent)}
                          </TableCell>

                          <TableCell>
                            {item.inTheMoney != null ? (
                              <Badge variant={item.inTheMoney ? 'success' : 'destructive'}>
                                {item.inTheMoney ? 'Da' : 'Ne'}
                              </Badge>
                            ) : '-'}
                          </TableCell>

                          <TableCell>
                            {item.settlementDate
                              ? new Date(item.settlementDate).toLocaleDateString('sr-RS')
                              : '-'}
                          </TableCell>

                          <TableCell>{formatDateTime(item.lastModified)}</TableCell>

                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSell(item)}
                              >
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Prodaj
                              </Button>

                              {isStock && (() => {
                                const currentInput = Number(publicQuantities[item.id] ?? '0');
                                const persistedValue = Number(item.publicQuantity ?? 0);
                                const isUnchanged = currentInput === persistedValue;
                                const isOverMax = currentInput > (Number(item.quantity) || 0);
                                const tooltip = isOverMax
                                  ? `Maksimalno ${item.quantity} (vasa ukupna kolicina)`
                                  : isUnchanged
                                    ? `Vec sacuvano: ${persistedValue} javnih akcija. Promeni broj pa klikni dugme.`
                                    : `Sacuvaj ${currentInput} javnih akcija — bice vidljivo drugim korisnicima na OTC discovery-ju.`;
                                return (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min="0"
                                        max={Number(item.quantity) || 0}
                                        value={publicQuantities[item.id] ?? '0'}
                                        onChange={(e) => handlePublicQuantityChange(item.id, e)}
                                        className="w-24"
                                        title={tooltip}
                                        data-testid={`public-quantity-input-${item.id}`}
                                      />
                                      <Button
                                        size="sm"
                                        variant={isUnchanged ? 'outline' : 'secondary'}
                                        disabled={savingPublicId === item.id || isOverMax || isUnchanged}
                                        onClick={() => handleSavePublicQuantity(item)}
                                        title={tooltip}
                                        data-testid={`public-quantity-save-${item.id}`}
                                      >
                                        {savingPublicId === item.id ? 'Čuvanje...' : 'Učini javnim'}
                                      </Button>
                                    </div>
                                    {persistedValue > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Trenutno javno: {persistedValue}/{item.quantity}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isStock && isDividendsOpen && (
                          <TableRow>
                            <TableCell colSpan={11} className="bg-muted/20">
                              <DividendHistoryPanel
                                status={dividendStatus[item.id]}
                                rows={dividendCache[item.id]}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )
      ) : activeTab === 'funds' ? (
        <MyFundsTab />
      ) : (
        /*
          P2.4 — Per-listing porez breakdown za trenutnog korisnika.
          BE endpoint: GET /tax/my/breakdown (vraca List<TaxBreakdownItemDto>
          sortirano po taxOwed DESC). Spec Celina 3 §516-518.
        */
        <Card data-testid="portfolio-tax-breakdown-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-500" />
              Porez breakdown po hartiji
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taxBreakdownLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : taxBreakdownError === 'unavailable' ? (
              <Alert>
                <AlertDescription>
                  Per-listing porez breakdown trenutno nije dostupan (BE endpoint nije implementiran).
                </AlertDescription>
              </Alert>
            ) : taxBreakdownError === 'error' ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Greska pri ucitavanju porez breakdown-a. Pokusajte ponovo kasnije.
                </AlertDescription>
              </Alert>
            ) : !taxBreakdown || taxBreakdown.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Receipt className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Nemate poreske obaveze po hartijama</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Realizovane SELL transakcije ce se prikazati ovde sa profit/porez breakdownom.
                </p>
              </div>
            ) : (
              <Table data-testid="portfolio-tax-breakdown-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Valuta</TableHead>
                    <TableHead className="text-right">Profit (native)</TableHead>
                    <TableHead className="text-right">Profit (RSD)</TableHead>
                    <TableHead className="text-right">Porez (RSD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxBreakdown.map((item) => {
                    const profitRsd = parseNumber(item.profitRsd);
                    const isProfitRsdPositive = profitRsd >= 0;
                    return (
                      <TableRow key={item.listingId}>
                        <TableCell className="font-medium">{item.ticker}</TableCell>
                        <TableCell className="text-muted-foreground">{item.listingCurrency}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatAmount(parseNumber(item.profitNative))} {item.listingCurrency}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono tabular-nums font-semibold ${
                            isProfitRsdPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatAmount(profitRsd)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                          {formatAmount(parseNumber(item.taxOwed))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}