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
import { FileText, Inbox } from 'lucide-react';
import { toast } from '@/lib/notify';
import { creditService } from '@/services/creditService';
import type { Installment, Loan } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusStyles(status: Loan['status']): string {
  if (status === 'ACTIVE') return 'bg-green-100 text-green-700';
  if (status === 'PENDING') return 'bg-yellow-100 text-yellow-700';
  if (status === 'APPROVED') return 'bg-blue-100 text-blue-700';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await creditService.getMyLoans();
        setLoans(asArray<Loan>(data));
      } catch {
        toast.error('Neuspesno ucitavanje kredita.');
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
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Moji krediti</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Pregled svih vasih kredita i detalja otplate.</p>
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
            return (
              <Card key={loan.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                      <CardTitle className="text-lg">{loan.loanType} kredit</CardTitle>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles(loan.status)}`}>
                      {loan.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <p>
                      Iznos: <span className="font-medium">{formatAmount(loan.amount)} {loan.currency}</span>
                    </p>
                    <p>
                      Mesecna rata: <span className="font-medium">{formatAmount(loan.monthlyPayment)} {loan.currency}</span>
                    </p>
                    <p>
                      Preostali dug: <span className="font-medium">{formatAmount(loan.remainingDebt)} {loan.currency}</span>
                    </p>
                    <p>
                      Period: <span className="font-medium">{loan.repaymentPeriod} meseci</span>
                    </p>
                  </div>
                  <progress
                    className="w-full h-2"
                    max={100}
                    value={Math.max(0, Math.min(100, ((loan.amount - loan.remainingDebt) / loan.amount) * 100 || 0))}
                  />
                  <Button variant="outline" onClick={() => setSelectedLoan(isSelected ? null : loan)}>
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
            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <p>Nominalna kamatna stopa: <span className="font-medium">{formatAmount(selectedLoan.nominalRate)}%</span></p>
              <p>Efektivna kamatna stopa: <span className="font-medium">{formatAmount(selectedLoan.effectiveRate)}%</span></p>
              <p>Pocetak: <span className="font-medium">{formatDate(selectedLoan.startDate)}</span></p>
              <p>Kraj: <span className="font-medium">{formatDate(selectedLoan.endDate)}</span></p>
            </div>

            <progress className="w-full h-2" max={100} value={progress} />

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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Rata</th>
                      <th className="text-left py-2">Iznos</th>
                      <th className="text-left py-2">Datum dospeca</th>
                      <th className="text-left py-2">Placeno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asArray<Installment>(installments).map((installment, index) => (
                      <tr key={installment.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2">{index + 1}</td>
                        <td className="py-2">{formatAmount(installment.amount)} {installment.currency}</td>
                        <td className="py-2">{formatDate(installment.expectedDueDate)}</td>
                        <td className="py-2">{installment.paid ? 'Da' : 'Ne'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Placeno rata: {paidInstallments} / {asArray<Installment>(installments).length}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
