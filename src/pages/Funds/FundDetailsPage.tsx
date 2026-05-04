import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  BarChart3,
  DollarSign,
  ShoppingCart,
  UserCog,
  X,
  Loader2,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '@/context/AuthContext';
import investmentFundService from '@/services/investmentFundService';
import { employeeService } from '@/services/employeeService';
import type { InvestmentFundDetail, FundPerformancePoint, ClientFundPosition } from '@/types/celina4';
import type { Employee } from '@/types';
import { formatAmount, formatDate, formatPrice, getErrorMessage, toIsoDateOnly } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import FundInvestDialog from './FundInvestDialog';
import FundWithdrawDialog from './FundWithdrawDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type PerfPeriod = 'month' | 'quarter' | 'year';

function getPerfRange(period: PerfPeriod): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  switch (period) {
    case 'month': from.setMonth(from.getMonth() - 1); break;
    case 'quarter': from.setMonth(from.getMonth() - 3); break;
    case 'year': from.setFullYear(from.getFullYear() - 1); break;
  }
  return { from: toIsoDateOnly(from), to: toIsoDateOnly(to) };
}

const PERIOD_LABELS: Record<PerfPeriod, string> = {
  month: '1M',
  quarter: '3M',
  year: '1G',
};

export default function FundDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isSupervisor } = useAuth();

  const [fund, setFund] = useState<InvestmentFundDetail | null>(null);
  const [performance, setPerformance] = useState<FundPerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  // P1.2 — admin dialog za reassign manager.
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [supervisors, setSupervisors] = useState<Employee[]>([]);
  const [supervisorsLoading, setSupervisorsLoading] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('quarter');
  // Spec Celina 4 (Nova) §4585-4628: Uplata/Povlacenje akcije po fondu.
  const [myPosition, setMyPosition] = useState<ClientFundPosition | null>(null);
  const [bankPosition, setBankPosition] = useState<ClientFundPosition | null>(null);
  const [investMode, setInvestMode] = useState<null | 'self' | 'bank'>(null);
  const [withdrawMode, setWithdrawMode] = useState<null | 'self' | 'bank'>(null);

  const reloadPositions = async (fundId: number) => {
    try {
      if (user?.role === 'CLIENT') {
        const positions = await investmentFundService.myPositions();
        const found = positions.find((p) => p.fundId === fundId) ?? null;
        setMyPosition(found);
      }
      if (isSupervisor) {
        const bankPositions = await investmentFundService.bankPositions();
        const found = bankPositions.find((p) => p.fundId === fundId) ?? null;
        setBankPosition(found);
      }
    } catch {
      // tihi fail — pozicije nisu kriticne za stranicu, samo onemogucuju Povuci dugme
    }
  };

  useEffect(() => {
    if (!fund?.id) return;
    void reloadPositions(fund.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fund?.id, user?.role, isSupervisor]);

  const isOwner = isSupervisor && fund?.managerEmployeeId === user?.id;

  // P1.2 — admin reassign-manager dialog. Otvaranje fetcha listu supervizora,
  // FE-strana filter (BE nema namenski endpoint za permission filtriranje).
  const openReassignDialog = async () => {
    setReassignDialogOpen(true);
    setSelectedSupervisorId('');
    if (supervisors.length > 0) return; // vec ucitano
    setSupervisorsLoading(true);
    try {
      const response = await employeeService.getAll({ page: 0, limit: 200 });
      const sup = (response.content ?? []).filter(
        (e) => e.isActive && Array.isArray(e.permissions) && e.permissions.includes('SUPERVISOR'),
      );
      setSupervisors(sup);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Greska pri ucitavanju supervizora'));
    } finally {
      setSupervisorsLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!fund || !selectedSupervisorId) return;
    const newId = Number(selectedSupervisorId);
    if (!Number.isFinite(newId) || newId <= 0) return;
    if (newId === fund.managerEmployeeId) {
      toast.info('Izabrali ste trenutnog menadzera fonda.');
      return;
    }
    setReassigning(true);
    try {
      const updated = await investmentFundService.reassignManager(fund.id, newId);
      setFund(updated);
      toast.success(`Menadzer fonda promenjen na ${updated.managerName}.`);
      setReassignDialogOpen(false);
    } catch (err) {
      const httpErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = httpErr?.response?.status;
      if (status === 400) {
        toast.error(httpErr.response?.data?.message ?? 'Izabrani zaposleni nije supervizor.');
      } else if (status === 404) {
        toast.error('Fond ili zaposleni nije pronadjen.');
      } else if (status === 403) {
        toast.error('Nemate dozvolu za promenu menadzera.');
      } else {
        toast.error(getErrorMessage(err, 'Promena menadzera nije uspela.'));
      }
    } finally {
      setReassigning(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const fundId = Number(id);
    let cancelled = false;

    const range = getPerfRange(perfPeriod);

    Promise.all([
      investmentFundService.get(fundId),
      investmentFundService.getPerformance(fundId, range.from, range.to),
    ])
      .then(([fundData, perfData]) => {
        if (cancelled) return;
        setFund(fundData);
        setPerformance(perfData);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(getErrorMessage(err, 'Greška pri učitavanju fonda'));
        navigate('/funds');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, perfPeriod, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-48 animate-pulse rounded-lg bg-muted/50" />
      </div>
    );
  }

  if (!fund) return null;

  const profitPositive = fund.profit >= 0;
  const chartColor = profitPositive ? '#10B981' : '#EF4444';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/funds')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{fund.name}</h1>
          <p className="text-sm text-muted-foreground">{fund.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Menadžer: {fund.managerName} · Osnovan: {formatDate(fund.inceptionDate)}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openReassignDialog()}
            data-testid="fund-reassign-manager-btn"
          >
            <UserCog className="mr-2 h-4 w-4" />
            Promeni menadzera
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vrednost fonda</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatAmount(fund.fundValue)} RSD
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Likvidnost</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatAmount(fund.liquidAmount)} RSD
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Račun: {fund.accountNumber}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
            {profitPositive
              ? <TrendingUp className="h-4 w-4 text-emerald-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono tabular-nums ${profitPositive ? 'text-emerald-500' : 'text-red-500'}`}>
              {formatAmount(fund.profit)} RSD
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Minimalni ulog</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatAmount(fund.minimumContribution)} RSD
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Hartije u fondu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fund.holdings.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
              <p>Fond trenutno nema hartija</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-right">Promena</TableHead>
                  <TableHead className="text-right">Količina</TableHead>
                  <TableHead className="text-right">IMC</TableHead>
                  <TableHead>Datum kupovine</TableHead>
                  {isOwner && <TableHead className="text-right">Akcija</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fund.holdings.map(h => (
                  <TableRow key={h.listingId}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{h.ticker}</span>
                        <span className="block text-xs text-muted-foreground">{h.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatPrice(h.currentPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono tabular-nums ${h.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {h.change >= 0 ? '+' : ''}{h.change.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {h.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatPrice(h.initialMarginCost)}
                    </TableCell>
                    <TableCell>{formatDate(h.acquisitionDate)}</TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders/new?listingId=${h.listingId}&direction=SELL&fundId=${fund.id}`);
                          }}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Prodaj
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performanse fonda
            </CardTitle>
            <div className="flex gap-1">
              {(Object.keys(PERIOD_LABELS) as PerfPeriod[]).map(p => (
                <Button
                  key={p}
                  variant={perfPeriod === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPerfPeriod(p)}
                >
                  {PERIOD_LABELS[p]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {performance.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
              <p>Nema podataka o performansama za izabrani period</p>
            </div>
          ) : (
            <div className="bg-muted/20 dark:bg-slate-900/40 rounded-xl p-3">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFundValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(d: string) =>
                      new Date(d).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(v: number) => formatPrice(v)}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: unknown) => [formatPrice(Number(value)) + ' RSD', 'Vrednost']}
                    labelFormatter={(label: unknown) =>
                      new Date(String(label)).toLocaleDateString('sr-RS', {
                        weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
                      })
                    }
                    cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fundValue"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#colorFundValue)"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons — Spec Celina 4 (Nova) §4585-4628 */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          {user?.role === 'CLIENT' && (
            <>
              <Button onClick={() => setInvestMode('self')}>
                Uplati u fond
              </Button>
              <Button
                variant="outline"
                disabled={!myPosition || (myPosition.totalInvested ?? 0) <= 0}
                onClick={() => setWithdrawMode('self')}
              >
                Povuci iz fonda
              </Button>
            </>
          )}
          {isSupervisor && (
            <>
              <Button variant="secondary" onClick={() => setInvestMode('bank')}>
                Uplati u ime banke
              </Button>
              <Button
                variant="outline"
                disabled={!bankPosition || (bankPosition.totalInvested ?? 0) <= 0}
                onClick={() => setWithdrawMode('bank')}
              >
                Povuci u ime banke
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {investMode !== null && fund && (
        <FundInvestDialog
          open
          fundId={fund.id}
          fundName={fund.name}
          minimumContribution={fund.minimumContribution ?? 0}
          onClose={() => setInvestMode(null)}
          onSuccess={() => {
            setInvestMode(null);
            void reloadPositions(fund.id);
            toast.success('Uplata uspesno izvrsena.');
          }}
        />
      )}

      {withdrawMode !== null && fund && (withdrawMode === 'self' ? myPosition : bankPosition) && (
        <FundWithdrawDialog
          open
          fundId={fund.id}
          fundName={fund.name}
          myPosition={(withdrawMode === 'self' ? myPosition : bankPosition) as ClientFundPosition}
          onClose={() => setWithdrawMode(null)}
          onSuccess={() => {
            setWithdrawMode(null);
            void reloadPositions(fund.id);
            toast.success('Zahtev za povlacenje uspesno poslat.');
          }}
        />
      )}

      {/*
        P1.2 — Admin reassign-manager dialog (spec Celina 4 §324).
        BE endpoint: POST /funds/{id}/reassign-manager. BE odbacije sa 400 ako
        izabrani zaposleni nema SUPERVISOR permisiju, sa 404 ako fond/employee
        ne postoji, sa 403 ako pozivac nije admin.
      */}
      <Dialog.Root
        open={reassignDialogOpen}
        onOpenChange={(open) => {
          if (!reassigning) setReassignDialogOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                  <UserCog className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-semibold">Promeni menadzera fonda</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    Trenutni menadzer: {fund.managerName}
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={reassigning}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label="Zatvori"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="reassign-supervisor">Novi menadzer (samo supervizori)</Label>
                {supervisorsLoading ? (
                  <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Ucitavam supervizore...
                  </div>
                ) : (
                  <select
                    id="reassign-supervisor"
                    title="Novi menadzer fonda"
                    aria-label="Izaberi novog menadzera fonda"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    data-testid="fund-reassign-supervisor-select"
                  >
                    <option value="">Izaberi supervizora</option>
                    {supervisors.map((sup) => (
                      <option key={sup.id} value={String(sup.id)}>
                        {sup.firstName} {sup.lastName} · {sup.email}
                        {sup.id === fund.managerEmployeeId ? ' (trenutni)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!supervisorsLoading && supervisors.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nema aktivnih supervizora u sistemu.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setReassignDialogOpen(false)}
                  disabled={reassigning}
                >
                  Otkazi
                </Button>
                <Button
                  onClick={() => void handleReassign()}
                  disabled={reassigning || !selectedSupervisorId}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                >
                  {reassigning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Postavljam...
                    </>
                  ) : (
                    'Potvrdi'
                  )}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
