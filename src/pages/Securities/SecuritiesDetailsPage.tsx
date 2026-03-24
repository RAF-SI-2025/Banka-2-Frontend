import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import type { Listing, ListingDailyPrice } from '@/types/celina3';
import listingService from '@/services/listingService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const PERIODS = [
  { key: 'DAY', label: '1D' },
  { key: 'WEEK', label: '1N' },
  { key: 'MONTH', label: '1M' },
  { key: 'YEAR', label: '1G' },
  { key: 'FIVE_YEARS', label: '5G' },
  { key: 'ALL', label: 'Sve' },
] as const;

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '-';
  return price.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SecuritiesDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [history, setHistory] = useState<ListingDailyPrice[]>([]);
  const [period, setPeriod] = useState('MONTH');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      listingService.getById(Number(id)),
      listingService.getHistory(Number(id), period),
    ])
      .then(([l, h]) => { setListing(l); setHistory(h); })
      .catch(() => { setListing(null); setHistory([]); })
      .finally(() => setLoading(false));
  }, [id, period]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-[300px] animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto p-6 text-center py-20">
        <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Hartija nije pronadjena</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/securities')}>
          Nazad na listu
        </Button>
      </div>
    );
  }

  const change = listing.priceChange ?? 0;
  const changePct = listing.changePercent ?? 0;
  const isPositive = change >= 0;
  const chartColor = isPositive ? '#10b981' : '#ef4444';

  const dataFields: { label: string; value: string }[] = [
    { label: 'Cena', value: formatPrice(listing.price) },
    { label: 'Ask', value: formatPrice(listing.ask) },
    { label: 'Bid', value: formatPrice(listing.bid) },
    { label: 'Volume', value: listing.volume?.toLocaleString('sr-RS') ?? '-' },
    { label: 'Initial Margin', value: formatPrice(listing.initialMarginCost) },
    { label: 'Maintenance Margin', value: formatPrice(listing.maintenanceMargin) },
  ];

  if (listing.listingType === 'STOCK') {
    if (listing.marketCap != null) dataFields.push({ label: 'Market Cap', value: `${(listing.marketCap / 1e9).toFixed(2)}B` });
    if (listing.outstandingShares != null) dataFields.push({ label: 'Shares Outstanding', value: listing.outstandingShares.toLocaleString('sr-RS') });
    if (listing.dividendYield != null) dataFields.push({ label: 'Dividend Yield', value: `${listing.dividendYield.toFixed(2)}%` });
  } else if (listing.listingType === 'FOREX') {
    if (listing.baseCurrency) dataFields.push({ label: 'Base', value: listing.baseCurrency });
    if (listing.quoteCurrency) dataFields.push({ label: 'Quote', value: listing.quoteCurrency });
    if (listing.liquidity) dataFields.push({ label: 'Likvidnost', value: listing.liquidity });
  } else if (listing.listingType === 'FUTURES') {
    if (listing.contractSize != null) dataFields.push({ label: 'Contract Size', value: listing.contractSize.toString() });
    if (listing.contractUnit) dataFields.push({ label: 'Contract Unit', value: listing.contractUnit });
    if (listing.settlementDate) dataFields.push({ label: 'Settlement', value: new Date(listing.settlementDate).toLocaleDateString('sr-RS') });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb + Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate('/securities')} className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Hartije
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{listing.ticker}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{listing.ticker}</h1>
            <Badge variant="secondary">{listing.listingType}</Badge>
            <Badge variant="secondary">{listing.exchangeAcronym}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">{listing.name}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold font-mono">{formatPrice(listing.price)}</p>
          <p className={`text-sm font-mono flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isPositive ? '+' : ''}{formatPrice(change)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* Buy button */}
      <Button
        className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
        onClick={() => navigate(`/orders/new?listingId=${listing.id}&direction=BUY`)}
      >
        <ShoppingCart className="h-4 w-4 mr-2" />
        Kupi {listing.ticker}
      </Button>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              Kretanje cene
            </CardTitle>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    period === p.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nema istorijskih podataka za izabrani period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(d: string) => {
                    const date = new Date(d);
                    return period === 'DAY'
                      ? date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })
                      : date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => formatPrice(v)}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatPrice(Number(value)), 'Cena']}
                  labelFormatter={(label: unknown) => new Date(String(label)).toLocaleDateString('sr-RS')}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#colorPrice)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Data grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            Podaci o hartiji
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {dataFields.map((field) => (
              <div key={field.label} className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="text-sm font-semibold font-mono mt-1">{field.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
