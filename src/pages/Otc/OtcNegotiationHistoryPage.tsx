import { Fragment, useEffect, useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Search } from 'lucide-react';
import otcService from '@/services/otcService';
import type { OtcNegotiationHistoryDto, OtcNegotiationHistoryPage } from '@/types/otcHistory';
import { formatAmount, formatDate, formatDateTime } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import OtcSubHero from '@/components/otc/OtcSubHero';

// ============================================================
// FE4 (7.3) — Istorija OTC pregovora (Developer: Jovan Krunic)
// Admin/supervizor portal: paginiran pregled svih zapisa OTC pregovora
// (B10 GET /otc/negotiation-history) sa filterima po statusu, datumu i
// drugoj strani. Expand reda prikazuje ceo lanac kontraponuda jednog
// pregovora (GET /otc/negotiation-history/{negotiationId}).
// Dok B10 nije dostupan (404), prikaz graciozno degradira.
// ============================================================

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'ACCEPTED', 'DECLINED'] as const;

const STATUS_LABEL: Record<string, string> = {
  ALL: 'Svi statusi',
  ACTIVE: 'Aktivan',
  ACCEPTED: 'Prihvaćen',
  DECLINED: 'Odbijen',
};

/** Badge varijanta po statusu pregovora. */
function statusVariant(status: string): 'warning' | 'success' | 'secondary' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'warning';
    case 'ACCEPTED':
      return 'success';
    case 'DECLINED':
      return 'secondary';
    default:
      return 'outline';
  }
}

type ChainStatus = 'loading' | 'ready' | 'error';

