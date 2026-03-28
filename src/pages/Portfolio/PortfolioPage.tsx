import { useEffect, useState, useMemo, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  ArrowRightLeft,
  LineChart,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

import portfolioService from '@/services/portfolioService';
import { toast } from '@/lib/notify';
import type { PortfolioItem, PortfolioSummary } from '@/types/celina3';

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

function formatAmount(value: number | null | undefined, fractionDigits = 2): string {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  return num.toLocaleString('sr-RS', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatPercent(value: number | null | undefined): string {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  return `${num.toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  useEffect(() => {
    const loadPortfolio = async () => {
      setLoading(true);
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

    loadPortfolio();
  }, []);

  const handleSell = (item: PortfolioItem) => {
    navigate(`/orders/new?listingId=${item.id}&direction=SELL`);
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

    setSavingPublicId(item.id);

    try {
      const updated = await portfolioService.setPublicQuantity(item.id, parsed);

      setItems((prev) =>
        prev.map((portfolioItem) =>
          portfolioItem.id === item.id ? updated : portfolioItem
        )
      );

      setPublicQuantities((prev) => ({
        ...prev,
        [item.id]: String(updated.publicQuantity ?? parsed),
      }));

      toast.success('Javna količina je uspešno sačuvana.');
    } catch {
      toast.error('Čuvanje javne količine nije uspelo.');
    } finally {
      setSavingPublicId(null);
    }
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

      {loading ? (
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
          {items.length > 0 && <PortfolioDistributionChart items={items} />}

          {/* Profit Placeholder */}
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <LineChart className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Profit grafikon dolazi uskoro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Vizuelni prikaz profita po periodima bice dostupan u narednoj verziji.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                Hartije u vlasnistvu
              </CardTitle>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tip</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Količina</TableHead>
                      <TableHead>Prosečna cena</TableHead>
                      <TableHead>Trenutna cena</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Profit%</TableHead>
                      <TableHead>Poslednja izmena</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isProfitPositive = item.profit >= 0;
                      const isStock = item.listingType === 'STOCK';

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant={getListingTypeBadgeVariant(item.listingType)}>
                              {getListingTypeLabel(item.listingType)}
                            </Badge>
                          </TableCell>

                          <TableCell className="font-medium">
                            <div>{item.listingTicker}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.listingName}
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

                              {isStock && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={publicQuantities[item.id] ?? '0'}
                                    onChange={(e) => handlePublicQuantityChange(item.id, e)}
                                    className="w-24"
                                    title="Javne akcije su vidljive na OTC portalu za trgovinu"
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={savingPublicId === item.id}
                                    onClick={() => handleSavePublicQuantity(item)}
                                    title="Javne akcije su vidljive na OTC portalu za trgovinu"
                                  >
                                    {savingPublicId === item.id ? 'Čuvanje...' : 'Učini javnim'}
                                  </Button>
                                </div>
                              )}

                              {/*
                                TODO-5:
                                "Iskoristi opciju" dugme nije implementirano jer:
                                - backend endpoint još ne postoji
                                - PortfolioItem model nema podatke potrebne za proveru
                                  in-the-money i settlementDate uslova
                              */}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}