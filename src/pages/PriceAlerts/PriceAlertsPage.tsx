import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Pencil, Trash2, Pause, Play } from 'lucide-react';
import { toast } from '@/lib/notify';
import PageHeader from '@/components/shared/PageHeader';
import PriceAlertDialog from '@/components/pricealert/PriceAlertDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import priceAlertService from '@/services/priceAlertService';
import type { PriceAlertDto, PriceAlertFilterTab } from '@/types/priceAlert';
import {
  PRICE_ALERT_CONDITION_LABELS,
  PRICE_ALERT_FILTER_LABELS,
  PRICE_ALERT_STATUS_LABELS,
  PRICE_ALERT_STATUS_VARIANT,
  priceAlertDistancePct,
} from '@/types/priceAlert';
import { formatDate, formatPrice } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const FILTER_TABS: PriceAlertFilterTab[] = ['ALL', 'ACTIVE', 'TRIGGERED', 'DISABLED'];

function distanceClass(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  return Math.abs(pct) < 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground';
}

export default function PriceAlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PriceAlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PriceAlertFilterTab>('ALL');
  const [editAlert, setEditAlert] = useState<PriceAlertDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriceAlertDto | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await priceAlertService.listMy();
      setAlerts(data);
    } catch {
      toast.error('Neuspesno ucitavanje alarma');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? alerts : alerts.filter((a) => a.status === filter)),
    [alerts, filter]
  );

  const handleToggleStatus = async (alert: PriceAlertDto) => {
    const next = alert.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    setBusyId(alert.id);
    try {
      await priceAlertService.update(alert.id, { status: next });
      toast.success(next === 'ACTIVE' ? 'Alarm reaktiviran' : 'Alarm onemogucen');
      await loadAlerts();
    } catch {
      toast.error('Promena statusa nije uspela');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await priceAlertService.remove(deleteTarget.id);
      toast.success('Alarm obrisan');
      setDeleteTarget(null);
      await loadAlerts();
    } catch {
      toast.error('Brisanje alarma nije uspelo');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="price-alerts-page">
      <div className="mb-6">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Moji alarmi"
          description="Pratite cenovne alarme za hartije od vrednosti"
          actions={
            <Button variant="outline" onClick={() => navigate('/securities')}>
              Otvori Berzu
            </Button>
          }
        />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Pregled alarma</CardTitle>
          <div className="flex flex-wrap gap-1">
            {FILTER_TABS.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setFilter(key)}
              >
                {PRICE_ALERT_FILTER_LABELS[key]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" data-testid="price-alerts-loading" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {alerts.length === 0
                  ? 'Nemate cenovnih alarma. Otvorite detalj hartije na Berzi i kliknite „Cenovni alarm“ da kreirate prvi.'
                  : 'Nema alarma za izabrani filter.'}
              </p>
              {alerts.length === 0 && (
                <Button variant="outline" className="mt-4" onClick={() => navigate('/securities')}>
                  Idi na Berzu
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hartija</TableHead>
                  <TableHead>Uslov</TableHead>
                  <TableHead className="text-right">Trenutna</TableHead>
                  <TableHead className="text-right">Udaljenost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kreiran</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((alert) => {
                  const dist = priceAlertDistancePct(alert.currentPrice, alert.threshold);
                  const distStr =
                    dist != null ? `${dist > 0 ? '+' : ''}${dist.toFixed(2)}%` : '—';
                  const canToggle = alert.status !== 'TRIGGERED';

                  return (
                    <TableRow
                      key={alert.id}
                      data-testid={`alert-row-${alert.id}`}
                      className="cursor-pointer"
                      onClick={() => navigate(`/securities/${alert.listingId}`)}
                    >
                      <TableCell>
                        <div className="font-mono font-semibold">{alert.ticker}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {alert.listingName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{PRICE_ALERT_CONDITION_LABELS[alert.condition]}</span>
                        <div className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatPrice(alert.threshold)} {alert.currency}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm">
                        {alert.currentPrice != null ? formatPrice(alert.currentPrice) : '—'}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono tabular-nums text-sm', distanceClass(dist))}>
                        {distStr}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRICE_ALERT_STATUS_VARIANT[alert.status]}>
                          {PRICE_ALERT_STATUS_LABELS[alert.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(alert.createdAt)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`edit-alert-${alert.id}`}
                            onClick={() => setEditAlert(alert)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canToggle && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              data-testid={`toggle-alert-${alert.id}`}
                              disabled={busyId === alert.id}
                              onClick={() => void handleToggleStatus(alert)}
                              title={alert.status === 'DISABLED' ? 'Reaktivuj' : 'Onemoguci'}
                            >
                              {alert.status === 'DISABLED' ? (
                                <Play className="h-3.5 w-3.5" />
                              ) : (
                                <Pause className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            data-testid={`delete-alert-${alert.id}`}
                            onClick={() => setDeleteTarget(alert)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {editAlert && (
        <PriceAlertDialog
          listingId={editAlert.listingId}
          ticker={editAlert.ticker}
          currentPrice={editAlert.currentPrice}
          currency={editAlert.currency}
          existingAlert={editAlert}
          open={editAlert != null}
          onOpenChange={(o) => {
            if (!o) setEditAlert(null);
          }}
          onSuccess={() => void loadAlerts()}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md" role="alertdialog">
            <CardHeader>
              <CardTitle>Obrisati alarm?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Alarm za <strong>{deleteTarget.ticker}</strong> ({PRICE_ALERT_CONDITION_LABELS[deleteTarget.condition]}{' '}
                {formatPrice(deleteTarget.threshold)}) ce biti trajno uklonjen.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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
