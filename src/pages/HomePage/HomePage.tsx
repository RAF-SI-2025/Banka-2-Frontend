import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  Users, UserPlus, Building2, BookUser, ShieldCheck, FileText,
  Wallet, ArrowUpRight, ArrowDownLeft, Send, CreditCard,
  TrendingUp, Landmark, ArrowRightLeft, PiggyBank,
  ChevronRight, Banknote, BarChart3, Clock, Eye, EyeOff,
} from 'lucide-react';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import { transactionService } from '@/services/transactionService';
import { employeeService } from '@/services/employeeService';
import { creditService } from '@/services/creditService';
import type { Account, ExchangeRate, Transaction } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '0,00';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' });
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

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
  RSD: 'РСД', EUR: '€', USD: '$', CHF: 'CHF', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$',
};

interface AdminCard {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  gradient: string;
}

const adminCards: AdminCard[] = [
  { title: 'Zaposleni', description: 'Upravljanje nalozima', path: '/admin/employees', icon: <Users className="h-5 w-5" />, gradient: 'from-indigo-500 to-violet-600' },
  { title: 'Novi zaposleni', description: 'Kreiranje naloga', path: '/admin/employees/new', icon: <UserPlus className="h-5 w-5" />, gradient: 'from-blue-500 to-indigo-600' },
  { title: 'Računi', description: 'Svi klijentski računi', path: '/employee/accounts', icon: <Building2 className="h-5 w-5" />, gradient: 'from-emerald-500 to-green-600' },
  { title: 'Klijenti', description: 'Pregled i izmena', path: '/employee/clients', icon: <BookUser className="h-5 w-5" />, gradient: 'from-amber-500 to-orange-600' },
  { title: 'Zahtevi za kredit', description: 'Odobravanje kredita', path: '/employee/loan-requests', icon: <ShieldCheck className="h-5 w-5" />, gradient: 'from-rose-500 to-pink-600' },
  { title: 'Svi krediti', description: 'Aktivni i završeni', path: '/employee/loans', icon: <FileText className="h-5 w-5" />, gradient: 'from-purple-500 to-violet-600' },
];

// ────────────────────────────────────────────────────────────────────
// Skeletons
// ────────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 p-8 sm:p-10">
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/20" />
        <div className="h-12 w-64 animate-pulse rounded-lg bg-white/20" />
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

function AccountCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-64 h-40 rounded-2xl bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
  );
}

