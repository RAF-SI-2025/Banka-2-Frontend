import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import orderService from '@/services/orderService';
import {
  ListingType,
  OrderDirection,
  OrderStatus,
  OrderType,
  type Order,
} from '@/types/celina3';

const LISTING_TYPE_LABELS: Record<string, string> = {
  [ListingType.STOCK]: 'Akcija',
  [ListingType.FUTURES]: 'Futures',
  [ListingType.FOREX]: 'Forex',
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.MARKET]: 'Market',
  [OrderType.LIMIT]: 'Limit',
  [OrderType.STOP]: 'Stop',
  [OrderType.STOP_LIMIT]: 'Stop-Limit',
};

const DIRECTION_LABELS: Record<OrderDirection, string> = {
  [OrderDirection.BUY]: 'Kupovina',
  [OrderDirection.SELL]: 'Prodaja',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Na cekanju',
  [OrderStatus.APPROVED]: 'Odobren',
  [OrderStatus.DECLINED]: 'Odbijen',
  [OrderStatus.DONE]: 'Zavrsen',
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);

  return new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(num) ? num : 0);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('sr-RS');
}

function getTimestamp(value: string | null | undefined): number {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getStatusBadgeVariant(status: OrderStatus) {
  if (status === OrderStatus.PENDING) return 'warning' as const;
  if (status === OrderStatus.APPROVED) return 'success' as const;
  if (status === OrderStatus.DECLINED) return 'destructive' as const;
  return 'secondary' as const;
}

function getListingTypeLabel(listingType: string | null | undefined): string {
  return LISTING_TYPE_LABELS[String(listingType ?? '')] ?? String(listingType ?? '-');
}

function getDirectionIcon(direction: OrderDirection) {
  return direction === OrderDirection.BUY ? TrendingUp : TrendingDown;
}

function getCommission(orderType: OrderType, approximatePrice: number): number {
  if (approximatePrice <= 0) return 0;

  const usesLimitPricing =
    orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
  const rate = usesLimitPricing ? 0.24 : 0.14;
  const cap = usesLimitPricing ? 12 : 7;

  return Math.min(approximatePrice * rate, cap);
}

function getAccountLabel(order: Order): string {
  const candidate = order as Order & {
    accountNumber?: string;
    accountName?: string;
    accountId?: number | string;
  };

  if (candidate.accountNumber && candidate.accountName) {
    return `${candidate.accountName} | ${candidate.accountNumber}`;
  }

  if (candidate.accountNumber) return candidate.accountNumber;
  if (candidate.accountName) return candidate.accountName;
  if (candidate.accountId != null) return `ID ${candidate.accountId}`;

  return '-';
}

function getListingLabel(order: Order) {
  return `${order.listingTicker} · ${order.listingName}`;
}

function InfoRow({
  label,
  value,
  containerClassName = '',
  valueClassName = '',
}: {
  label: string;
  value: ReactNode;
  containerClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={`grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start ${containerClassName}`.trim()}
    >
      <span className="text-muted-foreground">{label}</span>
      <div
        className={`min-w-0 break-words font-medium sm:justify-self-end sm:text-right ${valueClassName}`.trim()}
      >
        {value}
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const loadOrders = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await orderService.getMy(page, limit);
      const nextOrders = asArray<Order>(response.content);

      setOrders(nextOrders);
      setTotalPages(Math.max(1, response.totalPages ?? 1));
      setLoadError('');
    } catch {
      setOrders([]);
      setTotalPages(1);
      setLoadError('Neuspesno ucitavanje naloga.');
      toast.error('Neuspesno ucitavanje naloga.');
    } finally {
      if (showLoader) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    void loadOrders(true);
  }, [page, limit]);

  useEffect(() => {
    setSelectedOrder((current) =>
      current && orders.some((order) => order.id === current.id)
        ? orders.find((order) => order.id === current.id) ?? null
        : current && orders.length === 0
          ? null
          : current
    );
  }, [orders]);

  const sortedOrders = useMemo(() => {
    const copied = [...orders];

    copied.sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt));

    return copied;
  }, [orders]);

  const statusCounts = useMemo(() => {
    return sortedOrders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc[order.status] += 1;
        return acc;
      },
      {
        total: 0,
        [OrderStatus.PENDING]: 0,
        [OrderStatus.APPROVED]: 0,
        [OrderStatus.DECLINED]: 0,
        [OrderStatus.DONE]: 0,
      }
    );
  }, [sortedOrders]);

  const selectedOrderCommission = selectedOrder
    ? getCommission(selectedOrder.orderType, Number(selectedOrder.approximatePrice ?? 0))
    : 0;

  const selectedOrderTotal =
    Number(selectedOrder?.approximatePrice ?? 0) + selectedOrderCommission;

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Moji nalozi</h1>
                <p className="text-sm text-muted-foreground">
                  Pregled svih vasih BUY i SELL naloga sa detaljima izvrsenja
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
              Sortiranje: datum opadajuce
            </div>
            <Button
              variant="outline"
              onClick={() => void loadOrders(false)}
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Osvezavanje...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Osvezi
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ukupno na strani</CardDescription>
              <CardTitle className="text-2xl">{statusCounts.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Na cekanju</CardDescription>
              <CardTitle className="text-2xl">{statusCounts.PENDING}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Odobreni</CardDescription>
              <CardTitle className="text-2xl">{statusCounts.APPROVED}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Zavrseni</CardDescription>
              <CardTitle className="text-2xl">{statusCounts.DONE}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Greska pri ucitavanju</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                Pregled naloga
              </CardTitle>
              <CardDescription>
                Lista je automatski sortirana po najnovijem datumu.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <label className="text-sm text-muted-foreground" htmlFor="ordersPageSize">
                Broj po strani
              </label>
              <select
                id="ordersPageSize"
                title="Broj po strani"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(0);
                }}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[1.8fr_1fr_0.8fr_0.9fr_0.9fr_1fr_1.1fr_0.8fr] gap-4">
                    {Array.from({ length: 8 }).map((__, innerIndex) => (
                      <div
                        key={innerIndex}
                        className="h-4 rounded bg-muted animate-pulse"
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : sortedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Nema kreiranih naloga</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Kada posaljete prvi nalog, ovde cete videti istoriju i status izvrsenja.
                </p>
              </div>
            ) : (
              <>
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 text-left font-medium text-muted-foreground">Hartija</th>
                      <th className="py-3 text-left font-medium text-muted-foreground">Tip</th>
                      <th className="py-3 text-left font-medium text-muted-foreground">Kolicina</th>
                      <th className="py-3 text-left font-medium text-muted-foreground">Cena</th>
                      <th className="py-3 text-left font-medium text-muted-foreground">Smer</th>
                      <th className="py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="py-3 text-left font-medium text-muted-foreground">Datum</th>
                      <th className="py-3 text-right font-medium text-muted-foreground">Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((order) => {
                      const DirectionIcon = getDirectionIcon(order.direction);

                      return (
                        <tr
                          key={order.id}
                          className="border-b transition-colors hover:bg-muted/40"
                        >
                          <td className="py-3">
                            <div className="font-medium">{getListingLabel(order)}</div>
                            <div className="text-xs text-muted-foreground">
                              {getListingTypeLabel(order.listingType)}
                            </div>
                          </td>
                          <td className="py-3">{ORDER_TYPE_LABELS[order.orderType]}</td>
                          <td className="py-3">{formatAmount(order.quantity, 0)}</td>
                          <td className="py-3">{formatAmount(order.pricePerUnit)}</td>
                          <td className="py-3">
                            <div className="inline-flex items-center gap-2">
                              <DirectionIcon
                                className={`h-4 w-4 ${
                                  order.direction === OrderDirection.BUY
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                                }`}
                              />
                              <span>{DIRECTION_LABELS[order.direction]}</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge variant={getStatusBadgeVariant(order.status)}>
                              {STATUS_LABELS[order.status]}
                            </Badge>
                          </td>
                          <td className="py-3">{formatDateTime(order.createdAt)}</td>
                          <td className="py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Detalji
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Prikazana strana {page + 1} od {totalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0}
                    >
                      Prethodna
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages - 1, current + 1))
                      }
                      disabled={page >= totalPages - 1}
                    >
                      Sledeca
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog.Root
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-h-[85vh] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div className="min-w-0 pr-4">
                <Dialog.Title className="break-words text-xl font-semibold">
                  Detalji naloga
                </Dialog.Title>
                <Dialog.Description className="mt-1 break-words text-sm text-muted-foreground">
                  Kompletan pregled izabranog naloga i stanja izvrsenja.
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Zatvori"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {selectedOrder && (
              <div className="space-y-4 p-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg break-words">
                        {getListingLabel(selectedOrder)}
                      </CardTitle>
                      <CardDescription className="break-words">
                        ID naloga #{selectedOrder.id}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <InfoRow
                        label="Tip ordera"
                        value={ORDER_TYPE_LABELS[selectedOrder.orderType]}
                      />
                      <InfoRow
                        label="Tip hartije"
                        value={getListingTypeLabel(selectedOrder.listingType)}
                      />
                      <InfoRow label="Smer" value={DIRECTION_LABELS[selectedOrder.direction]} />
                      <InfoRow
                        label="Status"
                        value={
                          <Badge variant={getStatusBadgeVariant(selectedOrder.status)}>
                            {STATUS_LABELS[selectedOrder.status]}
                          </Badge>
                        }
                      />
                      <InfoRow
                        label="Datum kreiranja"
                        value={formatDateTime(selectedOrder.createdAt)}
                      />
                      <InfoRow
                        label="Poslednja izmena"
                        value={formatDateTime(selectedOrder.lastModification)}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Izvrsenje</CardTitle>
                      <CardDescription>Napredak i dodatne opcije naloga.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <InfoRow
                        label="Kolicina"
                        value={formatAmount(selectedOrder.quantity, 0)}
                      />
                      <InfoRow
                        label="Preostalo"
                        value={formatAmount(selectedOrder.remainingPortions, 0)}
                      />
                      <InfoRow
                        label="All or None"
                        value={selectedOrder.allOrNone ? 'Da' : 'Ne'}
                      />
                      <InfoRow label="Margin" value={selectedOrder.margin ? 'Da' : 'Ne'} />
                      <InfoRow
                        label="After hours"
                        value={selectedOrder.afterHours ? 'Da' : 'Ne'}
                      />
                      <InfoRow label="Odobrio" value={selectedOrder.approvedBy || '-'} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Finansijski pregled</CardTitle>
                    <CardDescription>
                      Prikaz procene, provizije i povezane informacije o nalogu.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
                    <InfoRow
                      label="Cena po jedinici"
                      value={formatAmount(selectedOrder.pricePerUnit)}
                      containerClassName="rounded-md border p-3"
                    />
                    <InfoRow
                      label="Contract size"
                      value={formatAmount(selectedOrder.contractSize, 0)}
                      containerClassName="rounded-md border p-3"
                    />
                    <InfoRow
                      label="Priblizna cena"
                      value={formatAmount(selectedOrder.approximatePrice)}
                      containerClassName="rounded-md border p-3"
                    />
                    <InfoRow
                      label="Provizija"
                      value={formatAmount(selectedOrderCommission)}
                      containerClassName="rounded-md border p-3"
                    />
                    <InfoRow
                      label="Ukupno"
                      value={formatAmount(selectedOrderTotal)}
                      containerClassName="rounded-md border p-3"
                    />
                    <InfoRow
                      label="Racun"
                      value={getAccountLabel(selectedOrder)}
                      containerClassName="rounded-md border p-3"
                    />

                    {(selectedOrder.limitValue != null || selectedOrder.stopValue != null) && (
                      <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                        <InfoRow
                          label="Limit vrednost"
                          value={
                            selectedOrder.limitValue != null
                              ? formatAmount(selectedOrder.limitValue)
                              : '-'
                          }
                          containerClassName="rounded-md border p-3"
                        />
                        <InfoRow
                          label="Stop vrednost"
                          value={
                            selectedOrder.stopValue != null
                              ? formatAmount(selectedOrder.stopValue)
                              : '-'
                          }
                          containerClassName="rounded-md border p-3"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <p>
                      Provizija je prikazana informativno prema pravilima za tip naloga.
                      Podatak o racunu se prikazuje samo ako je prisutan u odgovoru servisa.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
