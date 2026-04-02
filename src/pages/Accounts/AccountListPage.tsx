// FE2-02a: Lista svih racuna korisnika
// FE2-02b: Prikaz transakcija za selektovani racun

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Wallet,
  Plus,
  CreditCard,
} from 'lucide-react';
import type { Account, AccountType, Transaction, TransactionStatus, TransactionFilters } from '@/types/celina2';
import { useAuth } from '@/context/AuthContext';
import type { PaginatedResponse } from '@/types';
import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci',
  DEVIZNI: 'Devizni',
  POSLOVNI: 'Poslovni',
  CHECKING: 'Tekuci',
  FOREIGN: 'Devizni',
  BUSINESS: 'Poslovni',
};

const currencyGradients: Record<string, string> = {
  RSD: 'from-blue-500 to-blue-700',
  EUR: 'from-indigo-500 to-violet-700',
  USD: 'from-emerald-500 to-green-700',
  CHF: 'from-red-500 to-rose-700',
  GBP: 'from-purple-500 to-violet-700',
  JPY: 'from-orange-500 to-amber-700',
  CAD: 'from-rose-500 to-pink-700',
  AUD: 'from-teal-500 to-cyan-700',
};

const currencySymbols: Record<string, string> = {
  RSD: 'RSD', EUR: '\u20ac', USD: '$', CHF: 'CHF', GBP: '\u00a3', JPY: '\u00a5', CAD: 'C$', AUD: 'A$',
};

const transactionStatusLabels: Record<string, string> = {
  PENDING: 'Na cekanju',
  COMPLETED: 'Zavrsena',
  REJECTED: 'Odbijena',
  CANCELLED: 'Otkazana',
};

const transactionStatusVariant: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

function formatBalance(amount: number | null | undefined, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `${n.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`;
}

function formatAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '-';
  if (accountNumber.length !== 18) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function normalizeAccountType(raw: string | undefined): AccountType {
  switch (raw) {
    case 'CHECKING':
    case 'TEKUCI':
      return 'CHECKING';
    case 'FOREIGN':
    case 'DEVIZNI':
      return 'FOREIGN';
    case 'BUSINESS':
    case 'POSLOVNI':
      return 'BUSINESS';
    default:
      return 'CHECKING';
  }
}

