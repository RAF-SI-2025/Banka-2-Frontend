import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Inbox } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import orderService from '@/services/orderService';
import type { Order } from '@/types/celina3';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

type OrderStatusValue = 'PENDING' | 'APPROVED' | 'DECLINED' | 'DONE';
type StatusFilter = OrderStatusValue | 'ALL';

function statusLabel(status: string): string {
  if (status === 'PENDING') return 'Na čekanju';
  if (status === 'APPROVED') return 'Odobren';
  if (status === 'DECLINED') return 'Odbijen';
  if (status === 'DONE') return 'Završen';
  return status;
}

function directionLabel(direction: string): string {
  return direction === 'BUY' ? 'Kupovina' : 'Prodaja';
}

function orderTypeLabel(type: string): string {
  if (type === 'MARKET') return 'Market';
  if (type === 'LIMIT') return 'Limit';
  if (type === 'STOP') return 'Stop';
  if (type === 'STOP_LIMIT') return 'Stop-Limit';
  return type;
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString('sr-RS')} ${date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}`;
}

// TODO: Backend treba da pruži settlementDate na Order entitetu
// Za sada uvek vraća false — kad backend doda polje, ovde treba proveriti
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isSettlementDatePassed(_order: Order): boolean {
  return false;
}

export default function OrdersListPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; type: 'approve' | 'decline' } | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 20;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await orderService.getAll(
        statusFilter === 'ALL' ? 'ALL' : statusFilter,
        page,
        pageSize
      );
      setOrders(asArray<Order>(response.content));
      setTotalPages(response.totalPages ?? 0);
    } catch {
      toast.error('Neuspešno učitavanje naloga.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
    setExpandedId(null);
    setConfirmAction(null);
  }, [statusFilter, page, loadOrders]);

  const counts = useMemo(() => {
    const safeOrders = asArray<Order>(orders);
    const all = safeOrders.length;
    const pending = safeOrders.filter((o) => o.status === 'PENDING').length;
    const approved = safeOrders.filter((o) => o.status === 'APPROVED').length;
    const declined = safeOrders.filter((o) => o.status === 'DECLINED').length;
    const done = safeOrders.filter((o) => o.status === 'DONE' || o.isDone).length;
    return { all, pending, approved, declined, done };
  }, [orders]);

  const handleApprove = async (orderId: number) => {
    setProcessingId(orderId);
    try {
      await orderService.approve(orderId);
      toast.success('Nalog je odobren.');
      setConfirmAction(null);
      await loadOrders();
    } catch {
      toast.error('Odobravanje naloga nije uspelo.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (orderId: number) => {
    setProcessingId(orderId);
    try {
      await orderService.decline(orderId);
      toast.success('Nalog je odbijen.');
      setConfirmAction(null);
      await loadOrders();
    } catch {
      toast.error('Odbijanje naloga nije uspelo.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'approve') {
      handleApprove(confirmAction.id);
    } else {
      handleDecline(confirmAction.id);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Pregled naloga</h1>
          <p className="text-sm text-muted-foreground">
            Pregledajte i obradite naloge za trgovinu hartijama od vrednosti
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Filter po statusu</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('ALL')}
          >
            Svi ({counts.all})
          </Button>
          <Button
            variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('PENDING')}
          >
            Na čekanju ({counts.pending})
          </Button>
          <Button
            variant={statusFilter === 'APPROVED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('APPROVED')}
          >
            Odobreni ({counts.approved})
          </Button>
          <Button
            variant={statusFilter === 'DECLINED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('DECLINED')}
          >
            Odbijeni ({counts.declined})
          </Button>
          <Button
            variant={statusFilter === 'DONE' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('DONE')}
          >
            Završeni ({counts.done})
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {confirmAction.type === 'approve'
                  ? 'Da li ste sigurni da želite da odobrite ovaj nalog?'
                  : 'Da li ste sigurni da želite da odbijete ovaj nalog?'}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={confirmAction.type === 'approve' ? 'default' : 'destructive'}
                  onClick={handleConfirmAction}
                  disabled={processingId === confirmAction.id}
                  className={
                    confirmAction.type === 'approve'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all'
                      : ''
                  }
                >
                  {processingId === confirmAction.id ? 'Obrada...' : 'Potvrdi'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmAction(null)}
                  disabled={processingId === confirmAction.id}
                >
                  Otkaži
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table / Loading / Empty */}
      {loading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Nema naloga za izabrani filter</p>
              <p className="text-sm text-muted-foreground mt-1">Pokušajte sa drugim statusom filtera.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Agent</th>
                  <th className="text-left py-2">Tip</th>
                  <th className="text-left py-2">Hartija</th>
                  <th className="text-left py-2">Količina</th>
                  <th className="text-left py-2">CS</th>
                  <th className="text-left py-2">Cena</th>
                  <th className="text-left py-2">Smer</th>
                  <th className="text-left py-2">Preostalo</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isPending = order.status === 'PENDING';
                  const isExpanded = expandedId === order.id;
                  const expired = isSettlementDatePassed(order);

                  return (
                    <React.Fragment key={order.id}>
                      <tr className="border-b align-top hover:bg-muted/50 transition-colors">
                        <td className="py-2">{order.userName || '-'}</td>
                        <td className="py-2">{orderTypeLabel(order.orderType)}</td>
                        <td className="py-2">
                          <div>
                            <span className="font-medium">{order.listingTicker}</span>
                            <span className="text-xs text-muted-foreground ml-1">({order.listingType})</span>
                          </div>
                        </td>
                        <td className="py-2 font-mono">{order.quantity}</td>
                        <td className="py-2 font-mono">{order.contractSize}</td>
                        <td className="py-2 font-mono">{formatAmount(order.pricePerUnit)}</td>
                        <td className="py-2">
                          <Badge variant={order.direction === 'BUY' ? 'success' : 'destructive'}>
                            {directionLabel(order.direction)}
                          </Badge>
                        </td>
                        <td className="py-2 font-mono">{order.remainingPortions}</td>
                        <td className="py-2">
                          <Badge variant={
                            order.status === 'PENDING' ? 'warning' :
                            order.status === 'APPROVED' ? 'info' :
                            order.status === 'DECLINED' ? 'destructive' :
                            'secondary'
                          }>
                            {statusLabel(order.status)}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : order.id)}
                            >
                              {isExpanded ? 'Sakrij' : 'Detalji'}
                            </Button>
                            {isPending && !expired && (
                              <Button
                                size="sm"
                                onClick={() => setConfirmAction({ id: order.id, type: 'approve' })}
                                disabled={processingId === order.id}
                                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all"
                              >
                                Odobri
                              </Button>
                            )}
                            {isPending && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setConfirmAction({ id: order.id, type: 'decline' })}
                                disabled={processingId === order.id}
                              >
                                Odbij
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-muted/30">
                          <td className="py-3 px-2" colSpan={10}>
                            <div className="grid gap-2 md:grid-cols-3 text-sm">
                              <p>Hartija: <span className="font-medium">{order.listingName} ({order.listingTicker})</span></p>
                              <p>Tip hartije: <span className="font-medium">{order.listingType}</span></p>
                              <p>Tip naloga: <span className="font-medium">{orderTypeLabel(order.orderType)}</span></p>
                              <p>Količina: <span className="font-medium">{order.quantity}</span></p>
                              <p>Contract Size: <span className="font-medium">{order.contractSize}</span></p>
                              <p>Cena po jedinici: <span className="font-medium">{formatAmount(order.pricePerUnit)}</span></p>
                              {order.limitValue != null && (
                                <p>Limit vrednost: <span className="font-medium">{formatAmount(order.limitValue)}</span></p>
                              )}
                              {order.stopValue != null && (
                                <p>Stop vrednost: <span className="font-medium">{formatAmount(order.stopValue)}</span></p>
                              )}
                              <p>Smer: <span className="font-medium">{directionLabel(order.direction)}</span></p>
                              <p>Približna cena: <span className="font-medium">{formatAmount(order.approximatePrice)}</span></p>
                              <p>Preostalo: <span className="font-medium">{order.remainingPortions}</span></p>
                              <p>Završen: <span className="font-medium">{order.isDone ? 'Da' : 'Ne'}</span></p>
                              <p>All or None: <span className="font-medium">{order.allOrNone ? 'Da' : 'Ne'}</span></p>
                              <p>Margin: <span className="font-medium">{order.margin ? 'Da' : 'Ne'}</span></p>
                              <p>After Hours: <span className="font-medium">{order.afterHours ? 'Da' : 'Ne'}</span></p>
                              <p>Odobrio: <span className="font-medium">{order.approvedBy || '-'}</span></p>
                              <p>Kreiran: <span className="font-medium">{formatDateTime(order.createdAt)}</span></p>
                              <p>Poslednja izmena: <span className="font-medium">{formatDateTime(order.lastModification)}</span></p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Stranica {page + 1} od {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prethodna
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sledeća
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
