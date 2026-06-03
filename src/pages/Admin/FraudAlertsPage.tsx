// ============================================================
// W3-T3 — Fraud alerts page (Spark anomaly detection dashboard)
//
// Admin/supervizor pregled fraud alert-ova izracunatih Spark MLlib
// modelom. Filteri za min_risk threshold + since datum, color-coded
// risk badge-ovi, expandable features JSON, review dialog (POST
// /admin/fraud-alerts/{id}/review).
//
// Spec: 2026-05-26-k8s-readiness-deploy-plan.md, Task W3-T3.
// Ruta: '/admin/fraud-alerts' (App.tsx, ProtectedRoute adminOnly).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getFraudAlerts,
  reviewFraudAlert,
  type FraudAlertDTO,
} from '@/services/fraudAlertService';
import { addDaysISO } from '@/utils/formatters';

const REVIEW_STATUSES = [
  { value: 'APPROVED', label: 'Odobreno (legit)' },
  { value: 'REJECTED', label: 'Odbijeno (false positive)' },
  { value: 'ESCALATED', label: 'Eskalirano (manualna istraga)' },
  { value: 'IN_REVIEW', label: 'U pregledu' },
] as const;

type RiskTier = 'high' | 'medium' | 'low';

function riskTier(score: number): RiskTier {
  if (score > 0.95) return 'high';
  if (score > 0.85) return 'medium';
  return 'low';
}

function riskBadgeClass(tier: RiskTier): string {
  switch (tier) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40';
    case 'medium':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40';
    case 'low':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/40';
  }
}

function reviewStatusVariant(status?: string):
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'info' {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'destructive';
    case 'ESCALATED':
      return 'warning';
    case 'IN_REVIEW':
      return 'info';
    default:
      return 'secondary';
  }
}

