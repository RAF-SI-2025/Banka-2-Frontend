// Ova stranica je glavna strana nakon logina. Prikazuje:
// 1. Listu korisnikovih racuna sa stanjem (accountService.getMyAccounts)
// 2. Poslednjih 5 transakcija (transactionService.getAll sa limit=5)
// 3. Brzo placanje widget (skracena forma za placanje, otvara NewPaymentPage)
// 4. Kursna lista widget (currencyService.getExchangeRates)

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  Users, UserPlus, Building2, BookUser, ShieldCheck, FileText,
  Wallet, ArrowUpRight, ArrowDownLeft, Send, RefreshCw,
  CreditCard, TrendingUp, TrendingDown,
} from 'lucide-react';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import { transactionService } from '@/services/transactionService';
import { employeeService } from '@/services/employeeService';
import type { Account, ExchangeRate, PaymentRecipient, Transaction } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : (0).toFixed(decimals);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

interface AdminCard {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
}

const adminCards: AdminCard[] = [
  { title: 'Lista zaposlenih', description: 'Pregled i upravljanje zaposlenima.', path: '/admin/employees', icon: <Users className="h-5 w-5" /> },
  { title: 'Novi zaposleni', description: 'Kreiranje naloga za zaposlenog.', path: '/admin/employees/new', icon: <UserPlus className="h-5 w-5" /> },
  { title: 'Portal računa', description: 'Otvaranje i pregled klijentskih računa.', path: '/employee/accounts', icon: <Building2 className="h-5 w-5" /> },
  { title: 'Portal klijenata', description: 'Pregled klijenata i njihovih računa.', path: '/employee/clients', icon: <BookUser className="h-5 w-5" /> },
  { title: 'Zahtevi za kredit', description: 'Obrada klijentskih zahteva za kredit.', path: '/employee/loan-requests', icon: <ShieldCheck className="h-5 w-5" /> },
  { title: 'Svi krediti', description: 'Pregled svih aktivnih i završenih kredita.', path: '/employee/loans', icon: <FileText className="h-5 w-5" /> },
];

