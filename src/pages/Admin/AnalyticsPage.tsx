// ============================================================
// W3-T3 — Analytics page (Spark daily aggregates dashboard)
//
// Admin/supervizor pregled rezultata dnevnih Spark batch poslova.
// Dohvata /admin/analytics/daily endpoint sa filterima po datumu
// i imenu metrike.
//
// Spec: 2026-05-26-k8s-readiness-deploy-plan.md, Task W3-T3.
// Ruta: '/admin/analytics' (App.tsx, ProtectedRoute adminOnly).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/notify';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  getAnalyticsDaily,
  type AnalyticsDailyDTO,
} from '@/services/analyticsService';
import { addDaysISO } from '@/utils/formatters';

const METRIC_NAMES = [
  { value: '', label: 'Sve metrike' },
  { value: 'top_movers', label: 'Top movers' },
  { value: 'order_count', label: 'Broj naloga' },
  { value: 'total_notional', label: 'Ukupan notional' },
  { value: 'unique_users', label: 'Aktivnih korisnika' },
  { value: 'avg_order_size', label: 'Prosecna velicina naloga' },
] as const;

// [P1-i18n-1 / 1887] lokalni date-builder umesto UTC `toISOString().slice` —
// pre ponoci po UTC bi "yesterday" promasilo za jos jedan dan u Beogradu.
function yesterdayIso(): string {
  return addDaysISO(-1);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1_000_000) {
    return value.toLocaleString('sr-RS', { maximumFractionDigits: 2 });
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString('sr-RS');
  }
  return value.toLocaleString('sr-RS', { maximumFractionDigits: 4 });
}

function formatDimensions(dims: Record<string, unknown>): string {
  if (!dims || Object.keys(dims).length === 0) return '—';
  try {
    return Object.entries(dims)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' · ');
  } catch {
    return JSON.stringify(dims);
  }
}

export default function AnalyticsPage() {
  const [date, setDate] = useState<string>(yesterdayIso());
  const [metricName, setMetricName] = useState<string>('');
  const [data, setData] = useState<AnalyticsDailyDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAnalyticsDaily(date, metricName || undefined);
      setData(result);
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = err?.response?.status;
      let message: string;
      if (status === 403) {
        message = 'Nemate pristup analitici (samo admin/supervizor).';
      } else if (status === 404) {
        message = 'Analytics endpoint nije pronadjen.';
      } else {
        message =
          err?.response?.data?.message ??
          err?.message ??
          'Ucitavanje analitike nije uspelo.';
      }
      setError(message);
      setData(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [date, metricName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const grouped = useMemo(() => {
    if (!data) return new Map<string, AnalyticsDailyDTO[]>();
    const map = new Map<string, AnalyticsDailyDTO[]>();
    for (const row of data) {
      if (!map.has(row.metricName)) map.set(row.metricName, []);
      map.get(row.metricName)!.push(row);
    }
    return map;
  }, [data]);

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Analitike"
        description="Dnevni Spark agregati (top movers, broj naloga, notional, ...)"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            data-testid="analytics-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Osvezi
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Label htmlFor="analytics-date">Datum</Label>
            <Input
              id="analytics-date"
              data-testid="analytics-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="analytics-metric-filter">Metrika</Label>
            <select
              id="analytics-metric-filter"
              data-testid="analytics-metric-filter"
              aria-label="Metrika"
              title="Metrika"
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-10 text-sm"
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
            >
              {METRIC_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Greska</AlertTitle>
          <AlertDescription data-testid="analytics-error">{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-4">
          <div className="space-y-3" data-testid="analytics-loading">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-20 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </Card>
      ) : data && data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((row, idx) => (
              <Card
                key={`${row.metricName}-${idx}`}
                className="overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`analytics-metric-card-${idx}`}
              >
                <CardHeader className="pb-2 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 border-b">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-mono">{row.metricName}</CardTitle>
                    <Badge variant="info" className="text-[10px]">
                      {row.metricDate}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  <div
                    className="text-3xl font-bold font-mono tabular-nums"
                    data-testid={`analytics-metric-value-${idx}`}
                  >
                    {formatNumber(row.value)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDimensions(row.dimensions)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Group summary */}
          <Card className="p-4">
            <CardTitle className="text-sm mb-3">Pregled po metrici</CardTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from(grouped.entries()).map(([name, rows]) => (
                <div
                  key={name}
                  className="rounded-lg border bg-muted/30 p-3"
                  data-testid={`analytics-group-${name}`}
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {name}
                  </p>
                  <p className="text-lg font-bold font-mono">{rows.length}</p>
                  <p className="text-[10px] text-muted-foreground">zapisa</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card
          className="p-12 text-center text-muted-foreground"
          data-testid="analytics-empty"
        >
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nema podataka za ovaj datum.</p>
          <p className="text-sm mt-1">
            Pokusaj sa drugim datumom ili sacekaj sledeci Spark batch.
          </p>
        </Card>
      )}
    </div>
  );
}
