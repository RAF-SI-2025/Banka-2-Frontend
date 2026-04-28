import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  Users, UserPlus, Building2, BookUser, ShieldCheck,
  Wallet, Send, CreditCard, Briefcase, ShoppingCart,
  TrendingUp, TrendingDown, Landmark, ArrowRightLeft, PiggyBank,
  ChevronRight, Banknote, BarChart3, Clock, Eye, EyeOff, Plus, ClipboardList,
} from 'lucide-react';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import { transactionService } from '@/services/transactionService';
import { employeeService } from '@/services/employeeService';
import { creditService } from '@/services/creditService';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import portfolioService from '@/services/portfolioService';
import orderService from '@/services/orderService';
import type { PortfolioSummary, Order } from '@/types/celina3';
import type { Account, ExchangeRate, Transaction, PaymentRecipient } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { asArray, formatAmount, formatDate } from '@/utils/formatters';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
}

/** Generate fake balance history data for a chart */
function generateBalanceHistory(currentBalance: number, days: number): { date: string; balance: number }[] {
  const data: { date: string; balance: number }[] = [];
  let balance = currentBalance * (0.75 + Math.random() * 0.15);
  const dailyDelta = (currentBalance - balance) / days;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const noise = (Math.random() - 0.45) * currentBalance * 0.04;
    balance += dailyDelta + noise;
    balance = Math.max(balance, currentBalance * 0.3);
    data.push({
      date: d.toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' }),
      balance: Math.round(balance),
    });
  }
  // last point = actual balance
  if (data.length > 0) data[data.length - 1].balance = Math.round(currentBalance);
  return data;
}

/** Generate tiny sparkline data (7 points) */
function generateSparkline(endValue: number): number[] {
  const pts: number[] = [];
  let v = endValue * (0.85 + Math.random() * 0.1);
  for (let i = 0; i < 7; i++) {
    v += (endValue - v) * 0.25 + (Math.random() - 0.45) * endValue * 0.05;
    pts.push(Math.round(v));
  }
  pts[6] = Math.round(endValue);
  return pts;
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
  RSD: 'RSD', EUR: '\u20ac', USD: '$', CHF: 'CHF', GBP: '\u00a3', JPY: '\u00a5', CAD: 'C$', AUD: 'A$',
};

const currencyFlags: Record<string, string> = {
  EUR: '\ud83c\uddea\ud83c\uddfa', USD: '\ud83c\uddfa\ud83c\uddf8', CHF: '\ud83c\udde8\ud83c\udded',
  GBP: '\ud83c\uddec\ud83c\udde7', JPY: '\ud83c\uddef\ud83c\uddf5', CAD: '\ud83c\udde8\ud83c\udde6',
  AUD: '\ud83c\udde6\ud83c\uddfa', RSD: '\ud83c\uddf7\ud83c\uddf8',
};

interface AdminCard {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  gradient: string;
}

function getQuickCards(isAdmin: boolean, isSupervisor: boolean, isAgent: boolean): AdminCard[] {
  const cards: AdminCard[] = [];

  if (isAdmin) {
    cards.push(
      { title: 'Zaposleni', description: 'Upravljanje nalozima', path: '/admin/employees', icon: <Users className="h-5 w-5" />, gradient: 'from-indigo-500 to-violet-600' },
      { title: 'Novi zaposleni', description: 'Kreiranje naloga', path: '/admin/employees/new', icon: <UserPlus className="h-5 w-5" />, gradient: 'from-blue-500 to-indigo-600' },
    );
  }

  cards.push(
    { title: 'Racuni', description: 'Svi klijentski racuni', path: '/employee/accounts', icon: <Building2 className="h-5 w-5" />, gradient: 'from-emerald-500 to-green-600' },
    { title: 'Klijenti', description: 'Pregled i izmena', path: '/employee/clients', icon: <BookUser className="h-5 w-5" />, gradient: 'from-amber-500 to-orange-600' },
  );

  if (isSupervisor || isAdmin) {
    cards.push(
      { title: 'Orderi', description: 'Pregled i odobravanje', path: '/employee/orders', icon: <ShieldCheck className="h-5 w-5" />, gradient: 'from-rose-500 to-pink-600' },
      { title: 'Aktuari', description: 'Upravljanje limitima', path: '/employee/actuaries', icon: <TrendingUp className="h-5 w-5" />, gradient: 'from-purple-500 to-violet-600' },
      { title: 'Profit Banke', description: 'Pregled profita', path: '/employee/profit-bank', icon: <Landmark className="h-5 w-5" />, gradient: 'from-indigo-500 to-violet-600' },
      { title: 'Investicioni fondovi', description: 'Fondovi i ulaganja', path: '/funds', icon: <PiggyBank className="h-5 w-5" />, gradient: 'from-emerald-500 to-teal-600' },
    );
  }

  if (isAgent && !isSupervisor && !isAdmin) {
    cards.push(
      { title: 'Investicioni fondovi', description: 'Pregled i ulaganja', path: '/funds', icon: <PiggyBank className="h-5 w-5" />, gradient: 'from-emerald-500 to-teal-600' },
    );
  }

  cards.push(
    { title: 'Berza', description: 'Hartije od vrednosti', path: '/securities', icon: <TrendingUp className="h-5 w-5" />, gradient: 'from-teal-500 to-cyan-600' },
    { title: 'Portfolio', description: 'Moje hartije', path: '/portfolio', icon: <Wallet className="h-5 w-5" />, gradient: 'from-orange-500 to-amber-600' },
  );

  return cards;
}

