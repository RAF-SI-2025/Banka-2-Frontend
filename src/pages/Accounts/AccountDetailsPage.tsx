// FE2-03a: Detaljan prikaz licnog racuna (tekuci/devizni)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  ArrowLeftRight,
  History,
  Inbox,
  Send,
  Settings2,
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
import { ResponsiveContainer, LineChart, Line } from 'recharts';

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

const currencySymbols: Record<string, string> = {
  RSD: 'RSD', EUR: '\u20ac', USD: '$', CHF: 'CHF', GBP: '\u00a3', JPY: '\u00a5', CAD: 'C$', AUD: 'A$',
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

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const txDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (txDay.getTime() === today.getTime()) return 'Danas';
  if (txDay.getTime() === yesterday.getTime()) return 'Juce';
  return date.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long' });
}

/** Generate fake 7-day sparkline data */
function generateSparkline(endValue: number): number[] {
  const pts: number[] = [];
  let v = endValue * (0.88 + Math.random() * 0.08);
  for (let i = 0; i < 7; i++) {
    v += (endValue - v) * 0.25 + (Math.random() - 0.45) * endValue * 0.03;
    pts.push(Math.round(v));
  }
  pts[6] = Math.round(endValue);
  return pts;
}

// ────────────────────────────────────────────────────────────────────
// Circular Progress Ring
// ────────────────────────────────────────────────────────────────────
function LimitRing({ spent, limit, currency, label, size = 100 }: { spent: number; limit: number; currency: string; label: string; size?: number }) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';
  const remaining = Math.max(0, limit - spent);

  return (
    <div className="flex flex-col items-center gap-3 flex-1 min-w-[160px]">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono tabular-nums">{Math.round(pct)}%</span>
          <span className="text-[10px] text-muted-foreground">iskorisceno</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
          {formatBalance(spent, '')} / {formatBalance(limit, currency)}
        </p>
        <p className="text-xs mt-0.5" style={{ color }}>
          Preostalo: {formatBalance(remaining, currency)}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Mini Sparkline
// ────────────────────────────────────────────────────────────────────
function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v }));
  const isUp = data.length >= 2 && data[data.length - 1] >= data[0];
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={isUp ? '#10b981' : '#ef4444'}
            strokeWidth={2}
            dot={false}
            strokeOpacity={0.7}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
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
  const [showLimits, setShowLimits] = useState(false);
  const [showRename, setShowRename] = useState(false);

  // Stable sparkline data
  const sparklineRef = useRef<number[] | null>(null);

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
        const rawAny = raw as unknown as Record<string, unknown>;
        const accountData = {
          ...raw,
          currency: raw.currency || (rawAny.currencyCode as string) || 'RSD',
          availableBalance: Number(raw.availableBalance) || 0,
          balance: Number(raw.balance) || 0,
          reservedBalance: Number(raw.reservedBalance) || Number(rawAny.reservedFunds) || 0,
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

        if (!sparklineRef.current) {
          sparklineRef.current = generateSparkline(accountData.balance);
        }

        const transactionsResponse = await transactionService.getAll({
          accountNumber: accountData.accountNumber,
          page: 0,
          limit: 10,
        });
        const rawTx = Array.isArray(transactionsResponse.content) ? transactionsResponse.content : [];
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
      setShowRename(false);
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
      setShowLimits(false);
    } catch {
      toast.error('Promena limita nije uspela.');
    } finally {
      setIsSavingLimits(false);
    }
  };

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();

    transactions.forEach(tx => {
      const key = formatDateGroup(tx.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    });

    map.forEach((items, label) => {
      groups.push({ label, items });
    });

    return groups;
  }, [transactions]);

  if (loading) {
    return (
      <div className="space-y-6 py-6 animate-fade-up">
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-48 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-violet-500/20 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
          <div className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
        </div>
        <div className="h-64 rounded-2xl bg-muted/50 animate-pulse" />
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

  const sym = currencySymbols[account.currency] || account.currency;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Nazad na racune
      </Button>

      {/* Hero header - full width gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 sm:p-10 text-white shadow-2xl shadow-indigo-500/25">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/3 right-1/4 h-24 w-24 rounded-full bg-purple-400/10 blur-xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant={statusVariant[account.status]} className="border-white/20 text-xs">
                {statusLabels[account.status] || account.status}
              </Badge>
              <Badge variant="info" className="border-white/20 text-xs">
                {accountTypeLabels[account.accountType] || account.accountType}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
              {account.name || 'Detalji racuna'}
            </h1>
            <p className="text-indigo-200 font-mono text-sm mb-5">{formatAccountNumber(account.accountNumber)}</p>

            <div className="flex items-end gap-4">
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wider mb-1">Stanje</p>
                <p className="text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight">
                  {formatBalance(account.balance, '')}
                  <span className="text-xl font-semibold text-indigo-200 ml-2">{sym}</span>
                </p>
              </div>
              {sparklineRef.current && (
                <div className="mb-2">
                  <MiniSparkline data={sparklineRef.current} />
                </div>
              )}
            </div>

            <p className="mt-2 text-sm text-indigo-200">
              Raspolozivo: <span className="font-mono tabular-nums font-semibold text-white">{formatBalance(account.availableBalance, account.currency)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Limit usage - horizontal circular rings */}
      {(account.dailyLimit > 0 || account.monthlyLimit > 0) && (
        <Card className="rounded-2xl">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
              {account.dailyLimit > 0 && (
                <LimitRing
                  spent={account.dailySpending}
                  limit={account.dailyLimit}
                  currency={account.currency}
                  label="Dnevna potrosnja"
                  size={110}
                />
              )}
              {account.dailyLimit > 0 && account.monthlyLimit > 0 && (
                <div className="hidden sm:block h-24 w-px bg-border" />
              )}
              {account.monthlyLimit > 0 && (
                <LimitRing
                  spent={account.monthlySpending}
                  limit={account.monthlyLimit}
                  currency={account.currency}
                  label="Mesecna potrosnja"
                  size={110}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions - horizontal row of pill buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all rounded-full px-6"
          onClick={() => navigate(`/payments/new?from=${account.accountNumber}`)}
        >
          <Send className="mr-2 h-4 w-4" /> Novo placanje
        </Button>
        <Button
          variant="outline"
          className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all rounded-full px-6"
          onClick={() => navigate(`/transfers?from=${account.accountNumber}`)}
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer
        </Button>
        <Button
          variant="outline"
          className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all rounded-full px-6"
          onClick={() => setShowLimits(!showLimits)}
        >
          <Settings2 className="mr-2 h-4 w-4" /> Promeni limit
        </Button>
        <Button
          variant="outline"
          className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all rounded-full px-6"
          onClick={() => setShowRename(!showRename)}
        >
          <Pencil className="mr-2 h-4 w-4" /> Preimenuj
        </Button>
        <Button
          variant="outline"
          className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all rounded-full px-6"
          onClick={() => navigate(`/payments/history?account=${account.accountNumber}`)}
        >
          <History className="mr-2 h-4 w-4" /> Sve transakcije
        </Button>
      </div>

      {/* Rename inline (collapsible) */}
      {showRename && (
        <Card className="rounded-2xl">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Novi naziv racuna"
                className="max-w-sm"
              />
              <Button onClick={saveName} disabled={isSavingName} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 rounded-full">
                {isSavingName ? 'Cuvanje...' : 'Sacuvaj'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowRename(false)}>Otkazi</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change limits inline (collapsible) */}
      {showLimits && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle className="text-base">Promena limita</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="flex gap-2">
              <Button onClick={saveLimits} disabled={isSavingLimits} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 rounded-full">
                {isSavingLimits ? 'Cuvanje...' : 'Sacuvaj limite'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowLimits(false)}>Otkazi</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance details - horizontal cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Ukupno stanje', value: formatBalance(account.balance, account.currency), main: true },
          { label: 'Raspolozivo', value: formatBalance(account.availableBalance, account.currency), main: true },
          { label: 'Rezervisano', value: formatBalance(account.reservedBalance, account.currency), main: false },
          { label: 'Odrzavanje', value: formatBalance(account.maintenanceFee, account.currency), main: false },
        ].map(item => (
          <Card key={item.label} className="rounded-2xl">
            <CardContent className="py-4 px-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`font-mono tabular-nums mt-1 ${item.main ? 'text-xl font-bold' : 'text-lg font-semibold text-muted-foreground'}`}>
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent transactions - grouped by date, card-style */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
          <h2 className="text-lg font-semibold">Poslednje transakcije</h2>
        </div>

        {transactions.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-muted-foreground">Nema transakcija za ovaj racun</p>
              <p className="text-sm text-muted-foreground mt-1">Transakcije ce se pojaviti nakon prve uplate ili placanja.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedTransactions.map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{group.label}</p>
                <div className="space-y-2.5">
                  {group.items.map((tx, idx) => {
                    const isOutgoing = tx.fromAccountNumber === account.accountNumber;
                    const initial = (tx.recipientName || tx.paymentPurpose || 'T').charAt(0).toUpperCase();
                    return (
                      <Card
                        key={tx.id}
                        className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300"
                        style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
                      >
                        <CardContent className="flex items-center gap-4 py-4 px-5">
                          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-base font-bold ${
                            isOutgoing ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{tx.recipientName || '\u2014'}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {tx.paymentPurpose || (isOutgoing ? formatAccountNumber(tx.toAccountNumber) : formatAccountNumber(tx.fromAccountNumber))}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-base font-bold font-mono tabular-nums ${isOutgoing ? 'text-red-500' : 'text-emerald-500'}`}>
                              {isOutgoing ? '\u2212' : '+'}{formatBalance(tx.amount, tx.currency)}
                            </p>
                            <Badge variant={txStatusVariant[tx.status]} className="text-[10px] px-1.5 mt-1">
                              {txStatusLabels[tx.status] || tx.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
