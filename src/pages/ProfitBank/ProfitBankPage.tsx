import { Fragment, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Landmark, TrendingUp, Users, ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import profitBankService from '@/services/profitBankService';
import investmentFundService from '@/services/investmentFundService';
import FundInvestDialog from '@/pages/Funds/FundInvestDialog';
import FundWithdrawDialog from '@/pages/Funds/FundWithdrawDialog';
import { useAuth } from '@/context/AuthContext';
import type { ActuaryProfit, ClientFundPosition, InvestmentFundDetail } from '@/types/celina4';
import { formatAmount, getErrorMessage } from '@/utils/formatters';
import { toast } from '@/lib/notify';

/**
 * P6 — Spec Celina 4 (Nova) §4393-4645: Portal "Profit Banke" za supervizore.
 *
 * Dva taba:
 *  1. Profit aktuara: ime, prezime, pozicija, profit u RSD, broj ordera
 *  2. Pozicije u fondovima: fondovi u kojima banka ima udele
 *
 * Backend mora vratiti supervizorske podatke; ako nije implementirano,
 * vraca 501/empty array — ovde renderujemo "Banka nema pozicije" stanje.
 */
type DialogState =
  | { mode: 'invest'; fundId: number; fundName: string; minimumContribution: number }
  | { mode: 'withdraw'; fundId: number; fundName: string; position: ClientFundPosition }
  | null;

export default function ProfitBankPage() {
  const { isSupervisor } = useAuth();
  const [tab, setTab] = useState<'actuaries' | 'positions'>('actuaries');
  const [actuaries, setActuaries] = useState<ActuaryProfit[]>([]);
  const [bankPositions, setBankPositions] = useState<ClientFundPosition[]>([]);
  const [loadingActuaries, setLoadingActuaries] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [minByFundId, setMinByFundId] = useState<Record<number, number>>({});
  const [dialog, setDialog] = useState<DialogState>(null);
  // Per-fund holdings breakdown (Spec Celina 4 (Nova) §4585-4628). Klik na
  // "Detalji" otvara expandable red ispod glavnog reda sa listom hartija fonda
  // + fund metadata (manager, liquidity, accountNumber).
  const [expandedFundId, setExpandedFundId] = useState<number | null>(null);
  const [fundDetailCache, setFundDetailCache] = useState<Record<number, InvestmentFundDetail>>({});
  const [loadingDetailFundId, setLoadingDetailFundId] = useState<number | null>(null);

  const toggleExpandFund = async (fundId: number) => {
    if (expandedFundId === fundId) {
      setExpandedFundId(null);
      return;
    }
    setExpandedFundId(fundId);
    if (fundDetailCache[fundId]) return; // vec keshirano

    setLoadingDetailFundId(fundId);
    try {
      const detail = await investmentFundService.get(fundId);
      setFundDetailCache((prev) => ({ ...prev, [fundId]: detail }));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Greska pri ucitavanju detalja fonda'));
      // Ostavi expand otvoren — UI ce pokazati error placeholder
    } finally {
      setLoadingDetailFundId(null);
    }
  };

  const reloadBankPositions = async () => {
    setLoadingPositions(true);
    try {
      const data = await profitBankService.listBankFundPositions();
      setBankPositions(data);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Greska pri ucitavanju pozicija banke'));
    } finally {
      setLoadingPositions(false);
    }
  };

  /**
   * R1 560: posle invest/withdraw mutacije keshirani `fundDetailCache[fundId]`
   * (holdings, totalAssetValue, sharePrice) postaje USTAJAO. Invalidiramo unos;
   * ako je red trenutno otvoren, odmah ponovo dohvatamo svez detalj.
   */
  const invalidateFundDetail = async (fundId: number) => {
    setFundDetailCache((prev) => {
      if (!(fundId in prev)) return prev;
      const next = { ...prev };
      delete next[fundId];
      return next;
    });
    if (expandedFundId === fundId) {
      setLoadingDetailFundId(fundId);
      try {
        const detail = await investmentFundService.get(fundId);
        setFundDetailCache((prev) => ({ ...prev, [fundId]: detail }));
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, 'Greska pri ucitavanju detalja fonda'));
      } finally {
        setLoadingDetailFundId(null);
      }
    }
  };

  useEffect(() => {
    if (!isSupervisor) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await profitBankService.listActuaryPerformance();
        if (!cancelled) setActuaries(data);
      } catch (err: unknown) {
        if (!cancelled) toast.error(getErrorMessage(err, 'Greska pri ucitavanju profita aktuara'));
      } finally {
        if (!cancelled) setLoadingActuaries(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSupervisor]);

  // R1-845: pocetno ucitavanje pozicija deli istu fetch+error logiku sa
  // `reloadBankPositions` (koji se zove posle invest/withdraw mutacije), pa
  // ovde pozivamo isti fetcher umesto duplirane inline kopije. Poziv ide kroz
  // async IIFE tako da setState pozivi ostaju unutar async grane (ne sinhrono
  // u telu efekta).
  useEffect(() => {
    if (!isSupervisor) return;
    void (async () => {
      await reloadBankPositions();
    })();
    // reloadBankPositions je stabilna helper funkcija u okviru komponente.
  }, [isSupervisor]);

  // Spec Celina 4 (Nova) §4585-4628: Uplata/Povlacenje akcije po fondu.
  // Da bismo mogli da otvorimo FundInvestDialog za bilo koji fond u kome banka
  // ima poziciju, povlacimo `minimumContribution` iz `/funds` liste.
  useEffect(() => {
    if (!isSupervisor) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await investmentFundService.list();
        if (cancelled) return;
        const map: Record<number, number> = {};
        for (const f of list) {
          map[f.id] = f.minimumContribution;
        }
        setMinByFundId(map);
      } catch {
        // best-effort — bez minimuma, dialog ce koristiti 0 kao default i BE ce vracati 400 ako ne valja.
      }
    })();
    return () => { cancelled = true; };
  }, [isSupervisor]);

  if (!isSupervisor) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profit Banke</h1>
          <p className="text-sm text-muted-foreground">
            Pregled profita aktuara i bankinih pozicija u investicionim fondovima (RSD).
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'actuaries' | 'positions')}>
        <TabsList>
          <TabsTrigger value="actuaries">
            <Users className="mr-2 h-4 w-4" /> Profit aktuara
          </TabsTrigger>
          <TabsTrigger value="positions">
            <TrendingUp className="mr-2 h-4 w-4" /> Pozicije u fondovima
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actuaries" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profit aktuara (RSD)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActuaries ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                  ))}
                </div>
              ) : actuaries.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nema podataka o profitu aktuara.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aktuar</TableHead>
                      <TableHead>Pozicija</TableHead>
                      <TableHead className="text-right">Broj ordera</TableHead>
                      <TableHead className="text-right">Profit (RSD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actuaries.map((a) => (
                      <TableRow key={a.employeeId}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>
                          <Badge variant={a.position === 'SUPERVISOR' ? 'success' : 'secondary'}>
                            {a.position === 'SUPERVISOR' ? 'Supervizor' : 'Agent'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{a.ordersDone}</TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            a.totalProfitRsd >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                          data-testid={`actuary-profit-${a.employeeId}`}
                        >
                          {formatAmount(a.totalProfitRsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Bankine pozicije u fondovima</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPositions ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                  ))}
                </div>
              ) : bankPositions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Banka trenutno nema pozicije u fondovima. Backend cesto vraca prazan list dok
                  flow uplata banke u fondove nije dovrsen (P9).
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" aria-label="Detalji" />
                      <TableHead>Fond</TableHead>
                      <TableHead className="text-right">Ulozeno (RSD)</TableHead>
                      <TableHead className="text-right">Trenutna vrednost (RSD)</TableHead>
                      <TableHead className="text-right">% fonda</TableHead>
                      <TableHead className="text-right">Profit (RSD)</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankPositions.map((p) => {
                      const profit = (p.currentValue ?? 0) - (p.totalInvested ?? 0);
                      const fundName = p.fundName ?? `Fond #${p.fundId}`;
                      const minContribution = minByFundId[p.fundId] ?? 0;
                      const isExpanded = expandedFundId === p.fundId;
                      const detail = fundDetailCache[p.fundId];
                      const isLoadingDetail = loadingDetailFundId === p.fundId;
                      return (
                        <Fragment key={p.id}>
                          <TableRow
                            data-testid={`bank-fund-row-${p.fundId}`}
                            className={isExpanded ? 'bg-muted/30' : undefined}
                          >
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => void toggleExpandFund(p.fundId)}
                                aria-label={isExpanded ? 'Sakrij detalje fonda' : 'Prikazi detalje fonda'}
                                data-testid={`bank-fund-expand-${p.fundId}`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">{fundName}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(p.totalInvested ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(p.currentValue ?? 0)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {p.percentOfFund != null ? `${p.percentOfFund.toFixed(2)}%` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatAmount(profit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setDialog({
                                      mode: 'invest',
                                      fundId: p.fundId,
                                      fundName,
                                      minimumContribution: minContribution,
                                    })
                                  }
                                >
                                  <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
                                  Uplati u ime banke
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={(p.currentValue ?? 0) <= 0}
                                  onClick={() =>
                                    setDialog({
                                      mode: 'withdraw',
                                      fundId: p.fundId,
                                      fundName,
                                      position: p,
                                    })
                                  }
                                >
                                  <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />
                                  Povuci u ime banke
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow data-testid={`bank-fund-breakdown-${p.fundId}`} className="bg-muted/10">
                              <TableCell colSpan={7} className="p-0">
                                <div className="p-4 space-y-4">
                                  {isLoadingDetail ? (
                                    <div className="flex items-center justify-center gap-3 py-6">
                                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                      <span className="text-sm text-muted-foreground">Ucitavam detalje fonda...</span>
                                    </div>
                                  ) : !detail ? (
                                    <div className="rounded-md border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
                                      Detalji fonda nisu dostupni. Backend je odgovorio greskom.
                                    </div>
                                  ) : (
                                    <>
                                      {/* Mini KPI grid */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="rounded-lg border bg-background p-3">
                                          <p className="text-xs text-muted-foreground">Menadzer</p>
                                          <p className="text-sm font-semibold">{detail.managerName}</p>
                                        </div>
                                        <div className="rounded-lg border bg-background p-3">
                                          <p className="text-xs text-muted-foreground">Vrednost fonda</p>
                                          <p className="text-sm font-mono font-semibold">{formatAmount(detail.fundValue)} RSD</p>
                                        </div>
                                        <div className="rounded-lg border bg-background p-3">
                                          <p className="text-xs text-muted-foreground">Likvidnost</p>
                                          <p className="text-sm font-mono font-semibold">{formatAmount(detail.liquidAmount)} RSD</p>
                                        </div>
                                        <div className="rounded-lg border bg-background p-3">
                                          <p className="text-xs text-muted-foreground">Min. ulog</p>
                                          <p className="text-sm font-mono font-semibold">{formatAmount(detail.minimumContribution)} RSD</p>
                                        </div>
                                      </div>

                                      {/* Holdings tabela */}
                                      <div>
                                        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                          Hartije u fondu ({detail.holdings.length})
                                        </p>
                                        {detail.holdings.length === 0 ? (
                                          <div className="rounded-md border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                                            Fond trenutno nema portfolio hartija (samo likvidnost).
                                          </div>
                                        ) : (
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Ticker</TableHead>
                                                <TableHead>Naziv</TableHead>
                                                <TableHead className="text-right">Kolicina</TableHead>
                                                <TableHead className="text-right">Cena</TableHead>
                                                <TableHead className="text-right">Vrednost</TableHead>
                                                <TableHead className="text-right">Promena</TableHead>
                                                <TableHead className="text-right">Datum kupovine</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {detail.holdings.map((h) => {
                                                const value = h.quantity * h.currentPrice;
                                                const isPositive = h.change >= 0;
                                                return (
                                                  <TableRow key={`${h.listingId}-${h.acquisitionDate}`}>
                                                    <TableCell className="font-mono font-semibold">{h.ticker}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{h.name}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatAmount(h.quantity, 0)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatAmount(h.currentPrice)}</TableCell>
                                                    <TableCell className="text-right font-mono font-semibold">{formatAmount(value)}</TableCell>
                                                    <TableCell
                                                      className={`text-right font-mono ${
                                                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                                      }`}
                                                    >
                                                      {isPositive ? '+' : ''}
                                                      {formatAmount(h.change)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">{h.acquisitionDate}</TableCell>
                                                  </TableRow>
                                                );
                                              })}
                                            </TableBody>
                                          </Table>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dialog?.mode === 'invest' && (
        <FundInvestDialog
          open
          fundId={dialog.fundId}
          fundName={dialog.fundName}
          minimumContribution={dialog.minimumContribution}
          onClose={() => setDialog(null)}
          onSuccess={() => {
            const fundId = dialog.fundId;
            setDialog(null);
            void reloadBankPositions();
            void invalidateFundDetail(fundId);
          }}
        />
      )}

      {dialog?.mode === 'withdraw' && (
        <FundWithdrawDialog
          open
          fundId={dialog.fundId}
          fundName={dialog.fundName}
          myPosition={dialog.position}
          onClose={() => setDialog(null)}
          onSuccess={() => {
            const fundId = dialog.fundId;
            setDialog(null);
            void reloadBankPositions();
            void invalidateFundDetail(fundId);
          }}
        />
      )}
    </div>
  );
}
