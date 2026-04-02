//
// Ova stranica prikazuje kredite ulogovanog korisnika.
// - creditService.getMyLoans() za fetch
// - Lista: tip kredita, iznos, mesecna rata, preostali dug, status
// - Klik na kredit => expand/modal sa detaljima i ratama
// - creditService.getInstallments(loanId) za rate
// - Link na LoanApplicationPage za novi zahtev
// - Spec: "Krediti" iz Celine 2

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Inbox,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Banknote,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { creditService } from '@/services/creditService';
import type { Installment, Loan, LoanRequest } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusBadgeVariant(status: Loan['status']): 'success' | 'warning' | 'info' | 'destructive' | 'secondary' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'APPROVED') return 'info';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

const statusRowBorder: Record<string, string> = {
  ACTIVE: 'border-l-emerald-500',
  PENDING: 'border-l-amber-500',
  APPROVED: 'border-l-blue-500',
  REJECTED: 'border-l-red-500',
  LATE: 'border-l-red-500',
  PAID: 'border-l-gray-400',
  PAID_OFF: 'border-l-gray-400',
  CLOSED: 'border-l-gray-300',
};

function statusLabel(status: Loan['status']): string {
  if (status === 'ACTIVE') return 'Aktivan';
  if (status === 'PENDING') return 'Na cekanju';
  if (status === 'APPROVED') return 'Odobren';
  if (status === 'REJECTED') return 'Odbijen';
  if (status === 'CLOSED') return 'Zatvoren';
  return status;
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS');
}

