//
// Ova stranica je dostupna samo zaposlenima.
// Prikazuje sve zahteve za kredit sa statusom PENDING.
// - creditService.getRequests({ status: 'PENDING' }) za fetch (vraca LoanRequest[])
// - Tabela sa zahtevima: klijent, tip kredita, tip kamate, iznos, svrha, period, datum
// - Akcije: odobri (approve) ili odbij (reject sa razlogom)
// - Filter: po statusu (Pending/Approved/Rejected/All)
// - Spec: "Zahtevi za kredit" iz Celine 2 (employee section)

import { useEffect, useMemo, useState, Fragment } from 'react';
import { ShieldCheck, Inbox, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { creditService } from '@/services/creditService';
import type { LoanRequest, LoanStatus } from '@/types/celina2';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

type StatusFilter = LoanStatus | 'ALL';

function statusBadgeVariant(status: LoanStatus): 'warning' | 'success' | 'destructive' | 'info' | 'secondary' {
  if (status === 'PENDING') return 'warning';
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'destructive';
  if (status === 'ACTIVE') return 'info';
  return 'secondary';
}

function statusLabel(status: LoanStatus): string {
  if (status === 'PENDING') return 'Na cekanju';
  if (status === 'APPROVED') return 'Odobren';
  if (status === 'REJECTED') return 'Odbijen';
  if (status === 'ACTIVE') return 'Aktivan';
  return status;
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : (0).toFixed(decimals);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS');
}

export default function LoanRequestsPage() {
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectingLoanId, setRejectingLoanId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await creditService.getRequests(
        statusFilter === 'ALL' ? undefined : { status: statusFilter }
      );
      setLoanRequests(asArray<LoanRequest>(response.content));
    } catch {
      toast.error('Neuspesno ucitavanje zahteva za kredit.');
      setLoanRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = useMemo(() => {
    const safeRequests = asArray<LoanRequest>(loanRequests);
    const all = safeRequests.length;
    const pending = safeRequests.filter((r) => r.status === 'PENDING').length;
    const approved = safeRequests.filter((r) => r.status === 'APPROVED').length;
    const rejected = safeRequests.filter((r) => r.status === 'REJECTED').length;
    return { all, pending, approved, rejected };
  }, [loanRequests]);

  const handleApprove = async (loanId: number) => {
    setProcessingId(loanId);
    try {
      await creditService.approve(loanId);
      toast.success('Zahtev je odobren.');
      await loadRequests();
    } catch {
      toast.error('Odobravanje zahteva nije uspelo.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (loanId: number) => {
    if (!rejectReason.trim()) {
      toast.error('Unesite razlog odbijanja.');
      return;
    }

    setProcessingId(loanId);
    try {
      await creditService.reject(loanId);
      toast.success('Zahtev je odbijen.');
      setRejectingLoanId(null);
      setRejectReason('');
      await loadRequests();
    } catch {
      toast.error('Odbijanje zahteva nije uspelo.');
    } finally {
      setProcessingId(null);
    }
  };

  const filterButtons: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'Svi', count: counts.all },
    { value: 'PENDING', label: 'Na cekanju', count: counts.pending },
    { value: 'APPROVED', label: 'Odobreni', count: counts.approved },
    { value: 'REJECTED', label: 'Odbijeni', count: counts.rejected },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Zahtevi za kredit</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pregledajte i obradite zahteve za kredit klijenata.
        </p>
      </div>

      {/* Status filter tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Filter po statusu</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.value}
              variant={statusFilter === btn.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(btn.value)}
              className={
                statusFilter === btn.value
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                  : ''
              }
            >
              {btn.label}
              <Badge variant="secondary" className="ml-2 bg-background/20 text-current">
                {btn.count}
              </Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klijent</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Kamata</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell className="text-right"><div className="ml-auto h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : asArray<LoanRequest>(loanRequests).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Nema zahteva za izabrani filter</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pokusajte sa drugim statusom filtera.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klijent</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Kamata</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asArray<LoanRequest>(loanRequests).map((request) => {
                const isPending = request.status === 'PENDING';
                const isExpanded = expandedId === request.id;
                const isRejecting = rejectingLoanId === request.id;

                return (
                  <Fragment key={request.id}>
                    <TableRow className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        {request.clientName || request.clientEmail || '-'}
                      </TableCell>
                      <TableCell>{request.loanType}</TableCell>
                      <TableCell>{request.interestRateType}</TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(request.amount)} {request.currency}
                      </TableCell>
                      <TableCell>{request.repaymentPeriod} mes.</TableCell>
                      <TableCell>{formatDate(request.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(request.status)}>
                          {statusLabel(request.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedId(isExpanded ? null : request.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="mr-1 h-4 w-4" />
                            ) : (
                              <ChevronDown className="mr-1 h-4 w-4" />
                            )}
                            {isExpanded ? 'Sakrij' : 'Detalji'}
                          </Button>
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request.id)}
                                disabled={processingId === request.id}
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : null}
                                Odobri
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setRejectingLoanId(request.id);
                                  setRejectReason('');
                                  setExpandedId(request.id);
                                }}
                                disabled={processingId === request.id}
                              >
                                Odbij
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/40">
                        <TableCell colSpan={8} className="px-6 py-4">
                          <div className="grid gap-3 md:grid-cols-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Svrha:</span>{' '}
                              <span className="font-medium">{request.loanPurpose}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Racun:</span>{' '}
                              <span className="font-medium font-mono">{request.accountNumber}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Telefon:</span>{' '}
                              <span className="font-medium">{request.phoneNumber}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status zaposlenja:</span>{' '}
                              <span className="font-medium">{request.employmentStatus || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Mesecni prihod:</span>{' '}
                              <span className="font-medium">{request.monthlyIncome ?? '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Stalno zaposlen:</span>{' '}
                              <span className="font-medium">{request.permanentEmployment ? 'Da' : 'Ne'}</span>
                            </div>
                          </div>

                          {isRejecting && (
                            <div className="mt-4 space-y-3 max-w-xl rounded-lg border bg-background p-4">
                              <Label htmlFor={`reject-reason-${request.id}`}>Razlog odbijanja</Label>
                              <Input
                                id={`reject-reason-${request.id}`}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Unesite razlog..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleReject(request.id)}
                                  disabled={processingId === request.id}
                                >
                                  {processingId === request.id && (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                  )}
                                  Potvrdi odbijanje
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setRejectingLoanId(null);
                                    setRejectReason('');
                                  }}
                                >
                                  Otkazi
                                </Button>
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
