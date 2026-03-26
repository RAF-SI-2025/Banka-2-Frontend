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

const accountTypeBadgeVariant: Record<string, 'info' | 'success' | 'warning'> = {
  TEKUCI: 'info',
  DEVIZNI: 'success',
  POSLOVNI: 'warning',
  CHECKING: 'info',
  FOREIGN: 'success',
  BUSINESS: 'warning',
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
      return 'TEKUCI';
    case 'FOREIGN':
    case 'DEVIZNI':
      return 'DEVIZNI';
    case 'BUSINESS':
    case 'POSLOVNI':
      return 'POSLOVNI';
    default:
      return 'TEKUCI';
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
      toast.success('Zahtev za otvaranje računa je uspešno podnet! Čeka odobrenje zaposlenog.');
      setShowNewAccount(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Podnošenje zahteva nije uspelo.');
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
      const safeData = (Array.isArray(data) ? data : []).map((a) => ({
        ...a,
        currency: a.currency || (a as unknown as Record<string, unknown>).currencyCode || 'RSD',
        availableBalance: Number(a.availableBalance) || 0,
        balance: Number(a.balance) || 0,
        accountType: normalizeAccountType(a.accountType),
        accountNumber: a.accountNumber || '',
        name: a.name || undefined,
        status: a.status || 'ACTIVE',
      })) as Account[];
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

  // --- Account table data ---
  const filteredAccounts = accounts
    .filter((a) => !typeFilter || a.accountType === typeFilter)
    .sort((a, b) => b.availableBalance - a.availableBalance);

  const totalElements = filteredAccounts.length;
  const totalPages = Math.ceil(totalElements / rowsPerPage);
  const from = page * rowsPerPage + 1;
  const to = Math.min((page + 1) * rowsPerPage, totalElements);
  const paginatedAccounts = filteredAccounts.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  // --- Transaction pagination info ---
  const txFrom = txTotalElements > 0 ? txPage * txRowsPerPage + 1 : 0;
  const txTo = Math.min((txPage + 1) * txRowsPerPage, txTotalElements);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Računi</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Pregled svih računa i transakcija.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && !showNewAccount && (
            <Button
              onClick={() => setShowNewAccount(true)}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novi račun
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Otvaranje novog računa</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowNewAccount(false)}>Otkaži</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tip računa</Label>
                <Select value={newAccType} onValueChange={setNewAccType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">Tekući</SelectItem>
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
                <Label>Početni depozit</Label>
                <Input type="number" value={newAccDeposit} onChange={(e) => setNewAccDeposit(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="createCardCheck" checked={newAccCard} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAccCard(e.target.checked)} title="Kreiraj karticu" />
              <Label htmlFor="createCardCheck">Kreiraj karticu uz račun</Label>
            </div>
            <Button
              onClick={handleCreateAccount}
              disabled={creatingAcc}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
            >
              {creatingAcc ? 'Kreiranje...' : 'Otvori račun'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account filters */}
      {showFilters && (
        <Card className="p-4">
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
                <SelectItem value="TEKUCI">Tekuci</SelectItem>
                <SelectItem value="DEVIZNI">Devizni</SelectItem>
                <SelectItem value="POSLOVNI">Poslovni</SelectItem>
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

      {/* Accounts table */}
      {loading ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj racuna</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Raspolozivo stanje</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="font-medium">Nema pronađenih računa</p>
                      <p className="text-sm text-muted-foreground">Pokušajte sa drugim filterima.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    data-selected={selectedAccountId === account.id || undefined}
                    className={`cursor-pointer ${
                      selectedAccountId === account.id
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedAccountId(account.id)}
                    onDoubleClick={() => {
                      if (account.accountType === 'POSLOVNI') {
                        navigate(`/accounts/${account.id}/business`);
                      } else {
                        navigate(`/accounts/${account.id}`);
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      {formatAccountNumber(account.accountNumber)}
                    </TableCell>
                    <TableCell>{account.name || `${accountTypeLabels[account.accountType]} racun`}</TableCell>
                    <TableCell>
                      <Badge variant={accountTypeBadgeVariant[account.accountType]}>
                        {accountTypeLabels[account.accountType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatBalance(account.availableBalance, account.currency)}
                    </TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell>
                      <Badge variant={account.status === 'ACTIVE' ? 'success' : account.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                        {account.status === 'ACTIVE' ? 'Aktivan' : account.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (account.accountType === 'POSLOVNI' || account.accountType === 'BUSINESS') {
                            navigate(`/accounts/${account.id}/business`);
                          } else {
                            navigate(`/accounts/${account.id}`);
                          }
                        }}
                      >
                        Detalji
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Account pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
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
                  ? `${from}–${to} od ${totalElements}`
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
        </Card>
      )}

      {/* Transaction panel */}
      {selectedAccount && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Transakcije — {selectedAccount.name || `${accountTypeLabels[selectedAccount.accountType]} racun`}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({formatAccountNumber(selectedAccount.accountNumber)})
                </span>
              </CardTitle>
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
              <Card className="p-4">
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
                        <TableRow key={tx.id}>
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
                            {isOutgoing ? tx.recipientName : (tx.recipientName || '—')}
                            <span className="block text-xs text-muted-foreground">
                              {isOutgoing
                                ? formatAccountNumber((tx as unknown as Record<string, string>).toAccount || tx.toAccountNumber)
                                : formatAccountNumber((tx as unknown as Record<string, string>).fromAccount || tx.fromAccountNumber)}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={tx.paymentPurpose}>
                            {tx.paymentPurpose}
                          </TableCell>
                          <TableCell className={`text-right font-medium whitespace-nowrap ${isOutgoing ? 'text-destructive' : 'text-green-600'}`}>
                            {isOutgoing ? '−' : '+'}{formatBalance(tx.amount, tx.currency)}
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
                        ? `${txFrom}–${txTo} od ${txTotalElements}`
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