/** Inline panel sa hronološkim lancem kontraponuda jednog pregovora. */
function NegotiationChain({
  status,
  chain,
}: {
  status: ChainStatus | undefined;
  chain: OtcNegotiationHistoryDto[] | undefined;
}) {
  if (status === undefined || status === 'loading') {
    return (
      <div className="space-y-2 py-2" data-testid="otc-chain-loading">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <p className="py-2 text-sm text-red-500" data-testid="otc-chain-error">
        Greška pri učitavanju lanca kontraponuda.
      </p>
    );
  }
  if (!chain || chain.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground" data-testid="otc-chain-empty">
        Nema zabeleženih kontraponuda za ovaj pregovor.
      </p>
    );
  }
  return (
    <div className="space-y-2 py-2" data-testid="otc-chain-table">
      <p className="text-sm font-medium">Lanac kontraponuda</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Korak</TableHead>
            <TableHead className="text-right">Količina</TableHead>
            <TableHead className="text-right">Cena/akciji</TableHead>
            <TableHead className="text-right">Premija</TableHead>
            <TableHead>Dospeće</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Izmenio</TableHead>
            <TableHead>Kada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chain.map((step, idx) => (
            <TableRow key={step.id}>
              <TableCell className="font-mono">{idx + 1}</TableCell>
              <TableCell className="text-right font-mono">{formatAmount(step.quantity, 0)}</TableCell>
              <TableCell className="text-right font-mono">{formatAmount(step.pricePerShare)}</TableCell>
              <TableCell className="text-right font-mono">{formatAmount(step.premium)}</TableCell>
              <TableCell>{formatDate(step.settlementDate)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(step.status)}>
                  {STATUS_LABEL[step.status] ?? step.status}
                </Badge>
              </TableCell>
              <TableCell>{step.modifiedByName}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(step.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function OtcNegotiationHistoryPage() {
  const [pageData, setPageData] = useState<OtcNegotiationHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'unavailable' | 'error' | null>(null);

  // Filteri — status/datum idu BE-u; "druga strana" se filtrira client-side po imenu
  // (B10 prima samo modifiedById, a u tabeli prikazujemo ime).
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [pageNum, setPageNum] = useState(0);

  // Expand: koji red (entry id) je otvoren + keš lanca po negotiationId.
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [chainCache, setChainCache] = useState<Record<number, OtcNegotiationHistoryDto[]>>({});
  const [chainStatus, setChainStatus] = useState<Record<number, ChainStatus>>({});

  // Dohvatanje istorije — setState samo u async callback-ovima (bez skeleton-a
  // na refetch, ali bez setState-in-effect upozorenja).
  useEffect(() => {
    let cancelled = false;
    void otcService
      .getNegotiationHistory({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        from: fromDate ? `${fromDate}T00:00:00` : undefined,
        to: toDate ? `${toDate}T23:59:59` : undefined,
        page: pageNum,
        size: PAGE_SIZE,
      })
      .then((data) => {
        if (cancelled) return;
        setPageData(data);
        setLoadError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const httpStatus = (err as { response?: { status?: number } })?.response?.status;
        setLoadError(
          httpStatus === 404 || httpStatus === 501 || httpStatus === 405
            ? 'unavailable'
            : 'error',
        );
        setPageData(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, fromDate, toDate, pageNum]);

  // Promena filtera resetuje na prvu stranu.
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPageNum(0);
  };
  const handleFromChange = (value: string) => {
    setFromDate(value);
    setPageNum(0);
  };
  const handleToChange = (value: string) => {
    setToDate(value);
    setPageNum(0);
  };

  const entries = useMemo(() => pageData?.content ?? [], [pageData]);

  // R1 859: BE B10 endpoint nema name-search za drugu stranu (samo numericki
  // `modifiedById`), pa je ovo namerno KLIJENTSKI filter SAMO nad trenutnom
  // (server-paginiranom) stranicom. UI to eksplicitno saopstava (label/hint),
  // da korisnik ne ocekuje pretragu kroz celu istoriju.
  const visibleEntries = useMemo(() => {
    const q = counterpartySearch.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.modifiedByName.toLowerCase().includes(q));
  }, [entries, counterpartySearch]);

  const toggleChain = (entry: OtcNegotiationHistoryDto) => {
    if (expandedEntryId === entry.id) {
      setExpandedEntryId(null);
      return;
    }
    setExpandedEntryId(entry.id);
    const negId = entry.negotiationId;
    if (chainStatus[negId]) return; // već učitano / u toku
    setChainStatus((prev) => ({ ...prev, [negId]: 'loading' }));
    void otcService
      .getNegotiationHistoryById(negId)
      .then((chain) => {
        setChainCache((prev) => ({ ...prev, [negId]: Array.isArray(chain) ? chain : [] }));
        setChainStatus((prev) => ({ ...prev, [negId]: 'ready' }));
      })
      .catch(() => {
        setChainStatus((prev) => ({ ...prev, [negId]: 'error' }));
      });
  };

  const totalPages = pageData?.totalPages ?? 0;
  const totalElements = pageData?.totalElements ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      <OtcSubHero
        icon={Archive}
        title="Istorija OTC pregovora"
        description="Pregled svih OTC pregovora i lanaca kontraponuda — namenjeno administratorima i supervizorima."
        gradientFrom="from-slate-500"
        gradientTo="to-gray-600"
        kpis={[
          { label: 'Ukupno zapisa', value: String(totalElements) },
          { label: 'Strana', value: totalPages > 0 ? `${pageNum + 1}/${totalPages}` : '0/0' },
        ]}
      />

      {/* Filteri */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="otc-hist-status">Status</Label>
              <select
                id="otc-hist-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                data-testid="otc-history-status-filter"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otc-hist-from">Od datuma</Label>
              <Input
                id="otc-hist-from"
                type="date"
                value={fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otc-hist-to">Do datuma</Label>
              <Input
                id="otc-hist-to"
                type="date"
                value={toDate}
                onChange={(e) => handleToChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otc-hist-cp">Druga strana (ova strana)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="otc-hist-cp"
                  className="pl-9"
                  placeholder="Ime korisnika (filtrira trenutnu stranu)..."
                  value={counterpartySearch}
                  onChange={(e) => setCounterpartySearch(e.target.value)}
                  data-testid="otc-history-counterparty-search"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pretraga po imenu filtrira samo zapise na trenutnoj strani. Za uzu pretragu koristi filtere statusa/datuma.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Zapisi pregovora</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" data-testid="otc-history-loading">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : loadError === 'unavailable' ? (
            <p
              className="py-8 text-center text-sm text-muted-foreground"
              data-testid="otc-history-unavailable"
            >
              Istorija OTC pregovora trenutno nije dostupna (B10 endpoint još nije implementiran).
            </p>
          ) : loadError === 'error' ? (
            <p className="py-8 text-center text-sm text-red-500" data-testid="otc-history-error">
              Greška pri učitavanju istorije pregovora. Pokušajte ponovo kasnije.
            </p>
          ) : visibleEntries.length === 0 ? (
            <div
              className="flex flex-col items-center py-12 text-center"
              data-testid="otc-history-empty"
            >
              <Archive className="mb-3 h-10 w-10 text-muted-foreground opacity-30" />
              <p className="font-medium">Nema pregovora</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nijedan zapis ne odgovara izabranim filterima.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Pregovor #</TableHead>
                      <TableHead className="text-right">Količina</TableHead>
                      <TableHead className="text-right">Cena/akciji</TableHead>
                      <TableHead className="text-right">Premija</TableHead>
                      <TableHead>Dospeće</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Izmenio</TableHead>
                      <TableHead>Datum izmene</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEntries.map((entry) => {
                      const isOpen = expandedEntryId === entry.id;
                      return (
                        <Fragment key={entry.id}>
                          <TableRow>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => toggleChain(entry)}
                                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Lanac kontraponuda"
                                aria-expanded={isOpen}
                                data-testid={`otc-history-toggle-${entry.id}`}
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="font-mono">#{entry.negotiationId}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(entry.quantity, 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(entry.pricePerShare)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(entry.premium)}
                            </TableCell>
                            <TableCell>{formatDate(entry.settlementDate)}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(entry.status)}>
                                {STATUS_LABEL[entry.status] ?? entry.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{entry.modifiedByName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDateTime(entry.createdAt)}
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/20">
                                <NegotiationChain
                                  status={chainStatus[entry.negotiationId]}
                                  chain={chainCache[entry.negotiationId]}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginacija */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Strana {totalPages > 0 ? pageNum + 1 : 0} od {totalPages} · ukupno{' '}
                  {totalElements} zapisa
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageNum <= 0}
                    onClick={() => setPageNum((p) => Math.max(0, p - 1))}
                  >
                    Prethodna
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageNum >= totalPages - 1}
                    onClick={() => setPageNum((p) => p + 1)}
                  >
                    Sledeća
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