// Skeleton components
function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const currencyColors: Record<string, string> = {
  RSD: 'text-blue-600 dark:text-blue-400',
  EUR: 'text-indigo-600 dark:text-indigo-400',
  USD: 'text-green-600 dark:text-green-400',
  CHF: 'text-red-600 dark:text-red-400',
  GBP: 'text-purple-600 dark:text-purple-400',
  JPY: 'text-orange-600 dark:text-orange-400',
  CAD: 'text-rose-600 dark:text-rose-400',
  AUD: 'text-teal-600 dark:text-teal-400',
};

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState({ total: 0, active: 0, loading: false });

  const [quickFrom, setQuickFrom] = useState('');
  const [quickRecipient, setQuickRecipient] = useState('');
  const [quickAmount, setQuickAmount] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [myAccounts, recentTransactions, savedRecipients, rates] = await Promise.all([
          accountService.getMyAccounts(),
          transactionService.getAll({ page: 0, limit: 5 }),
          paymentRecipientService.getAll(),
          currencyService.getExchangeRates(),
        ]);

        const safeAccounts = asArray<Account>(myAccounts);
        const txSource = (recentTransactions as { content?: unknown } | undefined)?.content ?? recentTransactions;
        const safeTransactions = asArray<Transaction>(txSource);
        const safeRecipients = asArray<PaymentRecipient>(savedRecipients);
        const safeRates = asArray<ExchangeRate>(rates);

        setAccounts(safeAccounts);
        setTransactions(safeTransactions);
        setRecipients(safeRecipients);
        setExchangeRates(safeRates.slice(0, 8));

        if (safeAccounts.length > 0) {
          setQuickFrom(safeAccounts[0].accountNumber ?? '');
        }
      } catch {
        toast.error('Neuspešno učitavanje početnih podataka.');
        setAccounts([]);
        setTransactions([]);
        setRecipients([]);
        setExchangeRates([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const loadAdminStats = async () => {
      setAdminStats((prev) => ({ ...prev, loading: true }));
      try {
        const response = await employeeService.getAll({ limit: 100 });
        const allEmployees = Array.isArray(response?.content) ? response.content : [];
        const activeEmployees = allEmployees.filter((emp) => emp?.isActive).length;
        setAdminStats({
          total: Number(response?.totalElements) || allEmployees.length,
          active: activeEmployees,
          loading: false,
        });
      } catch {
        setAdminStats((prev) => ({ ...prev, loading: false }));
      }
    };

    loadAdminStats();
  }, [isAdmin]);

  const goToQuickPayment = () => {
    if (!quickFrom || !quickRecipient || !quickAmount) {
      toast.error('Popunite sva polja za brzo plaćanje.');
      return;
    }

    const selectedRecipient = recipients.find((r) => String(r.id) === quickRecipient);
    if (!selectedRecipient) {
      toast.error('Izaberite primaoca.');
      return;
    }

    navigate(
      `/payments/new?from=${encodeURIComponent(quickFrom)}&to=${encodeURIComponent(selectedRecipient.accountNumber)}&recipient=${encodeURIComponent(selectedRecipient.name)}&amount=${encodeURIComponent(quickAmount)}`
    );
  };

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dobrodošli{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isAdmin ? 'Upravljajte sistemom i pratite aktivnosti.' : 'Pregledajte račune, transakcije i upravljajte finansijama.'}
        </p>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <section className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ukupno zaposlenih</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold">{adminStats.loading ? '-' : adminStats.total}</div>
                <p className="mt-1 text-xs text-muted-foreground">registrovanih u sistemu</p>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aktivnih</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{adminStats.loading ? '-' : adminStats.active}</div>
                <p className="mt-1 text-xs text-muted-foreground">trenutno aktivnih</p>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Neaktivnih</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {adminStats.loading ? '-' : Math.max(adminStats.total - adminStats.active, 0)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">deaktiviranih naloga</p>
              </CardContent>
            </Card>
          </div>

          {/* Admin quick actions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Brze admin akcije</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adminCards.map((card) => (
                <Card
                  key={card.path}
                  className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 hover:border-indigo-500/20"
                  onClick={() => navigate(card.path)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        {card.icon}
                      </div>
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Accounts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Moji računi</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/accounts')}>Svi računi</Button>
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
        ) : accounts.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <Wallet className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Nemate otvorenih računa</p>
              <p className="text-sm text-muted-foreground mt-1">Kontaktirajte banku za otvaranje računa.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card
                key={account.id}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                onClick={() => navigate(`/accounts/${account.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{account.name || `${account.accountType} račun`}</CardTitle>
                    <Badge variant="outline" className="text-xs">{account.accountType}</Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">{account.accountNumber}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${currencyColors[account.currency] || ''}`}>
                    {formatAmount(account.balance)} <span className="text-sm font-semibold">{account.currency}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Raspoloživo: {formatAmount(account.availableBalance)} {account.currency}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Poslednje transakcije</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/payments/history')}>Vidi sve</Button>
        </div>
        {loading ? (
          <TableSkeleton rows={5} />
        ) : transactions.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <RefreshCw className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Nema nedavnih transakcija</p>
              <p className="text-sm text-muted-foreground mt-1">Vaše transakcije će se prikazati ovde.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Datum</TableHead>
                  <TableHead>Primalac</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isOutgoing = true; // default assumption for payments
                  return (
                    <TableRow key={tx.id} className="group">
                      <TableCell>
                        {isOutgoing
                          ? <ArrowUpRight className="h-4 w-4 text-red-500" />
                          : <ArrowDownLeft className="h-4 w-4 text-emerald-500" />}
                      </TableCell>
                      <TableCell className="text-sm">{formatDateTime(tx.createdAt)}</TableCell>
                      <TableCell className="font-medium text-sm">{tx.recipientName || '-'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatAmount(tx.amount)} {tx.currency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.status === 'COMPLETED' ? 'success'
                              : tx.status === 'PENDING' ? 'warning'
                              : tx.status === 'REJECTED' ? 'destructive'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {tx.status === 'COMPLETED' ? 'Završena'
                            : tx.status === 'PENDING' ? 'Na čekanju'
                            : tx.status === 'REJECTED' ? 'Odbijena'
                            : tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {/* Quick payment + exchange in 2 columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick payment */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Brzo plaćanje</h2>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quickFrom" className="text-xs font-medium">Sa računa</Label>
                <select
                  id="quickFrom"
                  title="Račun"
                  value={quickFrom}
                  onChange={(e) => setQuickFrom(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Izaberite račun</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quickRecipient" className="text-xs font-medium">Primalac</Label>
                <select
                  id="quickRecipient"
                  title="Primalac"
                  value={quickRecipient}
                  onChange={(e) => setQuickRecipient(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Izaberite primaoca</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quickAmount" className="text-xs font-medium">Iznos</Label>
                <Input id="quickAmount" type="number" placeholder="0.00" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                onClick={goToQuickPayment}
              >
                <Send className="mr-2 h-4 w-4" />
                Nastavi na plaćanje
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Exchange rates */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Kursna lista</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/exchange')}>Menjačnica</Button>
          </div>
          {loading ? (
            <TableSkeleton rows={4} />
          ) : exchangeRates.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <RefreshCw className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Kursna lista nije dostupna</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valuta</TableHead>
                    <TableHead className="text-right">Kupovni</TableHead>
                    <TableHead className="text-right">Prodajni</TableHead>
                    <TableHead className="text-right">Srednji</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates.map((rate) => (
                    <TableRow key={rate.currency}>
                      <TableCell>
                        <span className={`font-semibold ${currencyColors[rate.currency] || ''}`}>
                          {rate.currency}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatAmount(rate.buyRate, 4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatAmount(rate.sellRate, 4)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatAmount(rate.middleRate, 4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