// [P1-i18n-1 / 1887] lokalni date-builder umesto UTC `toISOString().slice` —
// pre ponoci po UTC bi "7 dana unazad" promasilo za jos jedan dan u Beogradu.
function sevenDaysAgoIso(): string {
  return addDaysISO(-7);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function FraudAlertsPage() {
  const [since, setSince] = useState<string>(sevenDaysAgoIso());
  const [minRisk, setMinRisk] = useState<number>(0.8);
  const [alerts, setAlerts] = useState<FraudAlertDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Review dialog state
  const [reviewing, setReviewing] = useState<FraudAlertDTO | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('APPROVED');
  const [reviewNote, setReviewNote] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFraudAlerts(since, minRisk);
      setAlerts(result);
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = err?.response?.status;
      let message: string;
      if (status === 403) {
        message = 'Nemate pristup fraud alert-ovima (samo admin/supervizor).';
      } else if (status === 404) {
        message = 'Fraud-alerts endpoint nije pronadjen.';
      } else {
        message =
          err?.response?.data?.message ??
          err?.message ??
          'Ucitavanje fraud alert-ova nije uspelo.';
      }
      setError(message);
      setAlerts(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [since, minRisk]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  function toggleExpand(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openReview(alert: FraudAlertDTO) {
    setReviewing(alert);
    setReviewStatus(alert.reviewStatus ?? 'APPROVED');
    setReviewNote('');
  }

  function closeReview() {
    setReviewing(null);
    setReviewStatus('APPROVED');
    setReviewNote('');
  }

  async function submitReview() {
    if (!reviewing) return;
    setSubmittingReview(true);
    try {
      await reviewFraudAlert(reviewing.id, reviewStatus, reviewNote || undefined);
      toast.success(`Alert #${reviewing.id} pregledan (${reviewStatus}).`);
      closeReview();
      await fetchAlerts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        err?.response?.data?.message ??
          err?.message ??
          'Slanje review nije uspelo.',
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Fraud alerts"
        description="Anomalije detektovane Spark modelom (risk score, features, model verzija)"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
            data-testid="fraud-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Osvezi
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Label htmlFor="fraud-since">Od datuma</Label>
            <Input
              id="fraud-since"
              data-testid="fraud-since"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="fraud-min-risk-slider">
              Min. risk score:{' '}
              <span className="font-mono font-bold" data-testid="fraud-min-risk-value">
                {minRisk.toFixed(2)}
              </span>
            </Label>
            <input
              id="fraud-min-risk-slider"
              data-testid="fraud-min-risk-slider"
              type="range"
              min="0.8"
              max="1.0"
              step="0.01"
              value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="w-full mt-2 accent-indigo-500"
              aria-label="Minimum risk score"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0.80</span>
              <span>0.90</span>
              <span>1.00</span>
            </div>
          </div>
        </div>
      </Card>

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Greska</AlertTitle>
          <AlertDescription data-testid="fraud-error">{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-4">
          <div className="space-y-3" data-testid="fraud-loading">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </Card>
      ) : alerts && alerts.length > 0 ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Tx ID</TableHead>
                <TableHead>Risk score</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Izracunato</TableHead>
                <TableHead>Status pregleda</TableHead>
                <TableHead className="text-right">Akcija</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const tier = riskTier(alert.riskScore);
                const expanded = expandedRows.has(alert.id);
                const isReviewed = !!alert.reviewStatus;
                return (
                  <>
                    <TableRow key={alert.id} data-testid={`fraud-row-${alert.id}`}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleExpand(alert.id)}
                          data-testid={`fraud-features-toggle-${alert.id}`}
                          aria-label={expanded ? 'Sakrij features' : 'Prikazi features'}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          {expanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">#{alert.transactionId}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          data-testid={`fraud-risk-badge-${alert.id}`}
                          data-risk-tier={tier}
                          className={`font-mono ${riskBadgeClass(tier)}`}
                        >
                          {alert.riskScore.toFixed(3)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {alert.modelVersion}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {formatDateTime(alert.computedAt)}
                      </TableCell>
                      <TableCell>
                        {isReviewed ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant={reviewStatusVariant(alert.reviewStatus)}
                              data-testid={`fraud-review-status-${alert.id}`}
                            >
                              {alert.reviewStatus}
                            </Badge>
                            {alert.reviewedBy && (
                              <div className="text-[10px] text-muted-foreground">
                                {alert.reviewedBy}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Nepregledan</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={isReviewed ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => openReview(alert)}
                          data-testid={`fraud-review-btn-${alert.id}`}
                        >
                          {isReviewed ? 'Izmeni' : 'Pregledaj'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow
                        key={`${alert.id}-features`}
                        data-testid={`fraud-features-row-${alert.id}`}
                      >
                        <TableCell colSpan={7} className="bg-muted/30 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Features
                            </p>
                            <pre
                              className="text-xs bg-background border rounded-md p-3 font-mono overflow-x-auto"
                              data-testid={`fraud-features-detail-${alert.id}`}
                            >
                              {JSON.stringify(alert.features, null, 2)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card
          className="p-12 text-center text-muted-foreground"
          data-testid="fraud-empty"
        >
          <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nema alerts iznad praga.</p>
          <p className="text-sm mt-1">Pokusaj sa nizim minimum risk score-om.</p>
        </Card>
      )}

      {/* Review dialog */}
      <Dialog.Root open={!!reviewing} onOpenChange={(open) => !open && closeReview()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-2xl shadow-2xl p-0 w-full max-w-md overflow-hidden"
            data-testid="fraud-review-dialog"
          >
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-bold">
                      Pregled fraud alert-a
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-white/80 mt-0.5">
                      {reviewing && `Tx #${reviewing.transactionId} · Risk ${reviewing.riskScore.toFixed(3)}`}
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                    aria-label="Zatvori"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <Label htmlFor="fraud-review-status">Status</Label>
                <select
                  id="fraud-review-status"
                  data-testid="fraud-review-status"
                  aria-label="Status pregleda"
                  title="Status pregleda"
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-10 text-sm"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                >
                  {REVIEW_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="fraud-review-note">Komentar (opciono)</Label>
                <textarea
                  id="fraud-review-note"
                  data-testid="fraud-review-note"
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background text-sm min-h-[80px] resize-none"
                  placeholder="Razlog odluke, dodatne napomene..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    Otkazi
                  </Button>
                </Dialog.Close>
                <Button
                  type="button"
                  disabled={submittingReview}
                  onClick={submitReview}
                  data-testid="fraud-review-submit"
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {submittingReview ? 'Snima se...' : 'Sacuvaj pregled'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
