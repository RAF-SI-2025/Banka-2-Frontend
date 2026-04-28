import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Info, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from '@/lib/notify';
import interbankOtcService from '@/services/interbankOtcService';
import type { CreateOtcInterbankOfferRequest, OtcInterbankListing } from '@/types/celina4';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAmount, getErrorMessage } from '@/utils/formatters';

const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type OfferFormState = {
  quantity: string;
  pricePerStock: string;
  premium: string;
  settlementDate: string;
};

const getListingKey = (listing: OtcInterbankListing) =>
  `${listing.bankCode}:${listing.sellerPublicId}:${listing.listingTicker}`;

/*
  ROLE FILTER (Spec Celina 5 (Nova) §840-848):
  "Klijenti vide ponude Klijenata, Aktuari vide ponude Aktuara."

  Strategija (resolved per Issue #95):
  - Defensive FE filter po opcionom `OtcInterbankListing.sellerRole` polju
    koje partner banke mogu da vrate kao extension u `GET /public-stock`.
  - Ako polje POSTOJI: izbacujemo cross-role listinge (klijent ne vidi
    EMPLOYEE, zaposleni ne vidi CLIENT).
  - Ako polje NE postoji: prikazujemo listing (defensive fallback) i oslanjamo
    se na BE acceptOffer guard (`OtcService.ensureSameRoleParticipants`) koji
    vraca 400 za cross-role pokusaje. UI ima info badge koji upozorava korisnika
    da ce server odbiti kupovinu ako je rola pogresna.
  - UI takodje pokazuje koliko je listinga sakriveno filterom.
*/
export default function OtcInterBankDiscoveryTab() {
  const { isAdmin, isAgent, isSupervisor } = useAuth();
  const myRole: 'CLIENT' | 'EMPLOYEE' = isAdmin || isAgent || isSupervisor ? 'EMPLOYEE' : 'CLIENT';

  const [listings, setListings] = useState<OtcInterbankListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openedListingKey, setOpenedListingKey] = useState<string | null>(null);
  const [submittingListingKey, setSubmittingListingKey] = useState<string | null>(null);
  const [formState, setFormState] = useState<OfferFormState>({
    quantity: '1',
    pricePerStock: '',
    premium: '',
    settlementDate: addDaysISO(7),
  });

  const visibleListings = useMemo(
    () => listings.filter((l) => !l.sellerRole || l.sellerRole === myRole),
    [listings, myRole],
  );
  const hiddenByRoleCount = listings.length - visibleListings.length;
  const unknownRoleCount = useMemo(
    () => visibleListings.filter((l) => !l.sellerRole).length,
    [visibleListings],
  );

  const refresh = useCallback(async (mode: 'initial' | 'manual' | 'post-submit' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await interbankOtcService.listRemoteListings();
      setListings(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje OTC ponuda iz drugih banaka.');
      setListings([]);
    } finally {
      if (mode === 'initial') {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openForListing = (listing: OtcInterbankListing) => {
    setOpenedListingKey(getListingKey(listing));
    setFormState({
      quantity: String(Math.min(listing.availableQuantity, 1)),
      pricePerStock: listing.currentPrice ? String(listing.currentPrice) : '',
      premium: '',
      settlementDate: addDaysISO(7),
    });
  };

  const submitOffer = async (listing: OtcInterbankListing) => {
    const quantity = Number(formState.quantity);
    const pricePerStock = Number(formState.pricePerStock);
    const premium = Number(formState.premium);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Kolicina mora biti pozitivan broj.');
      return;
    }
    if (quantity > listing.availableQuantity) {
      toast.error(`Dostupno je samo ${listing.availableQuantity} akcija.`);
      return;
    }
    if (!Number.isFinite(pricePerStock) || pricePerStock <= 0) {
      toast.error('Cena po akciji mora biti pozitivan broj.');
      return;
    }
    if (!Number.isFinite(premium) || premium <= 0) {
      toast.error('Premija mora biti pozitivan broj.');
      return;
    }
    if (!formState.settlementDate) {
      toast.error('Datum dospeca je obavezan.');
      return;
    }

    const listingKey = getListingKey(listing);
    const payload: CreateOtcInterbankOfferRequest = {
      sellerBankCode: listing.bankCode,
      sellerUserId: listing.sellerPublicId,
      listingTicker: listing.listingTicker,
      quantity,
      pricePerStock,
      premium,
      settlementDate: formState.settlementDate,
    };

    setSubmittingListingKey(listingKey);
    try {
      await interbankOtcService.createOffer(payload);
      toast.success('Inter-bank ponuda je uspesno poslata.');
      setOpenedListingKey(null);
      await refresh('post-submit');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Neuspesno kreiranje inter-bank ponude.'));
    } finally {
      setSubmittingListingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
          Javno dostupne akcije iz drugih banaka ({visibleListings.length})
          <Badge
            variant="outline"
            className="ml-2 font-normal"
            data-testid="role-filter-badge"
            title={
              myRole === 'CLIENT'
                ? 'Vidis samo ponude koje su postavili klijenti drugih banaka.'
                : 'Vidis samo ponude koje su postavili aktuari drugih banaka.'
            }
          >
            {myRole === 'CLIENT' ? 'Klijenti' : 'Aktuari'}
          </Badge>
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh('manual')}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Osvezi
        </Button>
      </CardHeader>
      <CardContent>
        {!loading && (hiddenByRoleCount > 0 || unknownRoleCount > 0) && (
          <div
            className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            data-testid="role-filter-hint"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              {hiddenByRoleCount > 0 && (
                <p>
                  <span data-testid="hidden-by-role-count">{hiddenByRoleCount}</span>{' '}
                  {hiddenByRoleCount === 1 ? 'ponuda je sakrivena' : 'ponuda je sakriveno'}{' '}
                  jer{' '}
                  {hiddenByRoleCount === 1 ? 'odgovara' : 'odgovaraju'}{' '}
                  drugoj roli korisnika.
                </p>
              )}
              {unknownRoleCount > 0 && (
                <p>
                  Za <span data-testid="unknown-role-count">{unknownRoleCount}</span>{' '}
                  {unknownRoleCount === 1 ? 'ponudu' : 'ponuda'} partner banka nije vratila
                  rolu prodavca; pokusaj kupovine ce biti odbijen ako rola ne odgovara.
                </p>
              )}
            </div>
          </div>
        )}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : visibleListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nema dostupnih inter-bank OTC ponuda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hiddenByRoleCount > 0
                ? `Sve ${hiddenByRoleCount} dostupnih ponuda odgovara drugoj roli korisnika.`
                : 'Trenutno nema javnih listinga iz partnerskih banaka za vas profil trgovanja.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Banka prodavca</TableHead>
                <TableHead>Prodavac</TableHead>
                <TableHead>Trenutna cena</TableHead>
                <TableHead>Dostupno</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleListings.map((listing) => {
                const listingKey = getListingKey(listing);
                const isOpen = openedListingKey === listingKey;

                return (
                  <Fragment key={listingKey}>
                    <TableRow>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{listing.listingTicker}</span>
                          <span className="text-xs text-muted-foreground">{listing.listingName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{listing.bankCode}</Badge>
                      </TableCell>
                      <TableCell>{listing.sellerName}</TableCell>
                      <TableCell className="font-mono">
                        {formatAmount(listing.currentPrice)} {listing.listingCurrency}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {listing.availableQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isOpen ? 'secondary' : 'default'}
                          onClick={() => (isOpen ? setOpenedListingKey(null) : openForListing(listing))}
                          className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          {isOpen ? 'Zatvori' : 'Napravi ponudu'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6}>
                          <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-4">
                            <div className="space-y-1">
                              <Label htmlFor={`remote-qty-${listingKey}`}>Kolicina akcija</Label>
                              <Input
                                id={`remote-qty-${listingKey}`}
                                type="number"
                                min={1}
                                max={listing.availableQuantity}
                                value={formState.quantity}
                                onChange={(e) => setFormState((s) => ({ ...s, quantity: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`remote-price-${listingKey}`}>
                                Cena po akciji ({listing.listingCurrency})
                              </Label>
                              <Input
                                id={`remote-price-${listingKey}`}
                                type="number"
                                step="0.01"
                                value={formState.pricePerStock}
                                onChange={(e) => setFormState((s) => ({ ...s, pricePerStock: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`remote-premium-${listingKey}`}>
                                Premija ({listing.listingCurrency})
                              </Label>
                              <Input
                                id={`remote-premium-${listingKey}`}
                                type="number"
                                step="0.01"
                                value={formState.premium}
                                onChange={(e) => setFormState((s) => ({ ...s, premium: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`remote-date-${listingKey}`}>Datum dospeca</Label>
                              <Input
                                id={`remote-date-${listingKey}`}
                                type="date"
                                min={addDaysISO(1)}
                                value={formState.settlementDate}
                                onChange={(e) => setFormState((s) => ({ ...s, settlementDate: e.target.value }))}
                              />
                            </div>
                            <div className="flex justify-end gap-2 md:col-span-4">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenedListingKey(null)}>
                                Odustani
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={submittingListingKey === listingKey}
                                onClick={() => void submitOffer(listing)}
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                              >
                                {submittingListingKey === listingKey ? 'Slanje...' : 'Posalji ponudu prodavcu'}
                              </Button>
                            </div>
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
  );
}
