//
// Ova stranica je dostupna samo zaposlenima.
// Prikazuje sve kredite u bankarskom sistemu sa filterima.
// - creditService.getAll(filters) sa paginacijom
// - Filteri: po tipu kredita, statusu
// - Tabela: klijent, tip, iznos, mesecna rata, preostali dug, status
// - Klik za detalje (rate, kamatna stopa, itd.)
// - Spec: "Svi krediti" iz Celine 2 (employee section)

import { useEffect, useState } from 'react';
import {
  FileText,
  Inbox,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { creditService } from '@/services/creditService';
import type { Loan, LoanStatus, LoanType } from '@/types/celina2';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function statusBadgeVariant(status: LoanStatus): 'success' | 'warning' | 'info' | 'destructive' | 'secondary' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'APPROVED') return 'info';
  if (status === 'REJECTED') return 'destructive';
  if (status === 'LATE') return 'destructive';
  if (status === 'PAID' || status === 'PAID_OFF') return 'secondary';
  return 'secondary';
}

function statusLabel(status: LoanStatus): string {
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
  return Number.isFinite(num)
    ? num.toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : (0).toFixed(decimals);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Svi krediti</h1>
          <p className="text-sm text-muted-foreground">
            Pregled svih kredita u bankarskom sistemu sa filterima.
          </p>
        </div>
      </div>

      {/* Filters */}
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
            <Select
              value={loanType}
              onValueChange={(val) => setLoanType(val as LoanType | 'ALL')}
            >
              <SelectTrigger id="loan-type-filter">
                <SelectValue placeholder="Svi tipovi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi</SelectItem>
                <SelectItem value="GOTOVINSKI">Gotovinski</SelectItem>
                <SelectItem value="STAMBENI">Stambeni</SelectItem>
                <SelectItem value="AUTO">Auto</SelectItem>
                <SelectItem value="STUDENTSKI">Studentski</SelectItem>
                <SelectItem value="REFINANSIRAJUCI">Refinansirajuci</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="loan-status-filter">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as LoanStatus | 'ALL')}
            >
              <SelectTrigger id="loan-status-filter">
                <SelectValue placeholder="Svi statusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi</SelectItem>
                <SelectItem value="ACTIVE">Aktivni</SelectItem>
                <SelectItem value="PENDING">Na cekanju</SelectItem>
                <SelectItem value="APPROVED">Odobreni</SelectItem>
                <SelectItem value="REJECTED">Odbijeni</SelectItem>
                <SelectItem value="PAID">Otplaceni</SelectItem>
                <SelectItem value="PAID_OFF">Prevremeno otplaceni</SelectItem>
                <SelectItem value="LATE">Kasnjenje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Mesecna rata</TableHead>
                <TableHead>Preostali dug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Akcija</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-12 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell className="text-center"><div className="mx-auto h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : asArray<Loan>(loans).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Nema kredita za izabrane filtere</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pokusajte sa drugacijim filterima.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Mesecna rata</TableHead>
                <TableHead>Preostali dug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Akcija</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asArray<Loan>(loans).map((loan) => (
                <TableRow
                  key={loan.id}
                  className="cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => setSelectedLoan(loan)}
                >
                  <TableCell className="font-mono text-sm">
                    {loan.loanNumber || loan.id}
                  </TableCell>
                  <TableCell>{loan.loanType}</TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(loan.amount)} {loan.currency}
                  </TableCell>
                  <TableCell>
                    {formatAmount(loan.monthlyPayment)} {loan.currency}
                  </TableCell>
                  <TableCell>
                    {formatAmount(loan.remainingDebt)} {loan.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(loan.status)}>
                      {statusLabel(loan.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLoan(loan);
                      }}
                    >
                      Detalji
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Strana {page + 1} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loan details panel */}
      {selectedLoan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <FileText className="h-4 w-4 text-indigo-500" />
              <CardTitle>Detalji kredita #{selectedLoan.loanNumber || selectedLoan.id}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedLoan(null)} title="Zatvori">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tip kredita</p>
                <p className="font-medium">{selectedLoan.loanType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={statusBadgeVariant(selectedLoan.status)}>
                  {statusLabel(selectedLoan.status)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Iznos</p>
                <p className="font-medium">{formatAmount(selectedLoan.amount)} {selectedLoan.currency}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nominalna kamata</p>
                <p className="font-medium">{formatAmount(selectedLoan.nominalRate)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Efektivna kamata</p>
                <p className="font-medium">{formatAmount(selectedLoan.effectiveRate)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Mesecna rata</p>
                <p className="font-medium">{formatAmount(selectedLoan.monthlyPayment)} {selectedLoan.currency}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Preostali dug</p>
                <p className="font-medium">{formatAmount(selectedLoan.remainingDebt)} {selectedLoan.currency}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pocetak</p>
                <p className="font-medium">{formatDate(selectedLoan.startDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Kraj</p>
                <p className="font-medium">{formatDate(selectedLoan.endDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
