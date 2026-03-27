// FE2-08b: Istorija transfera sa sortiranjem i filterima

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import type { Account, Transfer } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Repeat, Inbox } from 'lucide-react';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusBadgeVariant(status: string) {
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

export default function TransferHistoryPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const [accountNumber, setAccountNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const resetFilters = () => {
    setAccountNumber('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

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
    const loadTransfers = async () => {
      setLoading(true);
      try {
        const transfers = await transactionService.getTransfers({
          accountNumber: accountNumber || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        setTransfers(asArray<Transfer>(transfers));
        setTotalPages(1);
      } catch {
        toast.error('Neuspesno ucitavanje istorije transfera.');
        setTransfers([]);
      } finally {
        setLoading(false);
      }
    };

    loadTransfers();
  }, [accountNumber, dateFrom, dateTo, page]);

  useEffect(() => {
    setPage(0);
  }, [accountNumber, dateFrom, dateTo]);

  const sortedTransfers = useMemo(() => {
    return [...asArray<Transfer>(transfers)].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [transfers]);

  const computedTotalPages = Math.max(1, Math.ceil(sortedTransfers.length / limit));

  useEffect(() => {
    setTotalPages(computedTotalPages);
  }, [computedTotalPages]);

  const paginatedTransfers = useMemo(() => {
    const start = page * limit;
    return sortedTransfers.slice(start, start + limit);
  }, [sortedTransfers, page]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <Repeat className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Istorija transfera</h1>
          <p className="text-sm text-muted-foreground">Pregledajte sve prenose izmedju vasih racuna.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Filteri</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="account-filter" className="text-sm font-medium">
              Racun
            </label>
            <select
              id="account-filter"
              title="Racun"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Svi racuni</option>
              {asArray<Account>(accounts).map((account) => (
                <option key={account.id} value={account.accountNumber}>
                  {account.accountNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="date-from" className="text-sm font-medium">
              Datum od
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="date-to" className="text-sm font-medium">
              Datum do
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
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
                <div className="h-4 w-10 rounded bg-muted animate-pulse" />
                <div className="h-8 w-40 rounded bg-muted animate-pulse" />
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : sortedTransfers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nema transfera</h3>
              <p className="mt-1 text-sm text-muted-foreground">Nema transfera za izabrane filtere.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">R.br.</th>
                  <th className="text-left py-2">Sa / Na racun</th>
                  <th className="text-left py-2">Iznos</th>
                  <th className="text-left py-2">Kurs</th>
                  <th className="text-left py-2">Provizija</th>
                  <th className="text-left py-2">Datum</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransfers.map((transfer, index) => (
                  <tr key={transfer.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-2">{page * limit + index + 1}</td>
                    <td className="py-2">
                      <div className="flex flex-col">
                        <span>{transfer.fromAccountNumber}</span>
                        <span className="text-muted-foreground">{'\u2192'} {transfer.toAccountNumber}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      {formatAmount(transfer.amount)} {transfer.fromCurrency}
                      {transfer.toCurrency !== transfer.fromCurrency && transfer.convertedAmount != null && (
                        <div className="text-xs text-muted-foreground">
                          {'\u2192'} {formatAmount(transfer.convertedAmount)} {transfer.toCurrency}
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      {transfer.exchangeRate == null ? '-' : formatAmount(transfer.exchangeRate, 4)}
                    </td>
                    <td className="py-2">
                      {transfer.commission == null ? '-' : formatAmount(transfer.commission)}
                    </td>
                    <td className="py-2">{formatDateTime(transfer.createdAt)}</td>
                    <td className="py-2">
                      <Badge variant={statusBadgeVariant(transfer.status)}>
                        {transfer.status}
                      </Badge>
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
