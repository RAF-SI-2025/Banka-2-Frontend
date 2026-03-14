// FE2-02a: Lista svih racuna korisnika
// FE2-02b: Prikaz transakcija za selektovani racun

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
} from 'lucide-react';
import type { Account, AccountType, Transaction, TransactionStatus, TransactionFilters } from '@/types/celina2';
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
import { Label } from '@/components/ui/label';

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci',
  DEVIZNI: 'Devizni',
  POSLOVNI: 'Poslovni',
};

const accountTypeBadgeVariant: Record<string, 'info' | 'success' | 'warning'> = {
  TEKUCI: 'info',
  DEVIZNI: 'success',
  POSLOVNI: 'warning',
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

function formatBalance(amount: number, currency: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length !== 18) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AccountListPage() {
  const navigate = useNavigate();

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
      const safeData = Array.isArray(data) ? data : [];
      setAccounts(safeData);
      // Auto-select first account by highest balance (matches display sort order)
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
      setTransactions(Array.isArray(response.content) ? response.content : []);
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
        <h1 className="text-3xl font-bold tracking-tight">Racuni</h1>
        <div className="flex items-center gap-2">
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
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nema pronadjenih racuna
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
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                                ? formatAccountNumber(tx.toAccountNumber)
                                : formatAccountNumber(tx.fromAccountNumber)}
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
