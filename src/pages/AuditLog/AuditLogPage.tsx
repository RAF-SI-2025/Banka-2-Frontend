// ============================================================
// FE3 — Audit log portal (Developer: Elena Kalajdzic / Jovan)
//
// Supervizor + Admin pregled revizionog dnevnika sa filterima.
// Spec: Zadaci_Frontend.pdf, FE3.
// Ruta: '/audit-log' (App.tsx, ProtectedRoute supervisorOnly).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Filter, RefreshCw, AlertCircle } from 'lucide-react';
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
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { auditService } from '@/services/auditService';
import {
  type AuditActionType,
  type AuditFilterParams,
  type AuditLogDto,
  type AuditPageDto,
  TRADING_AUDIT_ACTION_TYPES,
  AUDIT_ACTION_LABEL_SR,
} from '@/types/audit';

const PAGE_SIZE = 20;

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

const ACTION_BADGE_VARIANT: Partial<Record<AuditActionType, BadgeVariant>> = {
  LIMIT_CHANGED: 'info',
  USED_LIMIT_RESET: 'warning',
  USED_LIMIT_RESET_ALL: 'warning',
  ORDER_APPROVED: 'success',
  ORDER_DECLINED: 'destructive',
  PERMISSIONS_CHANGED: 'secondary',
  TAX_RUN_TRIGGERED: 'default',
  // Krediti
  LOAN_APPROVED: 'success',
  LOAN_REJECTED: 'destructive',
  LOAN_EARLY_REPAYMENT: 'info',
  LOAN_INSTALLMENT_PAID: 'success',
  LOAN_INSTALLMENT_FAILED: 'destructive',
  // Placanja / transferi
  PAYMENT_CREATED: 'info',
  PAYMENT_ABORTED: 'destructive',
  PAYMENT_QUICK_APPROVED: 'success',
  TRANSFER_INTERNAL: 'info',
  TRANSFER_FX: 'info',
  // Stednja
  SAVINGS_OPENED: 'success',
  SAVINGS_WITHDRAWN_EARLY: 'warning',
  SAVINGS_AUTO_RENEWED: 'info',
  // Kartice
  CARD_BLOCKED: 'destructive',
  CARD_UNBLOCKED: 'success',
  CARD_LIMIT_CHANGED: 'info',
  CARD_DEACTIVATED: 'destructive',
  // Racuni / zaposleni
  ACCOUNT_STATUS_CHANGED: 'warning',
  ACCOUNT_LIMITS_CHANGED: 'info',
  EMPLOYEE_DEACTIVATED: 'destructive',
  // Fondovi
  FUND_CREATED: 'success',
  FUND_INVEST: 'success',
  FUND_WITHDRAW: 'warning',
};

const DEFAULT_BADGE_VARIANT: BadgeVariant = 'secondary';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatValue(raw: AuditLogDto['oldValue'] | AuditLogDto['newValue']): string {
  if (raw === null || raw === undefined) return '—';
  return String(raw);
}

function formatMetadata(metadata: AuditLogDto['metadata']): string {
  if (metadata === null || metadata === undefined) return '';
  if (typeof metadata === 'string') return metadata;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function truncate(value: string, max = 40): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…';
}

