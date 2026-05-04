//
// Modal za detaljan prikaz poreske obaveze pojedinacnog korisnika.
// Spec Celina 3: "stranica ima detalje koje su transakcije doprinele".
//
// Otvara se kad supervizor klikne na red u TaxPortalPage. Fetchuje breakdown
// preko `taxService.getTaxBreakdown(userId, userType)`. Ako BE endpoint jos
// nije implementiran (404/501), prikazuje "Detaljan prikaz nije dostupan"
// placeholder umesto da puca.
//

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2, FileBarChart, AlertCircle, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatAmount } from '@/utils/formatters';
import { parseNumber } from '@/utils/numberUtils';
import taxService from '@/services/taxService';
import type { TaxBreakdownResponse, TaxBreakdownItemDto, TaxRecord } from '@/types/celina3';

interface TaxDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: TaxRecord | null;
}

type LoadStatus = 'idle' | 'loading' | 'ok' | 'error' | 'unavailable';

function sourceLabel(source: string): string {
  if (source === 'STOCK_ORDER') return 'Berza';
  if (source === 'OTC_CONTRACT') return 'OTC';
  return source;
}

export default function TaxDetailDialog({ open, onOpenChange, record }: TaxDetailDialogProps) {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [data, setData] = useState<TaxBreakdownResponse | null>(null);
  // P2.4 — per-listing aggregisani breakdown (spec Celina 3 §516-518). Fetcha
  // se nezavisno od per-transaction breakdown-a, da BE moze da vrati 200 OK
  // za jedan a 404/501 za drugi bez da blokira UI.
  const [perListingItems, setPerListingItems] = useState<TaxBreakdownItemDto[]>([]);
  const [perListingStatus, setPerListingStatus] = useState<LoadStatus>('idle');

  useEffect(() => {
    let cancelled = false;

    // Sync setState u useEffect-u krsi `react-hooks/set-state-in-effect`.
    // Sve state izmene idu kroz microtask (Promise.resolve().then(...)) tako
    // da ovo bude bezbedno za React strict mode.
    if (!open || !record) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setStatus('idle');
        setData(null);
        setPerListingItems([]);
        setPerListingStatus('idle');
      });
      return () => {
        cancelled = true;
      };
    }

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setStatus('loading');
        setData(null);
      })
      .then(() => taxService.getTaxBreakdown(record.userId, record.userType))
      .then((response) => {
        if (cancelled || !response) return;
        setData(response);
        setStatus('ok');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Ako BE nije implementirao endpoint (404/501), prikazi placeholder
        // umesto error toast. To dozvoljava da FE bude spreman pre BE rada.
        const httpErr = err as { response?: { status?: number } };
        const httpStatus = httpErr?.response?.status;
        if (httpStatus === 404 || httpStatus === 501 || httpStatus === 405) {
          setStatus('unavailable');
        } else {
          setStatus('error');
        }
      });

    // P2.4 — paralelno fetch per-listing aggregisanog breakdown-a.
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setPerListingStatus('loading');
        setPerListingItems([]);
      })
      .then(() => taxService.getPerListingBreakdown(record.userId, record.userType))
      .then((items) => {
        if (cancelled) return;
        setPerListingItems(Array.isArray(items) ? items : []);
        setPerListingStatus('ok');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const httpErr = err as { response?: { status?: number } };
        const httpStatus = httpErr?.response?.status;
        if (httpStatus === 404 || httpStatus === 501 || httpStatus === 405) {
          setPerListingStatus('unavailable');
        } else {
          setPerListingStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, record]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background shadow-2xl">
          <div className="flex items-start justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                <FileBarChart className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  {record ? `Detalji poreza · ${record.userName}` : 'Detalji poreza'}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Pregled SELL transakcija koje su doprinele poreskoj obavezi (15% kapitalne dobiti).
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Zatvori"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-6">
            {status === 'loading' && (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                <span className="text-sm text-muted-foreground">Ucitavam detalje poreske obaveze...</span>
              </div>
            )}

            {status === 'unavailable' && (
              <Alert data-testid="tax-detail-unavailable">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Detaljan prikaz nije dostupan</AlertTitle>
                <AlertDescription>
                  Backend trenutno ne pruza breakdown po transakcijama za ovog korisnika. Sumarni
                  podaci su vec prikazani u tabeli.
                </AlertDescription>
              </Alert>
            )}

            {status === 'error' && (
              <Alert variant="destructive" data-testid="tax-detail-error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Greska pri ucitavanju</AlertTitle>
                <AlertDescription>
                  Detaljan prikaz nije moguce ucitati. Pokusajte ponovo kasnije.
                </AlertDescription>
              </Alert>
            )}

            {status === 'ok' && data && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Ukupan profit</p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatAmount(parseNumber(data.totalProfit))}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Ukupan porez</p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {formatAmount(parseNumber(data.totalTax))}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Period</p>
                    <p className="text-lg font-semibold">
                      {data.month != null ? `${data.month}/${data.year}` : `${data.year}`}
                    </p>
                  </div>
                </div>

                {data.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <FileBarChart className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold">Nema doprinosacih transakcija</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ovaj korisnik nema realizovanih SELL transakcija u izabranom periodu.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hartija</TableHead>
                        <TableHead>Izvor</TableHead>
                        <TableHead className="text-right">Kolicina</TableHead>
                        <TableHead className="text-right">Buy cena</TableHead>
                        <TableHead className="text-right">Sell cena</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Porez (15%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => {
                        const profit = parseNumber(item.profit);
                        const isProfit = profit > 0;
                        return (
                          <TableRow key={item.orderId}>
                            <TableCell>
                              <div className="font-medium">{item.listingTicker}</div>
                              <div className="text-xs text-muted-foreground">{item.listingType}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.source === 'OTC_CONTRACT' ? 'warning' : 'info'}>
                                {sourceLabel(item.source)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatAmount(parseNumber(item.quantity), 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {formatAmount(parseNumber(item.buyPrice))} {item.currency}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {formatAmount(parseNumber(item.sellPrice))} {item.currency}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono tabular-nums font-semibold ${
                                isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {isProfit ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {formatAmount(profit)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatAmount(parseNumber(item.taxAmount))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </>
            )}

            {/*
              P2.4 — Per-listing aggregisani breakdown (spec Celina 3 §516-518).
              Renderuje se nezavisno od per-transaction breakdown-a iznad —
              ako je samo jedan endpoint dostupan, prikazi se samo on.
            */}
            <div className="space-y-3 pt-2 border-t" data-testid="tax-per-listing-section">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold">Po hartiji (agregisano)</h3>
              </div>

              {perListingStatus === 'loading' && (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ucitavam aggregisani per-listing breakdown...
                </div>
              )}

              {perListingStatus === 'unavailable' && (
                <Alert data-testid="tax-per-listing-unavailable">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Per-listing breakdown nije dostupan (BE endpoint jos nije implementiran).
                  </AlertDescription>
                </Alert>
              )}

              {perListingStatus === 'error' && (
                <Alert variant="destructive" data-testid="tax-per-listing-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Greska pri ucitavanju per-listing breakdown-a.
                  </AlertDescription>
                </Alert>
              )}

              {perListingStatus === 'ok' && perListingItems.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Nema aggregisanih stavki po hartiji.
                </p>
              )}

              {perListingStatus === 'ok' && perListingItems.length > 0 && (
                <Table data-testid="tax-per-listing-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Valuta</TableHead>
                      <TableHead className="text-right">Profit (native)</TableHead>
                      <TableHead className="text-right">Profit (RSD)</TableHead>
                      <TableHead className="text-right">Porez (RSD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perListingItems.map((item) => {
                      const profitRsd = parseNumber(item.profitRsd);
                      const isProfitRsdPositive = profitRsd >= 0;
                      return (
                        <TableRow key={item.listingId}>
                          <TableCell className="font-medium">{item.ticker}</TableCell>
                          <TableCell className="text-muted-foreground">{item.listingCurrency}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatAmount(parseNumber(item.profitNative))} {item.listingCurrency}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono tabular-nums font-semibold ${
                              isProfitRsdPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {formatAmount(profitRsd)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                            {formatAmount(parseNumber(item.taxOwed))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
