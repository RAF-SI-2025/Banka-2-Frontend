// FE2-03a: Detaljan prikaz licnog racuna (tekuci/devizni)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Pencil,
  ArrowLeftRight,
  History,
  Wallet,
  Inbox,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import type { Account, Transaction } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci',
  DEVIZNI: 'Devizni',
  POSLOVNI: 'Poslovni',
  CHECKING: 'Tekuci',
  FOREIGN: 'Devizni',
  BUSINESS: 'Poslovni',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktivan',
  BLOCKED: 'Blokiran',
  INACTIVE: 'Neaktivan',
};

const statusVariant: Record<string, 'success' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  BLOCKED: 'destructive',
  INACTIVE: 'secondary',
};

const txStatusLabels: Record<string, string> = {
  PENDING: 'Na cekanju',
  COMPLETED: 'Zavrsena',
  REJECTED: 'Odbijena',
  CANCELLED: 'Otkazana',
};

const txStatusVariant: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
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

export default function AccountDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [isSavingLimits, setIsSavingLimits] = useState(false);

  useEffect(() => {
    const accountId = Number(id);
    if (!accountId || Number.isNaN(accountId)) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const raw = await accountService.getById(accountId);
        const accountData = {
          ...raw,
          currency: raw.currency || raw.currencyCode || 'RSD',
          availableBalance: Number(raw.availableBalance) || 0,
          balance: Number(raw.balance) || 0,
          reservedBalance: Number(raw.reservedBalance) || Number(raw.reservedFunds) || 0,
          dailyLimit: Number(raw.dailyLimit) || 0,
          monthlyLimit: Number(raw.monthlyLimit) || 0,
          dailySpending: Number(raw.dailySpending) || 0,
          monthlySpending: Number(raw.monthlySpending) || 0,
          maintenanceFee: Number(raw.maintenanceFee) || 0,
        } as Account;
        setAccount(accountData);
        setRenameValue(accountData.name || '');
        setDailyLimit(String(accountData.dailyLimit));
        setMonthlyLimit(String(accountData.monthlyLimit));

        const transactionsResponse = await transactionService.getAll({
          accountNumber: accountData.accountNumber,
          page: 0,
          limit: 10,
        });
        const rawTx = Array.isArray(transactionsResponse.content) ? transactionsResponse.content : [];
        // Mapiranje BE polja -> FE polja (fromAccount -> fromAccountNumber, itd.)
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
      } catch {
        toast.error('Greska pri ucitavanju detalja racuna.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const dailyProgress = useMemo(() => {
    if (!account || account.dailyLimit <= 0) return 0;
    return Math.min(100, (account.dailySpending / account.dailyLimit) * 100);
  }, [account]);

  const monthlyProgress = useMemo(() => {
    if (!account || account.monthlyLimit <= 0) return 0;
    return Math.min(100, (account.monthlySpending / account.monthlyLimit) * 100);
  }, [account]);

  const saveName = async () => {
    if (!account) return;
    const newName = renameValue.trim();
    if (!newName) {
      toast.error('Naziv racuna ne sme biti prazan.');
      return;
    }

    setIsSavingName(true);
    try {
      const updated = await accountService.updateName(account.id, newName);
      setAccount(updated);
      toast.success('Naziv racuna je uspesno promenjen.');
    } catch {
      toast.error('Promena naziva nije uspela.');
    } finally {
      setIsSavingName(false);
    }
  };

  const saveLimits = async () => {
    if (!account) return;
    const parsedDaily = Number(dailyLimit);
    const parsedMonthly = Number(monthlyLimit);
    if (Number.isNaN(parsedDaily) || Number.isNaN(parsedMonthly) || parsedDaily < 0 || parsedMonthly < 0) {
      toast.error('Limiti moraju biti nenegativni brojevi.');
      return;
    }

    setIsSavingLimits(true);
    try {
      await accountService.changeLimit(account.id, {
        dailyLimit: parsedDaily,
        monthlyLimit: parsedMonthly,
      });
      setAccount({ ...account, dailyLimit: parsedDaily, monthlyLimit: parsedMonthly });
      toast.success('Limiti su uspesno sacuvani.');
    } catch {
      toast.error('Promena limita nije uspela.');
    } finally {
      setIsSavingLimits(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 py-6">
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-10 w-64 rounded bg-muted animate-pulse" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-6 w-32 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Nazad na racune
        </Button>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-3">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">Racun nije pronadjen</p>
          <p className="text-sm text-muted-foreground mt-1">Racun koji trazite ne postoji ili je uklonjen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Nazad na racune
      </Button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 p-6 sm:p-8 text-white shadow-lg shadow-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <Wallet className="h-6 w-6" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{account.name || 'Detalji racuna'}</h1>
            <Badge variant={statusVariant[account.status]} className="border-white/20">
              {statusLabels[account.status] || account.status}
            </Badge>
            <Badge variant="info" className="border-white/20">
              {accountTypeLabels[account.accountType] || account.accountType}
            </Badge>
          </div>
          <p className="text-indigo-100 font-mono text-sm mb-4">{formatAccountNumber(account.accountNumber)}</p>
          <div className="text-3xl sm:text-4xl font-bold tracking-tight">
            {formatBalance(account.balance, account.currency)}
          </div>
          <p className="mt-1 text-indigo-100 text-sm">
            Raspolozivo: {formatBalance(account.availableBalance, account.currency)}
          </p>
        </div>
      </div>

      {/* Balance details card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Stanje racuna</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ukupno stanje</p>
              <p className="text-xl font-bold mt-1">{formatBalance(account.balance, account.currency)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Raspolozivo</p>
              <p className="text-xl font-bold mt-1">{formatBalance(account.availableBalance, account.currency)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rezervisano</p>
              <p className="text-lg font-semibold mt-1 text-muted-foreground">{formatBalance(account.reservedBalance, account.currency)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Odrzavanje</p>
              <p className="text-lg font-semibold mt-1 text-muted-foreground">{formatBalance(account.maintenanceFee, account.currency)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limits card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Limiti i potrosnja</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Dnevna potrosnja</span>
              <span className="font-semibold tabular-nums">
                {formatBalance(account.dailySpending, account.currency)} / {formatBalance(account.dailyLimit, account.currency)}
              </span>
            </div>
            <Progress value={dailyProgress} className={`h-2.5 ${dailyProgress > 80 ? '[&>div]:bg-red-500' : dailyProgress > 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} />
            <p className="text-xs text-muted-foreground">{(100 - dailyProgress).toFixed(0)}% dnevnog limita preostalo</p>
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Mesecna potrosnja</span>
              <span className="font-semibold tabular-nums">
                {formatBalance(account.monthlySpending, account.currency)} / {formatBalance(account.monthlyLimit, account.currency)}
              </span>
            </div>
            <Progress value={monthlyProgress} className={`h-2.5 ${monthlyProgress > 80 ? '[&>div]:bg-red-500' : monthlyProgress > 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} />
            <p className="text-xs text-muted-foreground">{(100 - monthlyProgress).toFixed(0)}% mesecnog limita preostalo</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dailyLimit">Novi dnevni limit</Label>
              <Input id="dailyLimit" type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyLimit">Novi mesecni limit</Label>
              <Input id="monthlyLimit" type="number" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveLimits} disabled={isSavingLimits} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">
            {isSavingLimits ? 'Cuvanje...' : 'Sacuvaj limite'}
          </Button>
        </CardContent>
      </Card>

      {/* Actions card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Akcije</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Novi naziv racuna"
              className="max-w-sm"
            />
            <Button onClick={saveName} disabled={isSavingName}>
              {isSavingName ? 'Cuvanje...' : 'Izmeni naziv'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
              onClick={() => navigate(`/payments/new?from=${account.accountNumber}`)}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Novo placanje
            </Button>
            <Button variant="outline" className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-colors" onClick={() => navigate(`/transfers?from=${account.accountNumber}`)}>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Prenos
            </Button>
            <Button variant="outline" className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-colors" onClick={() => navigate(`/payments/history?account=${account.accountNumber}`)}>
              <History className="mr-2 h-4 w-4" /> Sve transakcije
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Poslednje transakcije</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Nema transakcija za ovaj racun</p>
              <p className="text-sm text-muted-foreground mt-1">Transakcije ce se pojaviti nakon prve uplate ili placanja.</p>
            </div>
          ) : (
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
                  const isOutgoing = tx.fromAccountNumber === account.accountNumber;
                  return (
                    <TableRow key={tx.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        {isOutgoing ? (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.createdAt)}</TableCell>
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
                      <TableCell className={`text-right font-medium whitespace-nowrap ${isOutgoing ? 'text-destructive' : 'text-green-600'}`}>
                        {isOutgoing ? '\u2212' : '+'}{formatBalance(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={txStatusVariant[tx.status]}>
                          {txStatusLabels[tx.status] || tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
