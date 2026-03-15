//
// Ova stranica je dostupna samo zaposlenima.
// Prikazuje sve kredite u bankarskom sistemu sa filterima.
// - creditService.getAll(filters) sa paginacijom
// - Filteri: po tipu kredita, statusu
// - Tabela: klijent, tip, iznos, mesecna rata, preostali dug, status
// - Klik za detalje (rate, kamatna stopa, itd.)
// - Spec: "Svi krediti" iz Celine 2 (employee section)

import { useEffect, useState } from 'react';
import { FileText, Inbox } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { creditService } from '@/services/creditService';
import type { Loan, LoanStatus, LoanType } from '@/types/celina2';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusClass(status: LoanStatus): string {
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

export default function AllLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanType, setLoanType] = useState<LoanType | 'ALL'>('ALL');
  const [status, setStatus] = useState<LoanStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await creditService.getAll({
          page,
          limit: 10,
          loanType: loanType === 'ALL' ? undefined : loanType,
          status: status === 'ALL' ? undefined : status,
        });
        setLoans(asArray<Loan>(response.content));
        setTotalPages(Math.max(1, response.totalPages));
      } catch {
        toast.error('Neuspesno ucitavanje kredita.');
        setLoans([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loanType, page, status]);

  useEffect(() => {
    setPage(0);
  }, [loanType, status]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Svi krediti</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Pregled svih kredita u bankarskom sistemu sa filterima.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Filteri</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="loan-type-filter">
              Tip kredita
            </label>
            <select
              id="loan-type-filter"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as LoanType | 'ALL')}
            >
              <option value="ALL">Svi</option>
              <option value="GOTOVINSKI">Gotovinski</option>
              <option value="STAMBENI">Stambeni</option>
              <option value="AUTO">Auto</option>
              <option value="STUDENTSKI">Studentski</option>
              <option value="REFINANSIRAJUCI">Refinansirajuci</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="loan-status-filter">
              Status
            </label>
            <select
              id="loan-status-filter"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as LoanStatus | 'ALL')}
            >
              <option value="ALL">Svi</option>
              <option value="ACTIVE">Aktivni</option>
              <option value="PENDING">Na cekanju</option>
              <option value="APPROVED">Odobreni</option>
              <option value="REJECTED">Odbijeni</option>
              <option value="CLOSED">Zatvoreni</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : asArray<Loan>(loans).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Nema kredita za izabrane filtere</p>
              <p className="text-sm text-muted-foreground mt-1">Pokusajte sa drugacijim filterima.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Tip</th>
                  <th className="text-left py-2">Iznos</th>
                  <th className="text-left py-2">Mesecna rata</th>
                  <th className="text-left py-2">Preostali dug</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {asArray<Loan>(loans).map((loan) => (
                  <tr key={loan.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-2">{loan.loanNumber || loan.id}</td>
                    <td className="py-2">{loan.loanType}</td>
                    <td className="py-2">{formatAmount(loan.amount)} {loan.currency}</td>
                    <td className="py-2">{formatAmount(loan.monthlyPayment)} {loan.currency}</td>
                    <td className="py-2">{formatAmount(loan.remainingDebt)} {loan.currency}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLoan(loan)}>
                        Detalji
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Prethodna
              </Button>
              <span className="text-sm text-muted-foreground">
                Strana {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Sledeca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedLoan && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Detalji kredita #{selectedLoan.loanNumber || selectedLoan.id}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Tip: <span className="font-medium">{selectedLoan.loanType}</span></p>
            <p>Nominalna kamata: <span className="font-medium">{formatAmount(selectedLoan.nominalRate)}%</span></p>
            <p>Efektivna kamata: <span className="font-medium">{formatAmount(selectedLoan.effectiveRate)}%</span></p>
            <p>Pocetak: <span className="font-medium">{formatDate(selectedLoan.startDate)}</span></p>
            <p>Kraj: <span className="font-medium">{formatDate(selectedLoan.endDate)}</span></p>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedLoan(null)}>
                Zatvori detalje
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
