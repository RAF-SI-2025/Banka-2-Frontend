//
// Ova stranica je dostupna samo zaposlenima.
// Prikazuje sve zahteve za kredit sa statusom PENDING.
// - creditService.getRequests({ status: 'PENDING' }) za fetch (vraca LoanRequest[])
// - Tabela sa zahtevima: klijent, tip kredita, tip kamate, iznos, svrha, period, datum
// - Akcije: odobri (approve) ili odbij (reject sa razlogom)
// - Filter: po statusu (Pending/Approved/Rejected/All)
// - Spec: "Zahtevi za kredit" iz Celine 2 (employee section)

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Inbox } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { creditService } from '@/services/creditService';
import type { LoanRequest, LoanStatus } from '@/types/celina2';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

type StatusFilter = LoanStatus | 'ALL';

function statusBadgeClass(status: LoanStatus): string {
  if (status === 'PENDING') return 'bg-yellow-100 text-yellow-700';
  if (status === 'APPROVED') return 'bg-green-100 text-green-700';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700';
  if (status === 'ACTIVE') return 'bg-blue-100 text-blue-700';
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
      await creditService.reject(loanId, rejectReason.trim());
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Zahtevi za kredit</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Pregledajte i obradite zahteve za kredit klijenata.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Filter po statusu</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant={statusFilter === 'ALL' ? 'default' : 'outline'} onClick={() => setStatusFilter('ALL')}>
            Svi ({counts.all})
          </Button>
          <Button variant={statusFilter === 'PENDING' ? 'default' : 'outline'} onClick={() => setStatusFilter('PENDING')}>
            Na cekanju ({counts.pending})
          </Button>
          <Button variant={statusFilter === 'APPROVED' ? 'default' : 'outline'} onClick={() => setStatusFilter('APPROVED')}>
            Odobreni ({counts.approved})
          </Button>
          <Button variant={statusFilter === 'REJECTED' ? 'default' : 'outline'} onClick={() => setStatusFilter('REJECTED')}>
            Odbijeni ({counts.rejected})
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : asArray<LoanRequest>(loanRequests).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Nema zahteva za izabrani filter</p>
              <p className="text-sm text-muted-foreground mt-1">Pokusajte sa drugim statusom filtera.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Klijent</th>
                  <th className="text-left py-2">Tip</th>
                  <th className="text-left py-2">Kamata</th>
                  <th className="text-left py-2">Iznos</th>
                  <th className="text-left py-2">Period</th>
                  <th className="text-left py-2">Datum</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {asArray<LoanRequest>(loanRequests).map((request) => {
                  const isPending = request.status === 'PENDING';
                  const isExpanded = expandedId === request.id;
                  const isRejecting = rejectingLoanId === request.id;

                  return (
                    <>
                      <tr key={request.id} className="border-b align-top hover:bg-muted/50 transition-colors">
                        <td className="py-2">{request.clientName || request.clientEmail || '-'}</td>
                        <td className="py-2">{request.loanType}</td>
                        <td className="py-2">{request.interestRateType}</td>
                        <td className="py-2">{formatAmount(request.amount)} {request.currency}</td>
                        <td className="py-2">{request.repaymentPeriod} mes.</td>
                        <td className="py-2">{formatDate(request.createdAt)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : request.id)}
                            >
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
                                  Odobri
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setRejectingLoanId(request.id);
                                    setRejectReason('');
                                  }}
                                  disabled={processingId === request.id}
                                >
                                  Odbij
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-muted/30">
                          <td className="py-3 px-2" colSpan={8}>
                            <div className="grid gap-2 md:grid-cols-2 text-sm">
                              <p>Svrha: <span className="font-medium">{request.loanPurpose}</span></p>
                              <p>Racun: <span className="font-medium">{request.accountNumber}</span></p>
                              <p>Telefon: <span className="font-medium">{request.phoneNumber}</span></p>
                              <p>Status zaposlenja: <span className="font-medium">{request.employmentStatus || '-'}</span></p>
                              <p>Mesecni prihod: <span className="font-medium">{request.monthlyIncome ?? '-'}</span></p>
                              <p>Stalno zaposlen: <span className="font-medium">{request.permanentEmployment ? 'Da' : 'Ne'}</span></p>
                            </div>

                            {isRejecting && (
                              <div className="mt-4 space-y-2 max-w-xl">
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
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