const periodOptions = [
  { label: '1N', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1G', days: 365 },
];

// ────────────────────────────────────────────────────────────────────
// Animated counter hook
// ────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { requestAnimationFrame(() => setCount(0)); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return count;
}

// ────────────────────────────────────────────────────────────────────
// Custom chart tooltip
// ────────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur-sm px-4 py-2.5 shadow-xl">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold font-mono tabular-nums">{formatAmount(payload[0].value)} RSD</p>
    </div>
  );
}

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

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-8 w-10 animate-pulse rounded-full bg-muted" />)}
        </div>
      </div>
      <div className="h-[220px] animate-pulse rounded-xl bg-muted/50" />
    </div>
  );
}

function AccountCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-72 h-44 rounded-2xl bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
  );
}

// ────────────────────────────────────────────────────────────────────
// MiniSparkline for account cards
// ────────────────────────────────────────────────────────────────────
function MiniSparkline({ data, color = '#ffffff' }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} strokeOpacity={0.6} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin, isSupervisor, isAgent } = useAuth();
  const isEmployeeRole = user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [adminStats, setAdminStats] = useState({ employees: 0, active: 0, loans: 0, loading: true });
  const [chartPeriod, setChartPeriod] = useState(30);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const safe = async <T,>(fn: () => Promise<T>, fb: T): Promise<T> => {
        try { return await fn(); } catch { return fb; }
      };
      try {
        const [myAccounts, recentTx, rates, savedRecipients] = await Promise.all([
          safe(() => accountService.getMyAccounts(), []),
          safe(() => transactionService.getAll({ page: 0, limit: 6 }), { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0 }),
          safe(() => currencyService.getExchangeRates(), []),
          safe(() => paymentRecipientService.getAll(), []),
        ]);
        setAccounts(asArray<Account>(myAccounts));
        const txSrc = recentTx?.content ?? recentTx;
        setTransactions(asArray<Transaction>(txSrc).slice(0, 6));
        setExchangeRates(asArray<ExchangeRate>(rates).filter(r => r.currency !== 'RSD').slice(0, 7));
        setRecipients(asArray<PaymentRecipient>(savedRecipients).slice(0, 6));
      } catch { toast.error('Greska pri ucitavanju.'); } finally { setLoading(false); }
    };
    load();
  }, []);

  // Load portfolio + orders for employee dashboard
  useEffect(() => {
    if (!isEmployeeRole) return;
    const loadEmpData = async () => {
      setEmployeeLoading(true);
      try {
        const [summary, ordersRes] = await Promise.all([
          portfolioService.getSummary().catch(() => null),
          orderService.getMy(0, 5).catch(() => ({ content: [] })),
        ]);
        setPortfolioSummary(summary);
        setRecentOrders(Array.isArray(ordersRes.content) ? ordersRes.content.slice(0, 5) : []);
      } catch { /* ignore */ } finally {
        setEmployeeLoading(false);
      }
    };
    loadEmpData();
  }, [isEmployeeRole]);

  useEffect(() => {
    if (!isEmployeeRole) return;
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
  }, [isEmployeeRole]);

  // Total balance across all RSD accounts (for hero)
  const totalRSD = useMemo(() => accounts.filter(a => a.currency === 'RSD').reduce((s, a) => s + (a.balance ?? 0), 0), [accounts]);
  const totalFX = useMemo(() => accounts.filter(a => a.currency !== 'RSD').length, [accounts]);

  // Chart data (memoized to avoid regenerating random data on every render)
  const balanceHistory = useMemo(() => generateBalanceHistory(totalRSD || 250000, chartPeriod), [totalRSD, chartPeriod]);

  // Sparkline data per account (stable via useRef)
  const sparklineRef = useRef<Map<number, number[]>>(new Map());
  accounts.forEach(a => {
    if (!sparklineRef.current.has(a.id)) {
      sparklineRef.current.set(a.id, generateSparkline(a.balance ?? 0));
    }
  });

  // Exchange rate sparklines
  const rateSparkRef = useRef<Map<string, number[]>>(new Map());
  exchangeRates.forEach(r => {
    if (!rateSparkRef.current.has(r.currency)) {
      const mid = r.middleRate && r.middleRate > 0 ? 1 / r.middleRate : 100;
      rateSparkRef.current.set(r.currency, generateSparkline(mid));
    }
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Dobra noc';
    if (h < 12) return 'Dobro jutro';
    if (h < 18) return 'Dobar dan';
    return 'Dobro vece';
  })();

  // Animated counters (must be before any early return — React hooks rules)
  const animatedEmployees = useCountUp(adminStats.loading ? 0 : adminStats.employees);
  const animatedActive = useCountUp(adminStats.loading ? 0 : adminStats.active);
  const portfolioProfit = portfolioSummary?.totalProfit ?? 0;
  const portfolioValue = portfolioSummary?.totalValue ?? 0;
  const paidTax = portfolioSummary?.paidTaxThisYear ?? 0;
  const animatedPortfolio = useCountUp(employeeLoading ? 0 : Math.round(portfolioValue));

  // ──────────────── CLIENT DASHBOARD ────────────────
  if (!isEmployeeRole) return (
    <div className="space-y-8 animate-fade-up">
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
                {user?.firstName ?? 'Korisnice'}
              </h1>
              <div className="mt-5 flex items-center gap-3">
                <p className="text-indigo-200 text-sm">Ukupno stanje</p>
                <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-indigo-300 hover:text-white transition-colors" aria-label="Prikazi/sakrij stanje">
                  {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight">
                  {balanceVisible ? formatAmount(totalRSD) : '\u2022\u2022\u2022\u2022\u2022\u2022'}
                </span>
                <span className="text-xl font-semibold text-indigo-200">RSD</span>
              </div>
              {totalFX > 0 && (
                <p className="mt-2 text-sm text-indigo-200">
                  + {totalFX} devizn{totalFX === 1 ? 'i' : 'a'} racun{totalFX === 1 ? '' : 'a'}
                </p>
              )}
            </div>

            {/* Quick action pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Novo placanje', icon: <Send className="h-3.5 w-3.5" />, path: '/payments/new' },
                { label: 'Transfer', icon: <ArrowRightLeft className="h-3.5 w-3.5" />, path: '/transfers' },
                { label: 'Menjacnica', icon: <Banknote className="h-3.5 w-3.5" />, path: '/exchange' },
              ].map(a => (
                <button
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/25 transition-all duration-300 hover:scale-105"
                >
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Balance History Chart */}
      {loading ? <ChartSkeleton /> : (
        <Card className="rounded-2xl border shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Istorija stanja
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Kretanje ukupnog stanja</p>
              </div>
              <div className="flex gap-1 rounded-full bg-muted/60 p-1">
                {periodOptions.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setChartPeriod(p.days)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                      chartPeriod === p.days
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceHistory} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['dataMin - 5000', 'dataMax + 5000']} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#balanceGradient)"
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Cards - Horizontal scroll */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-500" />
            Moji racuni
          </h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/accounts')}>
            Svi racuni <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            <AccountCardSkeleton /><AccountCardSkeleton /><AccountCardSkeleton />
          </div>
        ) : accounts.length === 0 ? (
          <Card className="py-12 rounded-2xl">
            <CardContent className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 mb-3">
                <Wallet className="h-7 w-7 text-indigo-500" />
              </div>
              <p className="font-semibold">Nemate otvorenih racuna</p>
              <p className="text-sm text-muted-foreground mt-1">Kontaktirajte banku za otvaranje racuna.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {accounts.map((account, idx) => {
              const grad = currencyGradients[account.currency] || 'from-slate-500 to-slate-700';
              const sym = currencySymbols[account.currency] || account.currency;
              const sparkData = sparklineRef.current.get(account.id) || [];
              return (
                <div
                  key={account.id}
                  onClick={() => navigate(`/accounts/${account.id}`)}
                  className="flex-shrink-0 w-72 cursor-pointer group"
                  style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
                >
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-lg transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1 group-hover:scale-[1.03]`}>
                    {/* Decorative */}
                    <div className="absolute top-0 right-0 -mt-6 -mr-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-16 w-16 rounded-full bg-white/10 blur-lg" />

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/80 truncate max-w-[140px]">
                          {account.name || `${account.accountType} racun`}
                        </p>
                        <span className="text-xs font-bold bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-0.5">
                          {account.currency}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/50 font-mono">{account.accountNumber}</p>

                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-white/60 uppercase tracking-wider">Stanje</p>
                          <p className="mt-0.5 text-2xl font-bold font-mono tabular-nums tracking-tight">
                            {balanceVisible ? formatAmount(account.balance) : '\u2022\u2022\u2022\u2022'} <span className="text-base font-semibold text-white/70">{sym}</span>
                          </p>
                        </div>
                        {sparkData.length > 0 && (
                          <MiniSparkline data={sparkData} color="rgba(255,255,255,0.5)" />
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                        <span>Raspolozivo: {balanceVisible ? formatAmount(account.availableBalance) : '\u2022\u2022\u2022\u2022'}</span>
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
            { label: 'Novo placanje', sub: 'Uplata ili prenos', icon: <Send className="h-6 w-6" />, path: '/payments/new', color: 'from-indigo-500 to-violet-500' },
            { label: 'Transfer', sub: 'Izmedju racuna', icon: <ArrowRightLeft className="h-6 w-6" />, path: '/transfers', color: 'from-blue-500 to-cyan-500' },
            { label: 'Menjacnica', sub: 'Konverzija valuta', icon: <Banknote className="h-6 w-6" />, path: '/exchange', color: 'from-emerald-500 to-green-500' },
            { label: 'Kartice', sub: 'Upravljanje', icon: <CreditCard className="h-6 w-6" />, path: '/cards', color: 'from-amber-500 to-orange-500' },
            { label: 'Krediti', sub: 'Apliciranje', icon: <PiggyBank className="h-6 w-6" />, path: '/loans', color: 'from-rose-500 to-pink-500' },
            { label: 'Investicioni fondovi', sub: 'Fondovi i ulaganja', icon: <Landmark className="h-6 w-6" />, path: '/funds', color: 'from-emerald-500 to-teal-500' },
            { label: 'Primaoci', sub: 'Sacuvani kontakti', icon: <BookUser className="h-6 w-6" />, path: '/payments/recipients', color: 'from-purple-500 to-violet-500' },
            { label: 'Istorija', sub: 'Sve transakcije', icon: <Clock className="h-6 w-6" />, path: '/payments/history', color: 'from-slate-500 to-gray-600' },
            { label: 'Racuni', sub: 'Pregled stanja', icon: <Wallet className="h-6 w-6" />, path: '/accounts', color: 'from-teal-500 to-cyan-600' },
          ].map(a => (
            <Card
              key={a.path}
              className="group cursor-pointer border-0 bg-muted/30 hover:bg-muted/60 rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              onClick={() => navigate(a.path)}
            >
              <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${a.color} text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
                  {a.icon}
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-foreground group-hover:text-foreground transition-colors block">{a.label}</span>
                  <span className="text-[11px] text-muted-foreground">{a.sub}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick Payment - Saved Recipients */}
      {!loading && recipients.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-500" />
              Brzo placanje
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/payments/recipients')}>
              Svi primaoci <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {recipients.map((recipient) => {
              const initials = recipient.name
                .split(/\s+/)
                .map(w => w.charAt(0).toUpperCase())
                .slice(0, 2)
                .join('');
              return (
                <button
                  key={recipient.id}
                  type="button"
                  onClick={() => navigate(`/payments/new?to=${encodeURIComponent(recipient.accountNumber)}&recipient=${encodeURIComponent(recipient.name)}`)}
                  className="flex-shrink-0 group flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-4 w-32 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-indigo-500/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-transform duration-300 group-hover:scale-110">
                    {initials || '?'}
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-sm font-semibold truncate">{recipient.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{recipient.accountNumber}</p>
                  </div>
                </button>
              );
            })}
            {/* Add new recipient button */}
            <button
              type="button"
              onClick={() => navigate('/payments/recipients')}
              className="flex-shrink-0 group flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 w-32 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-indigo-500/40 hover:bg-muted/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all duration-300 group-hover:bg-indigo-500/10 group-hover:text-indigo-500">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground group-hover:text-indigo-500 transition-colors">Dodaj</p>
            </button>
          </div>
        </section>
      )}

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
          <div className="space-y-3">
            {loading ? (
              <Card className="rounded-2xl">
                <CardContent className="py-6 space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full animate-pulse bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : transactions.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="flex flex-col items-center text-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                    <Clock className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">Nema nedavnih transakcija</p>
                  <p className="text-sm text-muted-foreground mt-1">Vase transakcije ce se prikazati ovde.</p>
                </CardContent>
              </Card>
            ) : (
              transactions.map((tx, idx) => {
                const myAccountNumbers = accounts.map(a => a.accountNumber);
                const isOut = myAccountNumbers.includes(tx.fromAccountNumber);
                const initial = (tx.recipientName || tx.description || 'T').charAt(0).toUpperCase();
                return (
                  <Card
                    key={tx.id}
                    className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300"
                    style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
                  >
                    <CardContent className="flex items-center gap-4 py-4 px-5">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold ${isOut ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.recipientName || tx.description || 'Transakcija'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.createdAt)} {formatTime(tx.createdAt) && `\u00b7 ${formatTime(tx.createdAt)}`}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-base font-bold font-mono tabular-nums ${isOut ? 'text-red-500' : 'text-emerald-500'}`}>
                          {isOut ? '-' : '+'}{formatAmount(tx.amount)} {tx.currency}
                        </p>
                        <Badge
                          variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'PENDING' ? 'warning' : 'destructive'}
                          className="text-[10px] px-1.5 mt-1"
                        >
                          {tx.status === 'COMPLETED' ? 'Zavrsena' : tx.status === 'PENDING' ? 'Na cekanju' : tx.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </section>

        {/* Exchange Rates - scrolling currency cards */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-500" />
              Kursna lista
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/exchange')}>
              Vise <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {loading ? (
            <Card className="rounded-2xl">
              <CardContent className="py-6 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : exchangeRates.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="flex flex-col items-center py-12">
                <Landmark className="h-7 w-7 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Kursna lista nedostupna</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {exchangeRates.map((rate, idx) => {
                const rsdPerUnit = rate.middleRate && rate.middleRate > 0 ? (1 / rate.middleRate) : 0;
                const sparkData = rateSparkRef.current.get(rate.currency) || [];
                return (
                  <Card
                    key={rate.currency}
                    className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                    style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
                  >
                    <CardContent className="flex items-center justify-between py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{currencyFlags[rate.currency] || '\ud83c\udfe6'}</span>
                        <div>
                          <p className="text-sm font-bold">{rate.currency}</p>
                          <p className="text-[11px] text-muted-foreground">1 {rate.currency}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sparkData.length > 0 && (
                          <div className="h-6 w-14 opacity-60">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparkData.map((v, i) => ({ i, v }))}>
                                <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono tabular-nums">{formatAmount(rsdPerUnit, 2)} RSD</p>
                          <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                            {formatAmount(rate.sellRate ? (1 / rate.sellRate) : 0, 2)} / {formatAmount(rate.buyRate ? (1 / rate.buyRate) : 0, 2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );

  // ──────────────── EMPLOYEE / ADMIN DASHBOARD ────────────────
  const pendingOrders = recentOrders.filter(o => o.status === 'PENDING').length;
  const approvedOrders = recentOrders.filter(o => o.status === 'APPROVED').length;
  const doneOrders = recentOrders.filter(o => o.status === 'DONE' || o.isDone).length;

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-8 sm:p-10 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 -mb-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-indigo-300 uppercase tracking-widest">
                {isAdmin ? 'Admin panel' : isSupervisor ? 'Supervizor panel' : isAgent ? 'Agent panel' : 'Employee portal'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {greeting}, {user?.firstName ?? 'Korisnice'}
            </h1>
            <p className="mt-2 text-indigo-300 max-w-lg">
              {isAdmin
                ? 'Upravljajte zaposlenima, klijentima, kreditima i pratite rad banke.'
                : isSupervisor
                ? 'Nadgledajte naloge, upravljajte aktuarima i pratite trgovinu.'
                : 'Pratite naloge i trgovinu na berzi.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Berza', icon: <TrendingUp className="h-3.5 w-3.5" />, path: '/securities' },
              { label: 'Portfolio', icon: <Briefcase className="h-3.5 w-3.5" />, path: '/portfolio' },
              { label: 'Novi nalog', icon: <Plus className="h-3.5 w-3.5" />, path: '/orders/new' },
            ].map(a => (
              <button
                key={a.path}
                type="button"
                onClick={() => navigate(a.path)}
                className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/25 transition-all duration-300 hover:scale-105"
              >
                {a.icon}{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-l-4 border-l-indigo-500 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-500/10" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vrednost portfolija</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 text-indigo-500">
              <Briefcase className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold font-mono tabular-nums">
              {employeeLoading ? '\u2014' : `${formatAmount(animatedPortfolio)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">USD ukupna vrednost</p>
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden border-l-4 ${portfolioProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'} rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${portfolioProfit >= 0 ? 'from-emerald-500/10 to-green-500/10' : 'from-red-500/10 to-rose-500/10'}`} />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Gubitak</CardTitle>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 ${portfolioProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className={`text-2xl font-bold font-mono tabular-nums ${portfolioProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {employeeLoading ? '\u2014' : `${portfolioProfit >= 0 ? '+' : ''}${formatAmount(portfolioProfit)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">USD ukupan profit</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="relative overflow-hidden border-l-4 border-l-amber-500 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Zaposleni</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 text-amber-500">
                <Users className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold font-mono tabular-nums">
                {adminStats.loading ? '\u2014' : `${animatedActive} / ${animatedEmployees}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">aktivnih / ukupno</p>
            </CardContent>
          </Card>
        )}

        {!isAdmin && (
          <Card className="relative overflow-hidden border-l-4 border-l-amber-500 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Porez</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 text-amber-500">
                <Landmark className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold font-mono tabular-nums">
                {employeeLoading ? '\u2014' : formatAmount(paidTax)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">RSD placen ove godine</p>
            </CardContent>
          </Card>
        )}

        <Card className="relative overflow-hidden border-l-4 border-l-rose-500 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-pink-500/10" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nalozi</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 text-rose-500">
              <ClipboardList className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-center gap-3">
              {pendingOrders > 0 && <Badge variant="warning" className="text-xs">{pendingOrders} na cekanju</Badge>}
              {approvedOrders > 0 && <Badge variant="info" className="text-xs">{approvedOrders} aktivn{approvedOrders === 1 ? '' : 'a'}</Badge>}
              {doneOrders > 0 && <Badge variant="success" className="text-xs">{doneOrders} zavrsen{doneOrders === 1 ? '' : 'a'}</Badge>}
              {recentOrders.length === 0 && <span className="text-sm text-muted-foreground">Nema naloga</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two columns: Quick Actions + Recent Orders */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Quick Actions */}
        <section className="lg:col-span-3">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Brze akcije
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {getQuickCards(isAdmin, isSupervisor, isAgent).map(card => (
              <Card
                key={card.path}
                className="group cursor-pointer rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 border-0 bg-muted/20 hover:bg-background"
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
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Recent Orders */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-indigo-500" />
              Poslednji nalozi
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/orders/my')}>
              Svi <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          {employeeLoading ? (
            <Card className="rounded-2xl">
              <CardContent className="py-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full animate-pulse bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : recentOrders.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="flex flex-col items-center text-center py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                  <ClipboardList className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-semibold">Nema nedavnih naloga</p>
                <p className="text-sm text-muted-foreground mt-1">Kreirajte nalog na stranici Berza.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate('/securities')}
                >
                  <TrendingUp className="mr-2 h-4 w-4" /> Idi na berzu
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {recentOrders.map((order, idx) => {
                const isBuy = order.direction === 'BUY';
                return (
                  <Card
                    key={order.id}
                    className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                    style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
                    onClick={() => navigate('/orders/my')}
                  >
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${isBuy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {isBuy ? 'Kupovina' : 'Prodaja'} {order.listingTicker}
                        </p>
                        <p className="text-xs text-muted-foreground">{order.quantity} x {formatAmount(order.pricePerUnit)}</p>
                      </div>
                      <Badge
                        variant={
                          order.status === 'PENDING' ? 'warning' :
                          order.status === 'APPROVED' ? 'info' :
                          order.status === 'DONE' ? 'success' : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {order.status === 'PENDING' ? 'Ceka' :
                         order.status === 'APPROVED' ? 'Aktivan' :
                         order.status === 'DONE' ? 'Zavrsen' : 'Odbijen'}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
