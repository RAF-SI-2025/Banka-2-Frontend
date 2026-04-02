//
// Ova stranica je dostupna samo zaposlenima.
// Prikazuje sve zahteve za kredit sa statusom PENDING.
// - creditService.getRequests({ status: 'PENDING' }) za fetch (vraca LoanRequest[])
// - Tabela sa zahtevima: klijent, tip kredita, tip kamate, iznos, svrha, period, datum
// - Akcije: odobri (approve) ili odbij (reject sa razlogom)
// - Filter: po statusu (Pending/Approved/Rejected/All)
// - Spec: "Zahtevi za kredit" iz Celine 2 (employee section)

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Inbox, ChevronDown, ChevronUp, Loader2, Clock, CheckCircle2, XCircle, Banknote, User, Briefcase, Phone, FileText, CalendarDays } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  if (status === 'LATE') return 'destructive';
  if (status === 'ACTIVE') return 'info';
  if (status === 'PAID' || status === 'PAID_OFF') return 'secondary';
  return 'secondary';
}

function statusLabel(status: LoanStatus): string {
  if (status === 'PENDING') return 'Na cekanju';
  if (status === 'APPROVED') return 'Odobren';
  if (status === 'REJECTED') return 'Odbijen';
  if (status === 'ACTIVE') return 'Aktivan';
  if (status === 'PAID') return 'Otplacen';
  if (status === 'PAID_OFF') return 'Prevremeno otplacen';
  if (status === 'LATE') return 'Kasnjenje';
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

function statusBorderColor(status: LoanStatus): string {
  if (status === 'PENDING') return 'border-l-amber-500';
  if (status === 'APPROVED') return 'border-l-emerald-500';
  if (status === 'REJECTED') return 'border-l-red-500';
  if (status === 'ACTIVE') return 'border-l-indigo-500';
  return 'border-l-muted';
}

function statusBgTint(status: LoanStatus): string {
  if (status === 'PENDING') return 'hover:bg-amber-500/[0.03]';
  if (status === 'APPROVED') return 'hover:bg-emerald-500/[0.03]';
  if (status === 'REJECTED') return 'hover:bg-red-500/[0.03]';
  return 'hover:bg-muted/30';
}

export default function LoanRequestsPage() {
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
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

  const filterTabs: { value: StatusFilter; label: string; count: number; icon: typeof Clock; color: string }[] = [
    { value: 'ALL', label: 'Svi', count: counts.all, icon: FileText, color: 'text-muted-foreground' },
    { value: 'PENDING', label: 'Na cekanju', count: counts.pending, icon: Clock, color: 'text-amber-500' },
    { value: 'APPROVED', label: 'Odobreni', count: counts.approved, icon: CheckCircle2, color: 'text-emerald-500' },
    { value: 'REJECTED', label: 'Odbijeni', count: counts.rejected, icon: XCircle, color: 'text-red-500' },
  ];

  const safeRequests = asArray<LoanRequest>(loanRequests);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zahtevi za kredit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pregledajte i obradite zahteve za kredit klijenata
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-card border hover:bg-muted/50 hover:shadow-sm'
                }
              `}
            >
              <tab.icon className={`h-4 w-4 ${isActive ? 'text-white' : tab.color}`} />
              {tab.label}
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-bold
                ${isActive ? 'bg-white/20' : 'bg-muted'}
              `}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : safeRequests.length === 0 ? (
        <Card className="rounded-2xl">
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
        <div className="space-y-3">
          {safeRequests.map((request, index) => {
            const isPending = request.status === 'PENDING';
            const isExpanded = expandedId === request.id;
            const isRejecting = rejectingLoanId === request.id;

            return (
              <div
                key={request.id}
                className={`rounded-2xl border border-l-4 ${statusBorderColor(request.status)} ${statusBgTint(request.status)} bg-card overflow-hidden transition-all duration-300 hover:shadow-md`}
                style={{ animation: `fadeUp 0.4s ease-out ${index * 0.05}s both` }}
              >
                {/* Main row */}
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar-like icon */}
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{request.clientName || request.clientEmail || '-'}</h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{request.loanType}</span>
                          <span>|</span>
                          <span>{formatAmount(request.amount)} {request.currency}</span>
                          <span>|</span>
                          <span>{request.repaymentPeriod} mes.</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={statusBadgeVariant(request.status)} className="text-xs">
                        {statusLabel(request.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(request.createdAt)}</span>

                      <div className="flex items-center gap-1.5">
                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleApprove(request.id); }}
                              disabled={processingId === request.id}
                              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all rounded-lg h-8 px-3"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 px-3 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-600 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectingLoanId(request.id);
                                setRejectReason('');
                                setExpandedId(request.id);
                              }}
                              disabled={processingId === request.id}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg h-8 px-2"
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable details */}
                {isExpanded && (
                  <div className="border-t bg-muted/10 px-5 py-4" style={{ animation: 'fadeUp 0.2s ease-out' }}>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 flex-shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Svrha</p>
                          <p className="text-sm font-medium">{request.loanPurpose || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 flex-shrink-0">
                          <Banknote className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Racun</p>
                          <p className="text-sm font-medium font-mono">{request.accountNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Telefon</p>
                          <p className="text-sm font-medium">{request.phoneNumber || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 flex-shrink-0">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Status zaposlenja</p>
                          <p className="text-sm font-medium">{request.employmentStatus || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 flex-shrink-0">
                          <Banknote className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Mesecni prihod</p>
                          <p className="text-sm font-medium">{request.monthlyIncome ? formatAmount(request.monthlyIncome) : '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 flex-shrink-0">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Stalno zaposlen</p>
                          <p className="text-sm font-medium">{request.permanentEmployment ? 'Da' : 'Ne'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Reject form */}
                    {isRejecting && (
                      <div className="mt-5 p-4 rounded-xl border bg-red-500/[0.03] border-red-500/20 max-w-xl" style={{ animation: 'fadeUp 0.2s ease-out' }}>
                        <Label htmlFor={`reject-reason-${request.id}`} className="text-sm font-semibold text-red-600 dark:text-red-400">Razlog odbijanja</Label>
                        <Input
                          id={`reject-reason-${request.id}`}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Unesite razlog..."
                          className="mt-2 rounded-lg border-red-500/20 focus:border-red-500/50"
                        />
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-lg"
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
                            className="rounded-lg"
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