export default function AuditLogPage() {
  // Polja filter forme (string-only zbog HTML input-a)
  const [formActionType, setFormActionType] = useState<string>('');
  const [formActorId, setFormActorId] = useState<string>('');
  const [formActorName, setFormActorName] = useState<string>('');
  const [formDateFrom, setFormDateFrom] = useState<string>('');
  const [formDateTo, setFormDateTo] = useState<string>('');

  // Aktivni filter (samo posle "Filtriraj" — odvojeno od forme tako da
  // korisnik moze da kuca pa da pritisne Filtriraj, ne da svaki keystroke
  // okida BE poziv).
  const [activeFilter, setActiveFilter] = useState<AuditFilterParams>({});
  const [pageNum, setPageNum] = useState(0);

  const [page, setPage] = useState<AuditPageDto<AuditLogDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await auditService.queryAuditLogs({
        ...activeFilter,
        page: pageNum,
        size: PAGE_SIZE,
      });
      setPage(result);
    } catch (e: unknown) {
      // FE-TRD-03 fix: status-code aware error handling — daje korisniku konkretnu informaciju
      // (403 = nemate dozvolu / 404 = endpoint ne postoji / ostalo = generic).
      const err = e as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = err?.response?.status;
      let message: string;
      if (status === 403) {
        message = 'Nemate pristup audit-log zapisima (samo admin/supervizor).';
      } else if (status === 404) {
        message = 'Audit-log endpoint nije pronadjen.';
      } else if (status === 400) {
        // /audit rutira na trading-service; banka-core-only tip akcije nije
        // podrzan i BE vraca 400 "Unknown actionType". Dropdown vec filtrira
        // na dostizne tipove, ali ovo je defense-in-depth jasna poruka.
        message = 'Izabrani tip akcije nije podrzan za ovaj revizioni izvor.';
      } else {
        message =
          err?.response?.data?.message ??
          err?.message ??
          'Ucitavanje audit-log zapisa nije uspelo.';
      }
      setError(message);
      setPage(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, pageNum]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  function applyFilters() {
    const next: AuditFilterParams = {};
    if (formActionType !== '') next.actionType = formActionType as AuditActionType;
    const trimmedId = formActorId.trim();
    if (trimmedId !== '') {
      const parsed = Number(trimmedId);
      if (Number.isInteger(parsed) && parsed > 0) {
        next.actorId = parsed;
      } else {
        toast.error('ID aktera mora biti pozitivan ceo broj.');
        return;
      }
    }
    // Sc45: ime aktera (supervizora). Numericki ID ima prednost (BE), ali ime
    // saljemo nezavisno tako da korisnik moze da filtrira i samo po imenu.
    const trimmedName = formActorName.trim();
    if (trimmedName !== '') next.actorName = trimmedName;
    if (formDateFrom !== '') next.dateFrom = formDateFrom;
    if (formDateTo !== '') next.dateTo = formDateTo;
    setPageNum(0);
    setActiveFilter(next);
  }

  function resetFilters() {
    setFormActionType('');
    setFormActorId('');
    setFormActorName('');
    setFormDateFrom('');
    setFormDateTo('');
    setPageNum(0);
    setActiveFilter({});
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <PageHeader
        icon={<ScrollText className="h-5 w-5" />}
        title="Audit log"
        description="Istorija svih bitnih sistemskih akcija (admin/supervizor)"
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <Label htmlFor="audit-filter-action">Tip akcije</Label>
            <select
              id="audit-filter-action"
              data-testid="audit-filter-action"
              aria-label="Tip akcije"
              title="Tip akcije"
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-10 text-sm"
              value={formActionType}
              onChange={(e) => setFormActionType(e.target.value)}
            >
              <option value="">Sve</option>
              {/* Samo trading-service dostizni tipovi — /audit rutira na
                  trading-service koji bi za banka-core tipove vratio 400. */}
              {TRADING_AUDIT_ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {AUDIT_ACTION_LABEL_SR[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="audit-filter-actor">ID aktera</Label>
            <Input
              id="audit-filter-actor"
              data-testid="audit-filter-actor"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="npr. 42"
              value={formActorId}
              onChange={(e) => setFormActorId(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="audit-filter-actor-name">Ime aktera</Label>
            <Input
              id="audit-filter-actor-name"
              data-testid="audit-filter-actor-name"
              type="text"
              placeholder="npr. Nikola Milenkovic"
              value={formActorName}
              onChange={(e) => setFormActorName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="audit-filter-from">Od datuma</Label>
            <Input
              id="audit-filter-from"
              data-testid="audit-filter-from"
              type="date"
              value={formDateFrom}
              onChange={(e) => setFormDateFrom(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="audit-filter-to">Do datuma</Label>
            <Input
              id="audit-filter-to"
              data-testid="audit-filter-to"
              type="date"
              value={formDateTo}
              onChange={(e) => setFormDateTo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 justify-end">
          <Button
            variant="outline"
            data-testid="audit-filter-reset"
            onClick={resetFilters}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Resetuj filtere
          </Button>
          <Button data-testid="audit-filter-apply" onClick={applyFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Filtriraj
          </Button>
        </div>
      </Card>

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Greska</AlertTitle>
          <AlertDescription data-testid="audit-error">{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-4">
          <div className="space-y-3" data-testid="audit-loading">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="h-10 bg-muted animate-pulse rounded-md"
              />
            ))}
          </div>
        </Card>
      ) : page && page.content.length > 0 ? (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vreme</TableHead>
                  <TableHead>Tip akcije</TableHead>
                  <TableHead>Akter</TableHead>
                  <TableHead>Cilj</TableHead>
                  <TableHead>Pre</TableHead>
                  <TableHead>Posle</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.content.map((entry) => {
                  const oldVal = formatValue(entry.oldValue);
                  const newVal = formatValue(entry.newValue);
                  const meta = formatMetadata(entry.metadata);
                  return (
                    <TableRow
                      key={entry.id}
                      data-testid={`audit-row-${entry.id}`}
                    >
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ACTION_BADGE_VARIANT[entry.actionType] ?? DEFAULT_BADGE_VARIANT}
                          data-testid={`audit-action-badge-${entry.id}`}
                        >
                          {AUDIT_ACTION_LABEL_SR[entry.actionType] ?? entry.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {entry.actorName ?? `#${entry.actorId}`}
                        </div>
                        {entry.actorEmail && (
                          <div className="text-xs text-muted-foreground">
                            {entry.actorEmail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.targetType ? (
                          <>
                            <span className="font-medium">{entry.targetType}</span>
                            {entry.targetId !== null && entry.targetId !== undefined && (
                              <span className="text-muted-foreground">
                                {' #'}
                                {entry.targetId}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground"
                        title={oldVal}
                      >
                        {truncate(oldVal)}
                      </TableCell>
                      <TableCell className="text-xs" title={newVal}>
                        {truncate(newVal)}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground"
                        title={meta}
                      >
                        {meta ? truncate(meta) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground" data-testid="audit-page-info">
              Strana {page.number + 1} od {Math.max(page.totalPages, 1)} (
              {page.totalElements} ukupno)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="audit-page-prev"
                disabled={page.number === 0}
                onClick={() => setPageNum(page.number - 1)}
              >
                Prethodna
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="audit-page-next"
                disabled={page.number >= page.totalPages - 1}
                onClick={() => setPageNum(page.number + 1)}
              >
                Sledeca
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Card className="p-12 text-center text-muted-foreground" data-testid="audit-empty">
          <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nema audit zapisa za zadate filtere.</p>
          <p className="text-sm mt-1">
            Pokusaj sa drugim parametrima ili resetuj filtere.
          </p>
        </Card>
      )}
    </div>
  );
}