export default function LoanListPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [processingEarlyRepayment, setProcessingEarlyRepayment] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [loansData, requestsData] = await Promise.all([
          creditService.getMyLoans(),
          creditService.getMyRequests().catch(() => []),
        ]);
        const sorted = asArray<Loan>(loansData).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        setLoans(sorted);
        setPendingRequests(asArray<LoanRequest>(requestsData).filter(r => r.status === 'PENDING' || r.status === 'REJECTED'));
      } catch {
        setLoans([]);
        setPendingRequests([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!selectedLoan) {
      setInstallments([]);
      return;
    }

    const loadInstallments = async () => {
      setLoadingInstallments(true);
      try {
        const data = await creditService.getInstallments(selectedLoan.id);
        setInstallments(asArray<Installment>(data));
      } catch {
        toast.error('Neuspesno ucitavanje rata.');
        setInstallments([]);
      } finally {
        setLoadingInstallments(false);
      }
    };

    loadInstallments();
  }, [selectedLoan]);

  const paidInstallments = useMemo(
    () => asArray<Installment>(installments).filter((installment) => installment.paid).length,
    [installments]
  );

  const progress = useMemo(() => {
    if (!selectedLoan || selectedLoan.amount <= 0) return 0;
    const paidPart = selectedLoan.amount - selectedLoan.remainingDebt;
    return Math.max(0, Math.min(100, (paidPart / selectedLoan.amount) * 100));
  }, [selectedLoan]);

  // Stats
  const stats = useMemo(() => {
    const total = loans.length;
    const active = loans.filter(l => l.status === 'ACTIVE').length;
    const pending = pendingRequests.length;
    const totalAmount = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
    return { total, active, pending, totalAmount };
  }, [loans, pendingRequests]);

  const statCards = [
    { label: 'Ukupno kredita', value: stats.total, icon: FileText, iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400', gradient: 'from-indigo-500 to-violet-600' },
    { label: 'Aktivni', value: stats.active, icon: CheckCircle2, iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-green-600' },
    { label: 'Zahtevi', value: stats.pending, icon: Clock, iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500 to-orange-600' },
    { label: 'Ukupan iznos', value: null, displayValue: `${formatAmount(stats.totalAmount)} RSD`, icon: TrendingUp, iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-indigo-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Moji krediti</h1>
            <p className="text-sm text-muted-foreground">Pregled svih vasih kredita i detalja otplate.</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/loans/apply')}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200 rounded-xl"
        >
          <Banknote className="mr-2 h-4 w-4" />
          Zahtev za kredit
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
                    {stat.value !== null ? stat.value : stat.displayValue}
                  </p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${stat.gradient} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-indigo-500/20 to-violet-600/20" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="rounded-xl border p-3">
                      <div className="h-3 w-20 rounded bg-muted animate-pulse mb-2" />
                      <div className="h-5 w-28 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <>

      {/* Zahtevi na cekanju */}
      {pendingRequests.length > 0 && (
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-amber-500 to-orange-600" />
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Zahtevi za kredit</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className={`rounded-xl border border-l-4 p-4 transition-all duration-200 hover:shadow-md ${req.status === 'REJECTED' ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/10' : 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{req.loanType} kredit</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Iznos: <span className="font-mono tabular-nums font-medium text-foreground">{formatAmount(req.amount)}</span> {req.currency} · Period: <span className="font-mono tabular-nums">{req.repaymentPeriod}</span> meseci
                    </p>
                  </div>
                  <Badge variant={req.status === 'REJECTED' ? 'destructive' : 'warning'}>
                    {req.status === 'REJECTED' ? 'Odbijen' : 'Na čekanju'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {asArray<Loan>(loans).length === 0 && pendingRequests.length === 0 ? (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Trenutno nema kredita</h3>
              <p className="mt-1 text-sm text-muted-foreground">Podnesite zahtev za kredit klikom na dugme iznad.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {asArray<Loan>(loans).map((loan) => {
            const isSelected = selectedLoan?.id === loan.id;
            const loanProgress = Math.max(0, Math.min(100, ((loan.amount - loan.remainingDebt) / loan.amount) * 100 || 0));
            return (
              <Card key={loan.id} className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 border-l-4 ${statusRowBorder[loan.status] || 'border-l-transparent'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                      <CardTitle className="text-lg">{loan.loanType} kredit</CardTitle>
                    </div>
                    <Badge variant={statusBadgeVariant(loan.status)}>
                      {statusLabel(loan.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Iznos</p>
                      <p className="text-lg font-bold font-mono tabular-nums mt-0.5">{formatAmount(loan.amount)} {loan.currency}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mesecna rata</p>
                      <p className="text-lg font-bold font-mono tabular-nums mt-0.5">{formatAmount(loan.monthlyPayment)} {loan.currency}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preostali dug</p>
                      <p className="text-lg font-bold font-mono tabular-nums mt-0.5 text-orange-600 dark:text-orange-400">{formatAmount(loan.remainingDebt)} {loan.currency}</p>
                    </div>
                    <div className="rounded-xl border p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</p>
                      <p className="text-lg font-bold font-mono tabular-nums mt-0.5">{loan.repaymentPeriod} meseci</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Otplaceno</span>
                      <span className="font-medium font-mono tabular-nums">{loanProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={loanProgress} className={`h-2.5 ${loanProgress >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-500'}`} />
                  </div>
                  <Button
                    variant="outline"
                    className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-200"
                    onClick={() => setSelectedLoan(isSelected ? null : loan)}
                  >
                    {isSelected ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                    {isSelected ? 'Sakrij detalje' : 'Prikazi detalje'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {selectedLoan && (
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <FileText className="h-4 w-4 text-indigo-500" />
              <CardTitle>Detalji kredita #{selectedLoan.loanNumber || selectedLoan.id}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Nominalna stopa', value: `${formatAmount(selectedLoan.nominalRate)}%`, mono: true },
                { label: 'Efektivna stopa', value: `${formatAmount(selectedLoan.effectiveRate)}%`, mono: true },
                { label: 'Pocetak', value: formatDate(selectedLoan.startDate) },
                { label: 'Kraj', value: formatDate(selectedLoan.endDate) },
                {
                  label: 'Ukupna kamata',
                  value: `${formatAmount(installments.reduce((sum, inst) => sum + (inst.interestAmount ?? 0), 0))} ${selectedLoan.currency}`,
                  mono: true,
                  highlight: true,
                },
                {
                  label: 'Ukupno za otplatu',
                  value: `${formatAmount((selectedLoan.amount ?? 0) + installments.reduce((sum, inst) => sum + (inst.interestAmount ?? 0), 0))} ${selectedLoan.currency}`,
                  mono: true,
                },
              ].map((item) => (
                <div key={item.label} className={`space-y-1.5 rounded-xl p-3 ${item.highlight ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/30 border'}`}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className={`text-lg font-bold ${item.mono ? 'font-mono tabular-nums' : ''} ${item.highlight ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Napredak otplate</span>
                <span className="font-medium font-mono tabular-nums">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className={`h-2.5 ${progress >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-500'}`} />
            </div>

            {loadingInstallments ? (
              <Card className="rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rata</TableHead>
                      <TableHead>Iznos</TableHead>
                      <TableHead>Glavnica</TableHead>
                      <TableHead>Kamata</TableHead>
                      <TableHead>Datum dospeca</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 w-8 rounded bg-muted animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                        <TableCell><div className="h-4 w-16 rounded-full bg-muted animate-pulse" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : asArray<Installment>(installments).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Inbox className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-base font-semibold">Nema dostupnih rata</h3>
                <p className="mt-1 text-sm text-muted-foreground">Rate ce biti prikazane nakon aktivacije kredita.</p>
              </div>
            ) : (
              <Card className="overflow-hidden rounded-xl shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rata</TableHead>
                      <TableHead>Iznos</TableHead>
                      <TableHead>Glavnica</TableHead>
                      <TableHead>Kamata</TableHead>
                      <TableHead>Datum dospeca</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asArray<Installment>(installments).map((installment, index) => (
                      <TableRow key={installment.id} className={`hover:bg-muted/50 transition-all duration-200 border-l-4 ${installment.paid ? 'border-l-emerald-500' : 'border-l-gray-300 dark:border-l-gray-600'} hover:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.1)]`}>
                        <TableCell className="font-mono text-sm font-medium tabular-nums">{index + 1}</TableCell>
                        <TableCell className="font-mono font-semibold tabular-nums">{formatAmount(installment.amount)} {installment.currency}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatAmount(installment.principalAmount ?? 0)}</TableCell>
                        <TableCell className="font-mono tabular-nums text-amber-600 dark:text-amber-400">{formatAmount(installment.interestAmount ?? 0)}</TableCell>
                        <TableCell>{formatDate(installment.expectedDueDate)}</TableCell>
                        <TableCell>
                          <Badge variant={installment.paid ? 'success' : 'secondary'}>
                            {installment.paid ? 'Placeno' : 'Neplaceno'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <p className="text-sm text-muted-foreground">
                Placeno rata: <span className="font-semibold font-mono tabular-nums text-foreground">{paidInstallments}</span> / <span className="font-mono tabular-nums">{asArray<Installment>(installments).length}</span>
              </p>
              {selectedLoan.status === 'ACTIVE' && selectedLoan.remainingDebt > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={processingEarlyRepayment}
                  className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-200"
                  onClick={async () => {
                    const unpaidInterest = asArray<Installment>(installments)
                      .filter(i => !i.paid)
                      .reduce((sum, i) => sum + (i.interestAmount ?? 0), 0);
                    const totalPayoff = (selectedLoan.remainingDebt ?? 0) + unpaidInterest;

                    const confirmed = window.confirm(
                      `Prevremena otplata kredita\n\n` +
                      `Preostala glavnica: ${formatAmount(selectedLoan.remainingDebt)} ${selectedLoan.currency}\n` +
                      `Preostala kamata: ${formatAmount(unpaidInterest)} ${selectedLoan.currency}\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `UKUPNO za otplatu: ${formatAmount(totalPayoff)} ${selectedLoan.currency}\n\n` +
                      `Da li želite da nastavite?`
                    );
                    if (!confirmed) return;
                    setProcessingEarlyRepayment(true);
                    try {
                      await creditService.earlyRepayment(selectedLoan.id);
                      toast.success('Zahtev za prevremenu otplatu je uspešno podnet.');
                      const data = await creditService.getMyLoans();
                      setLoans(asArray<Loan>(data).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)));
                      setSelectedLoan(null);
                    } catch {
                      toast.error('Prevremena otplata nije uspela.');
                    } finally {
                      setProcessingEarlyRepayment(false);
                    }
                  }}
                >
                  {processingEarlyRepayment ? 'Obrada...' : 'Prevremena otplata'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </>}
    </div>
  );
}