// ────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [adminStats, setAdminStats] = useState({ employees: 0, active: 0, loans: 0, loading: true });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const safe = async <T,>(fn: () => Promise<T>, fb: T): Promise<T> => {
        try { return await fn(); } catch { return fb; }
      };
      try {
        const [myAccounts, recentTx, rates] = await Promise.all([
          safe(() => accountService.getMyAccounts(), []),
          safe(() => transactionService.getAll({ page: 0, limit: 6 }), { content: [] } as never),
          safe(() => currencyService.getExchangeRates(), []),
        ]);
        setAccounts(asArray<Account>(myAccounts));
        const txSrc = (recentTx as { content?: unknown })?.content ?? recentTx;
        setTransactions(asArray<Transaction>(txSrc).slice(0, 6));
        setExchangeRates(asArray<ExchangeRate>(rates).filter(r => r.currency !== 'RSD').slice(0, 7));
      } catch { toast.error('Greška pri učitavanju.'); } finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setAdminStats(prev => ({ ...prev, loading: true }));
      try {
        const [empRes, loanRes] = await Promise.all([
          employeeService.getAll({ limit: 100 }).catch(() => ({ content: [], totalElements: 0 })),
          creditService.getAll().catch(() => ({ content: [], totalElements: 0 })),
        ]);
        const emps = Array.isArray(empRes?.content) ? empRes.content : [];
        setAdminStats({
          employees: Number(empRes?.totalElements) || emps.length,
          active: emps.filter(e => e?.isActive).length,
          loans: Number(loanRes?.totalElements) || 0,
          loading: false,
        });
      } catch { setAdminStats(prev => ({ ...prev, loading: false })); }
    };
    load();
  }, [isAdmin]);

  // Total balance across all RSD accounts (for hero)
  const totalRSD = accounts.filter(a => a.currency === 'RSD').reduce((s, a) => s + (a.balance ?? 0), 0);
  const totalFX = accounts.filter(a => a.currency !== 'RSD').length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Dobra noć';
    if (h < 12) return 'Dobro jutro';
    if (h < 18) return 'Dobar dan';
    return 'Dobro veče';
  })();

  // ──────────────── CLIENT DASHBOARD ────────────────
  if (!isAdmin) return (
    <div className="space-y-8">
      {/* Hero - Total Balance */}
      {loading ? <HeroSkeleton /> : (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 sm:p-10 text-white shadow-2xl shadow-indigo-500/25">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -mb-16 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-purple-400/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <p className="text-indigo-200 text-sm font-medium tracking-wide uppercase">{greeting}</p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
                {user?.firstName ?? 'Korisniče'}
              </h1>
              <div className="mt-5 flex items-center gap-3">
                <p className="text-indigo-200 text-sm">Ukupno stanje</p>
                <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-indigo-300 hover:text-white transition-colors" aria-label="Prikaži/sakrij stanje">
                  {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight">
                  {balanceVisible ? formatAmount(totalRSD) : '••••••'}
                </span>
                <span className="text-xl font-semibold text-indigo-200">RSD</span>
              </div>
              {totalFX > 0 && (
                <p className="mt-2 text-sm text-indigo-200">
                  + {totalFX} devizn{totalFX === 1 ? 'i' : 'a'} račun{totalFX === 1 ? '' : 'a'}
                </p>
              )}
            </div>

            {/* Quick action pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Novo plaćanje', icon: <Send className="h-3.5 w-3.5" />, path: '/payments/new' },
                { label: 'Transfer', icon: <ArrowRightLeft className="h-3.5 w-3.5" />, path: '/transfers' },
                { label: 'Menjačnica', icon: <Banknote className="h-3.5 w-3.5" />, path: '/exchange' },
              ].map(a => (
                <button
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/25 transition-all"
                >
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Account Cards - Horizontal scroll */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-500" />
            Moji računi
          </h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/accounts')}>
            Svi računi <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            <AccountCardSkeleton /><AccountCardSkeleton /><AccountCardSkeleton />
          </div>
        ) : accounts.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 mb-3">
                <Wallet className="h-7 w-7 text-indigo-500" />
              </div>
              <p className="font-semibold">Nemate otvorenih računa</p>
              <p className="text-sm text-muted-foreground mt-1">Kontaktirajte banku za otvaranje računa.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {accounts.map(account => {
              const grad = currencyGradients[account.currency] || 'from-slate-500 to-slate-700';
              const sym = currencySymbols[account.currency] || account.currency;
              return (
                <div
                  key={account.id}
                  onClick={() => navigate(`/accounts/${account.id}`)}
                  className="flex-shrink-0 w-72 cursor-pointer group"
                >
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 group-hover:scale-[1.02]`}>
                    {/* Decorative */}
                    <div className="absolute top-0 right-0 -mt-6 -mr-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-16 w-16 rounded-full bg-white/10 blur-lg" />

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/80 truncate max-w-[140px]">
                          {account.name || `${account.accountType} račun`}
                        </p>
                        <span className="text-xs font-bold bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-0.5">
                          {account.currency}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/50 font-mono">{account.accountNumber}</p>

                      <div className="mt-4">
                        <p className="text-xs text-white/60 uppercase tracking-wider">Stanje</p>
                        <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                          {balanceVisible ? formatAmount(account.balance) : '••••'} <span className="text-base font-semibold text-white/70">{sym}</span>
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                        <span>Raspoloživo: {balanceVisible ? formatAmount(account.availableBalance) : '••••'}</span>
                        <Badge variant="outline" className="border-white/30 text-white/80 text-[10px] px-1.5">
                          {account.status === 'ACTIVE' ? 'Aktivan' : account.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Actions Grid */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          Brze akcije
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Novo plaćanje', icon: <Send className="h-5 w-5" />, path: '/payments/new', color: 'from-indigo-500 to-violet-500' },
            { label: 'Transfer', icon: <ArrowRightLeft className="h-5 w-5" />, path: '/transfers', color: 'from-blue-500 to-cyan-500' },
            { label: 'Menjačnica', icon: <Banknote className="h-5 w-5" />, path: '/exchange', color: 'from-emerald-500 to-green-500' },
            { label: 'Kartice', icon: <CreditCard className="h-5 w-5" />, path: '/cards', color: 'from-amber-500 to-orange-500' },
            { label: 'Krediti', icon: <PiggyBank className="h-5 w-5" />, path: '/loans', color: 'from-rose-500 to-pink-500' },
            { label: 'Primaoci', icon: <BookUser className="h-5 w-5" />, path: '/payments/recipients', color: 'from-purple-500 to-violet-500' },
            { label: 'Istorija', icon: <Clock className="h-5 w-5" />, path: '/payments/history', color: 'from-slate-500 to-gray-600' },
            { label: 'Računi', icon: <Wallet className="h-5 w-5" />, path: '/accounts', color: 'from-teal-500 to-cyan-600' },
          ].map(a => (
            <Card
              key={a.path}
              className="group cursor-pointer border-0 bg-muted/30 hover:bg-muted/60 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              onClick={() => navigate(a.path)}
            >
              <CardContent className="flex flex-col items-center justify-center py-5 gap-2.5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${a.color} text-white shadow-md transition-transform group-hover:scale-110`}>
                  {a.icon}
                </div>
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Two columns: Transactions + Exchange rates */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Transactions - wider */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Poslednje transakcije
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/payments/history')}>
              Sve <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <Card className="overflow-hidden">
            {loading ? (
              <CardContent className="py-6 space-y-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full animate-pulse bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            ) : transactions.length === 0 ? (
              <CardContent className="flex flex-col items-center text-center py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                  <Clock className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-semibold">Nema nedavnih transakcija</p>
                <p className="text-sm text-muted-foreground mt-1">Vaše transakcije će se prikazati ovde.</p>
              </CardContent>
            ) : (
              <div className="divide-y">
                {transactions.map(tx => {
                  const myAccountNumbers = accounts.map(a => a.accountNumber);
                  const isOut = myAccountNumbers.includes(tx.fromAccountNumber);
                  return (
                    <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isOut ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {isOut ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.recipientName || tx.description || 'Transakcija'}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)} · {formatTime(tx.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold tabular-nums ${isOut ? 'text-red-500' : 'text-emerald-500'}`}>
                          {isOut ? '-' : '+'}{formatAmount(tx.amount)} {tx.currency}
                        </p>
                        <Badge
                          variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'PENDING' ? 'warning' : 'destructive'}
                          className="text-[10px] px-1.5 mt-0.5"
                        >
                          {tx.status === 'COMPLETED' ? 'Završena' : tx.status === 'PENDING' ? 'Na čekanju' : tx.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        {/* Exchange Rates - narrower */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-500" />
              Kursna lista
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/exchange')}>
              Više <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <Card className="overflow-hidden">
            {loading ? (
              <CardContent className="py-6 space-y-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            ) : exchangeRates.length === 0 ? (
              <CardContent className="flex flex-col items-center py-12">
                <Landmark className="h-7 w-7 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Kursna lista nedostupna</p>
              </CardContent>
            ) : (
              <div className="divide-y">
                {exchangeRates.map(rate => {
                  const rsdPerUnit = rate.middleRate && rate.middleRate > 0 ? (1 / rate.middleRate) : 0;
                  return (
                    <div key={rate.currency} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${currencyGradients[rate.currency] || 'from-slate-400 to-slate-600'} text-white text-xs font-bold`}>
                          {rate.currency?.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{rate.currency}</p>
                          <p className="text-[11px] text-muted-foreground">1 {rate.currency}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatAmount(rsdPerUnit, 2)} RSD</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {formatAmount(rate.sellRate ? (1 / rate.sellRate) : 0, 2)} / {formatAmount(rate.buyRate ? (1 / rate.buyRate) : 0, 2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );

  // ──────────────── ADMIN DASHBOARD ────────────────
  return (
    <div className="space-y-8">
      {/* Admin Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-8 sm:p-10 text-white shadow-2xl">
        {/* Decorative grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 -mb-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-indigo-300 uppercase tracking-widest">Admin panel</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {greeting}, {user?.firstName ?? 'Admin'}
          </h1>
          <p className="mt-2 text-indigo-300 max-w-lg">
            Upravljajte zaposlenima, klijentima, kreditima i pratite rad banke.
          </p>
        </div>
      </div>

      {/* Admin Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Zaposleni', value: adminStats.employees, icon: <Users className="h-5 w-5" />, gradient: 'from-indigo-500/10 to-violet-500/10', iconColor: 'text-indigo-500', borderColor: 'border-l-indigo-500' },
          { label: 'Aktivnih', value: adminStats.active, icon: <TrendingUp className="h-5 w-5" />, gradient: 'from-emerald-500/10 to-green-500/10', iconColor: 'text-emerald-500', borderColor: 'border-l-emerald-500' },
          { label: 'Neaktivnih', value: Math.max(adminStats.employees - adminStats.active, 0), icon: <Users className="h-5 w-5" />, gradient: 'from-amber-500/10 to-orange-500/10', iconColor: 'text-amber-500', borderColor: 'border-l-amber-500' },
          { label: 'Krediti', value: adminStats.loans, icon: <PiggyBank className="h-5 w-5" />, gradient: 'from-rose-500/10 to-pink-500/10', iconColor: 'text-rose-500', borderColor: 'border-l-rose-500' },
        ].map(stat => (
          <Card key={stat.label} className={`relative overflow-hidden border-l-4 ${stat.borderColor}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient}`} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 ${stat.iconColor}`}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold tabular-nums">{adminStats.loading ? '—' : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Admin Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          Upravljanje
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminCards.map(card => (
            <Card
              key={card.path}
              className="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 border-0 bg-muted/20 hover:bg-background"
              onClick={() => navigate(card.path)}
            >
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
