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
import { FileText, Inbox, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/lib/notify';
import { creditService } from '@/services/creditService';
import type { Installment, Loan } from '@/types/celina2';
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
  if (status === 'LATE') return 'destructive';
  if (status === 'PAID' || status === 'PAID_OFF') return 'secondary';
  return 'secondary';
}

function statusLabel(status: Loan['status']): string {
  if (status === 'ACTIVE') return 'Aktivan';
  if (status === 'PENDING') return 'Na cekanju';
  if (status === 'APPROVED') return 'Odobren';
  if (status === 'REJECTED') return 'Odbijen';
  if (status === 'PAID') return 'Otplacen';
  if (status === 'PAID_OFF') return 'Prevremeno otplacen';
  if (status === 'LATE') return 'Kasnjenje';
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
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [processingEarlyRepayment, setProcessingEarlyRepayment] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await creditService.getMyLoans();
        const sorted = asArray<Loan>(data).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        setLoans(sorted);
      } catch {
        setLoans([]);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
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
        <Button onClick={() => navigate('/loans/apply')} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">Zahtev za kredit</Button>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-2 w-full rounded bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : asArray<Loan>(loans).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Trenutno nema kredita</p>
              <p className="text-sm text-muted-foreground mt-1">Podnesite zahtev za kredit klikom na dugme iznad.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {asArray<Loan>(loans).map((loan) => {
            const isSelected = selectedLoan?.id === loan.id;
            const loanProgress = Math.max(0, Math.min(100, ((loan.amount - loan.remainingDebt) / loan.amount) * 100 || 0));
            return (
              <Card key={loan.id} className="transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5">
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
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Iznos</p>
                      <p className="text-lg font-bold mt-0.5">{formatAmount(loan.amount)} {loan.currency}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Mesecna rata</p>
                      <p className="text-lg font-bold mt-0.5">{formatAmount(loan.monthlyPayment)} {loan.currency}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Preostali dug</p>
                      <p className="text-lg font-bold mt-0.5 text-orange-600 dark:text-orange-400">{formatAmount(loan.remainingDebt)} {loan.currency}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Period</p>
                      <p className="text-lg font-bold mt-0.5">{loan.repaymentPeriod} meseci</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Otplaceno</span>
                      <span className="font-medium">{loanProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={loanProgress} className={`h-2.5 ${loanProgress >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-500'}`} />
                  </div>
                  <Button
                    variant="outline"
                    className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-colors"
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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Detalji kredita #{selectedLoan.loanNumber || selectedLoan.id}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Nominalna stopa</p>
                <p className="text-lg font-bold mt-0.5">{formatAmount(selectedLoan.nominalRate)}%</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Efektivna stopa</p>
                <p className="text-lg font-bold mt-0.5">{formatAmount(selectedLoan.effectiveRate)}%</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pocetak</p>
                <p className="text-lg font-bold mt-0.5">{formatDate(selectedLoan.startDate)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Kraj</p>
                <p className="text-lg font-bold mt-0.5">{formatDate(selectedLoan.endDate)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Napredak otplate</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className={`h-2.5 ${progress >= 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-500'}`} />
            </div>

            {loadingInstallments ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-4 w-10 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : asArray<Installment>(installments).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">Nema dostupnih rata</p>
                <p className="text-sm text-muted-foreground mt-1">Rate ce biti prikazane nakon aktivacije kredita.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
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
                      <TableRow key={installment.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-semibold tabular-nums">{formatAmount(installment.amount)} {installment.currency}</TableCell>
                        <TableCell className="tabular-nums">{formatAmount(installment.principalAmount)} {installment.currency}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{formatAmount(installment.interestAmount)} {installment.currency}</TableCell>
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
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Placeno rata: <span className="font-semibold text-foreground">{paidInstallments}</span> / {asArray<Installment>(installments).length}
              </p>
              {(selectedLoan.status === 'ACTIVE' || selectedLoan.status === 'LATE') && selectedLoan.remainingDebt > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={processingEarlyRepayment}
                  className="hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-colors"
                  onClick={async () => {
                    const confirmed = window.confirm(
                      `Da li ste sigurni da želite prevremenu otplatu kredita?\nPreostali dug: ${formatAmount(selectedLoan.remainingDebt)} ${selectedLoan.currency}`
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
    </div>
  );
}
