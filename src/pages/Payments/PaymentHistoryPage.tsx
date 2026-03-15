import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import type { Account, Transaction, TransactionStatus } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Inbox } from 'lucide-react';

type SortField = 'date' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusBadgeVariant(status: TransactionStatus) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'PENDING') return 'warning' as const;
  if (status === 'REJECTED') return 'destructive' as const;
  return 'secondary' as const;
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
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

function compareStrings(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'sr');
}

export default function PaymentHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedAccount = searchParams.get('account') || '';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [accountFilter, setAccountFilter] = useState(preselectedAccount);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setAccountFilter(preselectedAccount);
  }, [preselectedAccount]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await accountService.getMyAccounts();
        setAccounts(asArray<Account>(data));
      } catch {
        toast.error('Neuspesno ucitavanje racuna.');
        setAccounts([]);
      }
    };

    loadAccounts();
  }, []);

  useEffect(() => {
    const loadTransactions = async () => {
      setLoading(true);

      try {
        if (amountMin && amountMax && Number(amountMin) > Number(amountMax)) {
          toast.error('Minimalni iznos ne moze biti veci od maksimalnog.');
          setTransactions([]);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
          toast.error('Datum "od" ne moze biti posle datuma "do".');
          setTransactions([]);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        const response = await transactionService.getAll({
          accountNumber: accountFilter || undefined,
          status: (statusFilter || undefined) as TransactionStatus | undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          amountMin: amountMin ? Number(amountMin) : undefined,
          amountMax: amountMax ? Number(amountMax) : undefined,
          page,
          limit,
        });

        setTransactions(asArray<Transaction>(response.content));
        setTotalPages(Math.max(1, response.totalPages ?? 1));
      } catch {
        toast.error('Neuspesno ucitavanje placanja.');
        setTransactions([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [accountFilter, statusFilter, dateFrom, dateTo, amountMin, amountMax, page, limit]);

  useEffect(() => {
    setPage(0);
  }, [accountFilter, statusFilter, dateFrom, dateTo, amountMin, amountMax, limit]);

  useEffect(() => {
    setExpandedId(null);
  }, [transactions, page, limit, sortField, sortDirection]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (accountFilter) {
      next.set('account', accountFilter);
    } else {
      next.delete('account');
    }

    setSearchParams(next, { replace: true });
  }, [accountFilter, searchParams, setSearchParams]);

  const sortedTransactions = useMemo(() => {
    const copied = [...transactions];

    copied.sort((a, b) => {
      let result = 0;

      if (sortField === 'date') {
        result = getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
      } else if (sortField === 'amount') {
        result = Number(a.amount ?? 0) - Number(b.amount ?? 0);
      } else if (sortField === 'status') {
        result = compareStrings(a.status, b.status);
      }

      return sortDirection === 'asc' ? result : -result;
    });

    return copied;
  }, [transactions, sortField, sortDirection]);

  const resetFilters = () => {
    setAccountFilter(preselectedAccount);
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSortField('date');
    setSortDirection('desc');
    setPage(0);
    setLimit(10);
  };

  const toggleExpand = (transactionId: number) => {
    setExpandedId((prev) => (prev === transactionId ? null : transactionId));
  };

  const printTransaction = (tx: Transaction) => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text(`Potvrda transakcije #${tx.id}`, 14, 20);

      doc.setFontSize(12);
      doc.text(`Datum: ${formatDateTime(tx.createdAt)}`, 14, 35);
      doc.text(`Sa racuna: ${tx.fromAccountNumber}`, 14, 45);
      doc.text(`Na racun: ${tx.toAccountNumber}`, 14, 55);
      doc.text(`Iznos: ${formatAmount(tx.amount)} ${tx.currency}`, 14, 65);
      doc.text(`Status: ${tx.status}`, 14, 75);
      doc.text(`Svrha: ${tx.paymentPurpose || '-'}`, 14, 85);
      doc.text(`Opis: ${tx.description || '-'}`, 14, 95);
      doc.text(`Primalac: ${tx.recipientName || '-'}`, 14, 105);
      doc.text(`Sifra placanja: ${tx.paymentCode || '-'}`, 14, 115);
      doc.text(`Referentni broj: ${tx.referenceNumber || '-'}`, 14, 125);
      doc.text(`Model: ${tx.model || '-'}`, 14, 135);
      doc.text(`Poziv na broj: ${tx.callNumber || '-'}`, 14, 145);

      doc.save(`potvrda-transakcije-${tx.id}.pdf`);
    } catch {
      toast.error('Neuspesno generisanje PDF potvrde.');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Pregled placanja</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Pregledajte istoriju svih vasih placanja i transakcija.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filteri i sortiranje</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="accountFilter">
              Racun
            </label>
            <select
              id="accountFilter"
              title="Racun"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Svi</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountNumber}>
                  {account.accountNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="statusFilter">
              Status
            </label>
            <select
              id="statusFilter"
              title="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Svi</option>
              <option value="PENDING">PENDING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="pageSize">
              Broj po strani
            </label>
            <select
              id="pageSize"
              title="Broj po strani"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dateFrom">
              Datum od
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dateTo">
              Datum do
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="amountMin">
              Iznos min
            </label>
            <input
              id="amountMin"
              type="number"
              min="0"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="amountMax">
              Iznos max
            </label>
            <input
              id="amountMax"
              type="number"
              min="0"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sortField">
              Sortiraj po
            </label>
            <select
              id="sortField"
              title="Sortiraj po"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="date">Datum</option>
              <option value="amount">Iznos</option>
              <option value="status">Status</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sortDirection">
              Smer sortiranja
            </label>
            <select
              id="sortDirection"
              title="Smer sortiranja"
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value as SortDirection)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="desc">Opadajuce</option>
              <option value="asc">Rastuce</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={resetFilters}>
              Resetuj filtere
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-8 w-24 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : sortedTransactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nema transakcija</h3>
              <p className="mt-1 text-sm text-muted-foreground">Nema transakcija za izabrane filtere.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Datum</th>
                  <th className="text-left py-2">Sa racuna</th>
                  <th className="text-left py-2">Na racun</th>
                  <th className="text-left py-2">Iznos</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Svrha</th>
                  <th className="text-left py-2">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td colSpan={7} className="p-0">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b hover:bg-muted/50 transition-colors">
                            <td className="py-2">{formatDateTime(tx.createdAt)}</td>
                            <td className="py-2">{tx.fromAccountNumber}</td>
                            <td className="py-2">{tx.toAccountNumber}</td>
                            <td className="py-2">
                              {formatAmount(tx.amount)} {tx.currency}
                            </td>
                            <td className="py-2">
                              <Badge variant={statusBadgeVariant(tx.status)}>
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="py-2">{tx.paymentPurpose}</td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleExpand(tx.id)}
                                >
                                  {expandedId === tx.id ? 'Sakrij' : 'Detalji'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => printTransaction(tx)}
                                >
                                  Stampaj potvrdu
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {expandedId === tx.id && (
                            <tr className="border-b bg-muted/30">
                              <td className="py-3 px-2" colSpan={7}>
                                <div className="grid gap-2 md:grid-cols-2 text-sm">
                                  <p>
                                    Opis: <span className="font-medium">{tx.description || '-'}</span>
                                  </p>
                                  <p>
                                    Primalac: <span className="font-medium">{tx.recipientName || '-'}</span>
                                  </p>
                                  <p>
                                    Sifra placanja: <span className="font-medium">{tx.paymentCode || '-'}</span>
                                  </p>
                                  <p>
                                    Referentni broj:{' '}
                                    <span className="font-medium">{tx.referenceNumber || '-'}</span>
                                  </p>
                                  <p>
                                    Model: <span className="font-medium">{tx.model || '-'}</span>
                                  </p>
                                  <p>
                                    Poziv na broj:{' '}
                                    <span className="font-medium">{tx.callNumber || '-'}</span>
                                  </p>
                                  <p>
                                    Status: <span className="font-medium">{tx.status}</span>
                                  </p>
                                  <p>
                                    Datum: <span className="font-medium">{formatDateTime(tx.createdAt)}</span>
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prethodna
              </Button>
              <span className="text-sm text-muted-foreground">
                Strana {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Sledeca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