export default function AccountListPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // --- New account form ---
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccType, setNewAccType] = useState('CHECKING');
  const [newAccCurrency, setNewAccCurrency] = useState('RSD');
  const [newAccDeposit, setNewAccDeposit] = useState('0');
  const [newAccCard, setNewAccCard] = useState(false);
  const [creatingAcc, setCreatingAcc] = useState(false);

  const handleCreateAccount = async () => {
    setCreatingAcc(true);
    try {
      await accountService.submitRequest({
        accountType: newAccType,
        currency: newAccCurrency,
        initialDeposit: Number(newAccDeposit) || 0,
        createCard: newAccCard,
      });
      toast.success('Zahtev za otvaranje racuna je uspesno podnet! Ceka odobrenje zaposlenog.');
      setShowNewAccount(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Podnosenje zahteva nije uspelo.');
    } finally {
      setCreatingAcc(false);
    }
  };

  // --- Account state ---
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // --- Transaction state ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txPage, setTxPage] = useState(0);
  const [txRowsPerPage, setTxRowsPerPage] = useState(10);
  const [txTotalElements, setTxTotalElements] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(0);

  // --- Transaction filters ---
  const [txStatusFilter, setTxStatusFilter] = useState<TransactionStatus | undefined>(undefined);
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const [showTxFilters, setShowTxFilters] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  // --- Fetch accounts ---
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accountService.getMyAccounts();
      const safeData = (Array.isArray(data) ? data : []).map((a) => {
        const aAny = a as unknown as Record<string, unknown>;
        return {
        ...a,
        currency: a.currency || (aAny.currencyCode as string) || 'RSD',
        availableBalance: Number(a.availableBalance) || 0,
        balance: Number(a.balance) || 0,
        reservedBalance: Number(a.reservedBalance) || Number(aAny.reservedFunds) || 0,
        accountType: normalizeAccountType(a.accountType),
        accountNumber: a.accountNumber || '',
        name: a.name || undefined,
        status: a.status || 'ACTIVE',
      };
      }) as Account[];
      setAccounts(safeData);
      if (safeData.length > 0 && selectedAccountId === null) {
        const sorted = [...safeData].sort((a, b) => b.availableBalance - a.availableBalance);
        setSelectedAccountId(sorted[0].id);
      }
    } catch {
      setError('Greska pri ucitavanju racuna. Pokusajte ponovo.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch transactions for selected account ---
  const fetchTransactions = useCallback(async () => {
    if (!selectedAccount) return;
    setTxLoading(true);
    setTxError('');
    try {
      const filters: TransactionFilters = {
        accountNumber: selectedAccount.accountNumber,
        page: txPage,
        limit: txRowsPerPage,
      };
      if (txStatusFilter) filters.status = txStatusFilter;
      if (txDateFrom) filters.dateFrom = txDateFrom;
      if (txDateTo) filters.dateTo = txDateTo;

      const response: PaginatedResponse<Transaction> = await transactionService.getAll(filters);
      const rawTx = Array.isArray(response.content) ? response.content : [];
      setTransactions(rawTx.map((tx) => {
        const t = tx as unknown as Record<string, unknown>;
        return {
          ...tx,
          fromAccountNumber: tx.fromAccountNumber || (t.fromAccount as string) || '',
          toAccountNumber: tx.toAccountNumber || (t.toAccount as string) || '',
          paymentPurpose: tx.paymentPurpose || (t.description as string) || '',
          currency: tx.currency || (t.currency as string) || 'RSD',
        };
      }));
      setTxTotalElements(response.totalElements ?? 0);
      setTxTotalPages(response.totalPages ?? 0);
    } catch {
      setTxError('Greska pri ucitavanju transakcija.');
      setTransactions([]);
      setTxTotalElements(0);
      setTxTotalPages(0);
    } finally {
      setTxLoading(false);
    }
  }, [selectedAccount, txPage, txRowsPerPage, txStatusFilter, txDateFrom, txDateTo]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset tx page when filters change
  useEffect(() => {
    setTxPage(0);
  }, [txStatusFilter, txDateFrom, txDateTo, selectedAccountId]);

  const resetTxFilters = () => {
    setTxStatusFilter(undefined);
    setTxDateFrom('');
    setTxDateTo('');
    setTxPage(0);
  };

  // --- Account data ---
  const filteredAccounts = accounts
    .filter((a) => !typeFilter || a.accountType === typeFilter)
    .sort((a, b) => b.availableBalance - a.availableBalance);

  const totalElements = filteredAccounts.length;
  const totalPages = Math.ceil(totalElements / rowsPerPage);
  const from = page * rowsPerPage + 1;
  const to = Math.min((page + 1) * rowsPerPage, totalElements);
  const paginatedAccounts = filteredAccounts.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  // Total balance summary
  const totalBalance = accounts.reduce((sum, a) => {
    if (a.currency === 'RSD') return sum + (a.balance ?? 0);
    return sum;
  }, 0);
  const totalFxAccounts = accounts.filter(a => a.currency !== 'RSD').length;

  // --- Transaction pagination info ---
  const txFrom = txTotalElements > 0 ? txPage * txRowsPerPage + 1 : 0;
  const txTo = Math.min((txPage + 1) * txRowsPerPage, txTotalElements);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Racuni</h1>
            <p className="text-sm text-muted-foreground">Pregled svih racuna i transakcija.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && !showNewAccount && (
            <Button
              onClick={() => setShowNewAccount(true)}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novi racun
            </Button>
          )}
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filteri"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* New account form */}
      {showNewAccount && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Otvaranje novog racuna</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowNewAccount(false)}>Otkazi</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tip racuna</Label>
                <Select value={newAccType} onValueChange={setNewAccType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">Tekuci</SelectItem>
                    <SelectItem value="FOREIGN">Devizni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valuta</Label>
                <Select value={newAccCurrency} onValueChange={setNewAccCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pocetni depozit</Label>
                <Input type="number" value={newAccDeposit} onChange={(e) => setNewAccDeposit(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="createCardCheck" checked={newAccCard} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAccCard(e.target.checked)} title="Kreiraj karticu" />
              <Label htmlFor="createCardCheck">Kreiraj karticu uz racun</Label>
            </div>
            <Button
              onClick={handleCreateAccount}
              disabled={creatingAcc}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
            >
              {creatingAcc ? 'Kreiranje...' : 'Otvori racun'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account filters */}
      {showFilters && (
        <Card className="p-4 rounded-2xl">
          <div className="flex flex-wrap gap-3">
            <Select
              value={typeFilter ?? 'ALL'}
              onValueChange={(val) => setTypeFilter(val === 'ALL' ? undefined : val as AccountType)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tip racuna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi tipovi</SelectItem>
                <SelectItem value="CHECKING">Tekuci</SelectItem>
                <SelectItem value="FOREIGN">Devizni</SelectItem>
                <SelectItem value="BUSINESS">Poslovni</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Total Balance Summary Card */}
      {!loading && accounts.length > 0 && (
        <Card className="rounded-2xl overflow-hidden border-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 text-white shadow-xl shadow-indigo-500/20">
          <CardContent className="py-6 px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-indigo-200 font-medium">Ukupno stanje (RSD racuni)</p>
                <p className="text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight mt-1">
                  {totalBalance.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD
                </p>
                {totalFxAccounts > 0 && (
                  <p className="text-sm text-indigo-200 mt-1">+ {totalFxAccounts} devizn{totalFxAccounts === 1 ? 'i' : 'a'} racun{totalFxAccounts === 1 ? '' : 'a'}</p>
                )}
              </div>
              <div className="flex items-center gap-6 text-indigo-100">
                <div className="text-center">
                  <p className="text-3xl font-bold font-mono">{accounts.length}</p>
                  <p className="text-xs text-indigo-200">Ukupno racuna</p>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold font-mono">{accounts.filter(a => a.status === 'ACTIVE').length}</p>
                  <p className="text-xs text-indigo-200">Aktivnih</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Cards Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : paginatedAccounts.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <Wallet className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">Nema pronadjenih racuna</p>
            <p className="text-sm text-muted-foreground mt-1">Pokusajte sa drugim filterima.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {paginatedAccounts.map((account, idx) => {
              const grad = currencyGradients[account.currency] || 'from-slate-500 to-slate-700';
              const sym = currencySymbols[account.currency] || account.currency;
              const isSelected = selectedAccountId === account.id;
              const dailyPct = account.dailyLimit > 0 ? Math.min(100, ((account.dailySpending ?? 0) / account.dailyLimit) * 100) : 0;
              const monthlyPct = account.monthlyLimit > 0 ? Math.min(100, ((account.monthlySpending ?? 0) / account.monthlyLimit) * 100) : 0;

              return (
                <Card
                  key={account.id}
                  className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    isSelected ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10' : 'shadow-sm hover:shadow-lg'
                  }`}
                  style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
                  onClick={() => setSelectedAccountId(account.id)}
                  onDoubleClick={() => {
                    if (account.accountType === 'BUSINESS' || account.accountType === 'POSLOVNI') {
                      navigate(`/accounts/${account.id}/business`);
                    } else {
                      navigate(`/accounts/${account.id}`);
                    }
                  }}
                >
                  <div className="flex">
                    {/* Left gradient strip */}
                    <div className={`w-1.5 bg-gradient-to-b ${grad} flex-shrink-0`} />

                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-base truncate">
                              {account.name || `${accountTypeLabels[account.accountType]} racun`}
                            </h3>
                            <Badge variant={account.status === 'ACTIVE' ? 'success' : account.status === 'BLOCKED' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 flex-shrink-0">
                              {account.status === 'ACTIVE' ? 'Aktivan' : account.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{formatAccountNumber(account.accountNumber)}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-gradient-to-r ${grad} text-white`}>
                          {account.currency}
                        </span>
                      </div>

                      {/* Balance */}
                      <div className="mb-4">
                        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
                          {formatBalance(account.availableBalance, '')}
                          <span className="text-sm font-semibold text-muted-foreground ml-1">{sym}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ukupno: {formatBalance(account.balance, account.currency)}
                        </p>
                      </div>

                      {/* Limit mini bars */}
                      {(account.dailyLimit > 0 || account.monthlyLimit > 0) && (
                        <div className="flex gap-4 mb-3">
                          {account.dailyLimit > 0 && (
                            <div className="flex-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Dnevno</span>
                                <span className="font-mono">{Math.round(dailyPct)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${dailyPct > 80 ? 'bg-red-500' : dailyPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${dailyPct}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {account.monthlyLimit > 0 && (
                            <div className="flex-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Mesecno</span>
                                <span className="font-mono">{Math.round(monthlyPct)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${monthlyPct > 80 ? 'bg-red-500' : monthlyPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${monthlyPct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>{accountTypeLabels[account.accountType]}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 h-auto py-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (account.accountType === 'POSLOVNI' || account.accountType === 'BUSINESS') {
                              navigate(`/accounts/${account.id}/business`);
                            } else {
                              navigate(`/accounts/${account.id}`);
                            }
                          }}
                        >
                          Detalji <ChevronRight className="ml-0.5 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Account pagination */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Redova po stranici:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {totalElements > 0
                  ? `${from}\u2013${to} od ${totalElements}`
                  : '0 rezultata'}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Transaction panel */}
      {selectedAccount && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <CardTitle className="text-lg">
                  Transakcije — {selectedAccount.name || `${accountTypeLabels[selectedAccount.accountType]} racun`}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({formatAccountNumber(selectedAccount.accountNumber)})
                  </span>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showTxFilters ? 'secondary' : 'outline'}
                  size="icon"
                  onClick={() => setShowTxFilters(!showTxFilters)}
                  title="Filteri transakcija"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Transaction filters */}
            {showTxFilters && (
              <Card className="p-4 rounded-xl">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={txStatusFilter ?? 'ALL'}
                      onValueChange={(val) => setTxStatusFilter(val === 'ALL' ? undefined : val as TransactionStatus)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Svi statusi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Svi statusi</SelectItem>
                        <SelectItem value="PENDING">Na cekanju</SelectItem>
                        <SelectItem value="COMPLETED">Zavrsena</SelectItem>
                        <SelectItem value="REJECTED">Odbijena</SelectItem>
                        <SelectItem value="CANCELLED">Otkazana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Datum od</Label>
                    <DateInput
                      value={txDateFrom}
                      onChange={setTxDateFrom}
                      className="w-[140px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Datum do</Label>
                    <DateInput
                      value={txDateTo}
                      onChange={setTxDateTo}
                      className="w-[140px]"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetTxFilters}
                    title="Resetuj filtere"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Resetuj
                  </Button>
                </div>
              </Card>
            )}

            {/* Transaction error */}
            {txError && (
              <Alert variant="destructive">
                <AlertDescription>{txError}</AlertDescription>
              </Alert>
            )}

            {/* Transaction table */}
            {txLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p>Nema transakcija za ovaj racun</p>
                {(txStatusFilter || txDateFrom || txDateTo) && (
                  <Button variant="link" size="sm" onClick={resetTxFilters} className="mt-1">
                    Ukloni filtere
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Primalac / Posiljalac</TableHead>
                      <TableHead>Svrha</TableHead>
                      <TableHead className="text-right">Iznos</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const isOutgoing = tx.fromAccountNumber === selectedAccount.accountNumber;
                      return (
                        <TableRow key={tx.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            {isOutgoing ? (
                              <ArrowUpRight className="h-4 w-4 text-destructive" />
                            ) : (
                              <ArrowDownLeft className="h-4 w-4 text-green-600" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(tx.createdAt)}
                          </TableCell>
                          <TableCell>
                            {tx.recipientName || '\u2014'}
                            <span className="block text-xs text-muted-foreground">
                              {isOutgoing
                                ? formatAccountNumber(tx.toAccountNumber)
                                : formatAccountNumber(tx.fromAccountNumber)}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={tx.paymentPurpose}>
                            {tx.paymentPurpose}
                          </TableCell>
                          <TableCell className={`text-right font-medium font-mono tabular-nums whitespace-nowrap ${isOutgoing ? 'text-destructive' : 'text-green-600'}`}>
                            {isOutgoing ? '\u2212' : '+'}{formatBalance(tx.amount, tx.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={transactionStatusVariant[tx.status]}>
                              {transactionStatusLabels[tx.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Transaction pagination */}
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Redova po stranici:</span>
                    <Select
                      value={String(txRowsPerPage)}
                      onValueChange={(val) => {
                        setTxRowsPerPage(Number(val));
                        setTxPage(0);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {txTotalElements > 0
                        ? `${txFrom}\u2013${txTo} od ${txTotalElements}`
                        : '0 rezultata'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={txPage === 0}
                      onClick={() => setTxPage(txPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={txPage >= txTotalPages - 1}
                      onClick={() => setTxPage(txPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
