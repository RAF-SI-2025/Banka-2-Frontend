import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import type { Account, Transaction, TransactionStatus } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Inbox, ArrowUpRight, ArrowDownLeft, TrendingDown, TrendingUp, Receipt, ChevronDown, ChevronUp, Download, X, Search } from 'lucide-react';
import { asArray, formatAmount, formatDateTime, formatDateShort } from '@/utils/formatters';
import { normalizeTransaction } from '@/utils/transactionUtils';

type SortField = 'date' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

function statusBadgeVariant(status: TransactionStatus) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning' as const;
  if (status === 'REJECTED' || status === 'ABORTED') return 'destructive' as const;
  return 'secondary' as const;
}

function statusLabel(status: TransactionStatus): string {
  if (status === 'COMPLETED') return 'Zavrseno';
  if (status === 'PENDING') return 'Na cekanju';
  // R1-333: PROCESSING/ABORTED su BE statusi koje FE ranije nije mapirao.
  if (status === 'PROCESSING') return 'U obradi';
  if (status === 'REJECTED') return 'Odbijeno';
  if (status === 'CANCELLED') return 'Otkazano';
  if (status === 'ABORTED') return 'Prekinuto';
  return status;
}

function getTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compareStrings(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'sr');
}

const STATUS_OPTIONS = [
  { value: '', label: 'Sve' },
  { value: 'COMPLETED', label: 'Zavrsene' },
  { value: 'PROCESSING', label: 'U obradi' },
  { value: 'PENDING', label: 'Na cekanju' },
  { value: 'REJECTED', label: 'Odbijene' },
  { value: 'CANCELLED', label: 'Otkazane' },
  { value: 'ABORTED', label: 'Prekinute' },
] as const;

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
  const [showFilters, setShowFilters] = useState(false);

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

        const normalized = asArray<Transaction>(response.content).map((tx) =>
          normalizeTransaction(tx),
        );

        setTransactions(normalized);
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

  // Summary stats
  const stats = useMemo(() => {
    const txs = asArray<Transaction>(transactions);
    let outgoing = 0;
    let incoming = 0;
    const count = txs.length;

    txs.forEach(tx => {
      const amt = Number(tx.amount ?? 0);
      // Heuristic: if from account matches one of the user's accounts, it's outgoing
      const isOutgoing = accounts.some(a => a.accountNumber === tx.fromAccountNumber);
      if (isOutgoing) {
        outgoing += amt;
      } else {
        incoming += amt;
      }
    });

    return { outgoing, incoming, count };
  }, [transactions, accounts]);

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

  const printTransaction = async (tx: Transaction) => {
    try {
      const blob = await transactionService.getPaymentReceipt(tx.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `potvrda-${tx.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Neuspesno preuzimanje PDF potvrde.');
    }
  };

  const isOutgoing = (tx: Transaction) => accounts.some(a => a.accountNumber === tx.fromAccountNumber);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <History className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pregled placanja</h1>
          <p className="text-sm text-muted-foreground">Pregledajte istoriju svih vasih placanja i transakcija.</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Odlivi</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400">
                  -{formatAmount(stats.outgoing)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prilivi</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatAmount(stats.incoming)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/30">
                <Receipt className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ukupno transakcija</p>
                <p className="text-2xl font-bold font-mono tabular-nums">
                  {stats.count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status pills + filter toggle */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                statusFilter === opt.value
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-all"
          >
            <Search className="h-4 w-4" />
            Filteri
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Resetuj
          </Button>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="accountFilter">Racun</label>
                <select
                  id="accountFilter"
                  title="Racun"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Svi racuni</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>{account.accountNumber}</option>
                  ))}
                </select>
              </div>

              {/* T2-011 fix: date input ignorise placeholder, koristi se eksplicitan label za Od/Do. */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Period</span>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground/80" htmlFor="dateFrom">Od</label>
                    <input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      aria-label="Datum od"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground/80" htmlFor="dateTo">Do</label>
                    <input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      aria-label="Datum do"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="amountMin">Iznos</label>
                <div className="flex gap-2">
                  <input
                    id="amountMin"
                    type="number"
                    min="0"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Min"
                  />
                  <input
                    id="amountMax"
                    type="number"
                    min="0"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="sortField">Sortiraj</label>
                <div className="flex gap-2">
                  <select
                    id="sortField"
                    title="Sortiraj po"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="date">Datum</option>
                    <option value="amount">Iznos</option>
                    <option value="status">Status</option>
                  </select>
                  <button
                    onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-input bg-background hover:bg-muted transition-colors"
                    title={sortDirection === 'asc' ? 'Rastuce' : 'Opadajuce'}
                  >
                    {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <select
                id="pageSize"
                title="Broj po strani"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="flex h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm"
              >
                <option value={10}>10 po strani</option>
                <option value={25}>25 po strani</option>
                <option value={50}>50 po strani</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-28 rounded bg-muted animate-pulse ml-auto" />
                    <div className="h-5 w-20 rounded-full bg-muted animate-pulse ml-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedTransactions.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                <Inbox className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nema transakcija</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">Nema transakcija za izabrane filtere. Pokusajte da promenite kriterijume pretrage.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTransactions.map((tx) => {
            const outgoing = isOutgoing(tx);
            const expanded = expandedId === tx.id;

            return (
              <Card key={tx.id} className={`rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md ${expanded ? 'ring-1 ring-indigo-500/20' : ''}`}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="w-full text-left px-6 py-5 flex items-center gap-4"
                    onClick={() => toggleExpand(tx.id)}
                  >
                    {/* Direction icon */}
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                      outgoing
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-emerald-100 dark:bg-emerald-900/30'
                    }`}>
                      {outgoing
                        ? <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
                        : <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      }
                    </div>

                    {/* Center info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{tx.recipientName || tx.toAccountNumber || '-'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{formatDateShort(tx.createdAt)}</span>
                        {tx.paymentPurpose && (
                          <>
                            <span className="text-muted-foreground">-</span>
                            <span className="text-xs text-muted-foreground truncate">{tx.paymentPurpose}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: amount + status */}
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold font-mono tabular-nums ${
                        outgoing
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {outgoing ? '-' : '+'}{formatAmount(tx.amount)} {tx.currency}
                      </p>
                      <Badge variant={statusBadgeVariant(tx.status)} className="mt-1">
                        {statusLabel(tx.status)}
                      </Badge>
                    </div>

                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="px-6 pb-5 pt-0 border-t">
                      <div className="pt-4 grid gap-4 md:grid-cols-2 text-sm">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sa racuna</p>
                            <p className="font-mono text-sm mt-0.5">{tx.fromAccountNumber || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Na racun</p>
                            <p className="font-mono text-sm mt-0.5">{tx.toAccountNumber || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Primalac</p>
                            <p className="font-medium mt-0.5">{tx.recipientName || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Datum</p>
                            <p className="mt-0.5">{formatDateTime(tx.createdAt)}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Opis</p>
                            <p className="mt-0.5">{tx.description || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sifra placanja</p>
                            <p className="font-mono mt-0.5">{tx.paymentCode || '-'}</p>
                          </div>
                          <div className="flex gap-6">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Model</p>
                              <p className="font-mono mt-0.5">{tx.model || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Poziv na broj</p>
                              <p className="font-mono mt-0.5">{tx.callNumber || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ref. broj</p>
                              <p className="font-mono mt-0.5">{tx.referenceNumber || '-'}</p>
                            </div>
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); printTransaction(tx); }}
                              className="rounded-lg"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Preuzmi potvrdu
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-xl"
            >
              Prethodna
            </Button>
            <span className="text-sm text-muted-foreground font-mono tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-xl"
            >
              Sledeca
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
