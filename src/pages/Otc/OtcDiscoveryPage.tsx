import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, Search, TrendingUp } from 'lucide-react';
import { toast } from '@/lib/notify';
import otcService from '@/services/otcService';
import type { OtcListing, CreateOtcOfferRequest } from '@/types/celina3';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { addDaysISO, formatAmount, getErrorMessage, isFutureDateOnly } from '@/utils/formatters';
import OtcSourceFilterChip, { type OtcSource } from '@/components/otc/OtcSourceFilterChip';
import OtcSubHero from '@/components/otc/OtcSubHero';
import OtcInterBankDiscoveryTab from './OtcInterBankDiscoveryTab';

interface OfferFormState {
  quantity: string;
  pricePerStock: string;
  premium: string;
  settlementDate: string;
}

export default function OtcDiscoveryPage() {
  const navigate = useNavigate();
  const [source, setSource] = useState<OtcSource>('all');
  const [listings, setListings] = useState<OtcListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Composite key (listingId:sellerId) — vise prodavaca moze imati istu hartiju
  // pa cista `listingId` nije jedinstven po redu tabele. Bug fix 14.05.2026 vece-7.
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const [formState, setFormState] = useState<OfferFormState>({
    quantity: '1',
    pricePerStock: '',
    premium: '',
    settlementDate: addDaysISO(7),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await otcService.listDiscovery();
      setListings(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje OTC ponuda.');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (!search.trim()) return listings;
    const q = search.toLowerCase();
    return listings.filter(
      (l) =>
        l.listingTicker.toLowerCase().includes(q) ||
        l.listingName.toLowerCase().includes(q) ||
        l.sellerName.toLowerCase().includes(q),
    );
  }, [search, listings]);

  const rowKey = (listing: OtcListing) => `${listing.listingId}:${listing.sellerId}`;

  const openForListing = (listing: OtcListing) => {
    setOpenedKey(rowKey(listing));
    setFormState({
      // R1 776: default kolicina = 1 ako ima sta da se ponudi, inace 0.
      // (Math.min(available, 1) je bila besmislena idioma — uvek 1 ili 0.)
      quantity: String(listing.availablePublicQuantity > 0 ? 1 : 0),
      pricePerStock: listing.currentPrice ? String(listing.currentPrice) : '',
      premium: '',
      settlementDate: addDaysISO(7),
    });
  };

  const submitOffer = async (listing: OtcListing) => {
    // T4A-012 fix: spreciti race kad korisnik brzo klikne Posalji vise puta ili na
    // razlicitim formama. Ako je vec u toku jedna submisija, ignorisi sledeci klik.
    if (submittingKey !== null) {
      toast.info('Sacekajte da se prethodna ponuda zavrsi...');
      return;
    }
    const qty = Number(formState.quantity);
    const price = Number(formState.pricePerStock);
    const premium = Number(formState.premium);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error('Kolicina mora biti pozitivan broj.'); return; }
    if (qty > listing.availablePublicQuantity) { toast.error(`Dostupno je samo ${listing.availablePublicQuantity}.`); return; }
    if (!Number.isFinite(price) || price <= 0) { toast.error('Cena mora biti pozitivna.'); return; }
    if (!Number.isFinite(premium) || premium <= 0) { toast.error('Premija mora biti pozitivna.'); return; }
    if (!formState.settlementDate) { toast.error('Datum dospeca je obavezan.'); return; }
    // R1 860: HTML `min` atribut ne sprecava programski/paste unos proslog datuma —
    // eksplicitno odbij settlement koji nije u buducnosti pre slanja ponude.
    if (!isFutureDateOnly(formState.settlementDate)) { toast.error('Datum dospeca mora biti u buducnosti.'); return; }

    const payload: CreateOtcOfferRequest = {
      listingId: listing.listingId,
      sellerId: listing.sellerId,
      quantity: qty,
      pricePerStock: price,
      premium,
      settlementDate: formState.settlementDate,
    };
    const key = rowKey(listing);
    setSubmittingKey(key);
    try {
      await otcService.createOffer(payload);
      toast.success('Ponuda poslata prodavcu. Pratite je u "Moji pregovori" - sad ceka da prodavac odgovori.');
      setOpenedKey(null);
      navigate('/otc/pregovori');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Neuspesno kreiranje ponude.'));
    } finally {
      setSubmittingKey(null);
    }
  };

  const localCount = listings.length;
  const totalLocalQty = listings.reduce((s, l) => s + (l.availablePublicQuantity ?? 0), 0);
  const uniqueSellers = new Set(listings.map((l) => l.sellerName)).size;

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      <OtcSubHero
        icon={Search}
        title="Pretrazi javne akcije"
        description="Pregled javnih ponuda iz nase i partnerskih banaka. Klikni Napravi ponudu da postanes kupac."
        gradientFrom="from-indigo-500"
        gradientTo="to-violet-600"
        kpis={source === 'inter' ? undefined : [
          { label: 'Listinga', value: String(localCount) },
          { label: 'Komada javno', value: String(totalLocalQty) },
          { label: 'Prodavaca', value: String(uniqueSellers) },
        ]}
      />

      <OtcSourceFilterChip value={source} onChange={setSource} />

      {source === 'inter' ? (
        <OtcInterBankDiscoveryTab />
      ) : (
        <div className="space-y-6">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretrazi po tickeru, nazivu ili prodavcu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                Javno dostupne akcije ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Handshake className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Nema javnih OTC ponuda</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Drugi korisnici jos nisu stavili akcije na javni rezim.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hartija</TableHead>
                      <TableHead>Trenutna cena</TableHead>
                      <TableHead>Dostupno javno</TableHead>
                      <TableHead>Prodavac</TableHead>
                      <TableHead className="text-right">Akcija</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((listing) => {
                      const key = rowKey(listing);
                      const isOpen = openedKey === key;
                      const isSubmitting = submittingKey === key;
                      const anySubmittingOther = submittingKey !== null && submittingKey !== key;
                      return (
                        <Fragment key={key}>
                          <TableRow>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold">{listing.listingTicker}</span>
                                <span className="text-xs text-muted-foreground">{listing.listingName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatAmount(listing.currentPrice)} {listing.listingCurrency}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {listing.availablePublicQuantity} / {listing.publicQuantity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{listing.sellerName}</span>
                                <span className="text-xs text-muted-foreground">{listing.sellerRole}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={isOpen ? 'secondary' : 'default'}
                                // T4A-012 + FIX FE-OTC-01: disable trigger dok je u toku
                                // submisija na bilo kom redu (anySubmittingOther) ILI na
                                // sopstvenom redu (isSubmitting). Bez `isSubmitting`,
                                // korisnik moze kliknuti "Zatvori" mid-submit i izgubiti
                                // submit feedback.
                                disabled={anySubmittingOther || isSubmitting}
                                onClick={() =>
                                  isOpen ? setOpenedKey(null) : openForListing(listing)
                                }
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                              >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                {isOpen ? 'Zatvori' : 'Napravi ponudu'}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={5}>
                                <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-4">
                                  <div className="space-y-1">
                                    <Label htmlFor={`qty-${key}`}>Kolicina akcija</Label>
                                    <Input
                                      id={`qty-${key}`}
                                      type="number"
                                      min={1}
                                      max={listing.availablePublicQuantity}
                                      value={formState.quantity}
                                      onChange={(e) => setFormState((s) => ({ ...s, quantity: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`price-${key}`}>
                                      Cena po akciji ({listing.listingCurrency})
                                    </Label>
                                    <Input
                                      id={`price-${key}`}
                                      type="number"
                                      step="0.01"
                                      value={formState.pricePerStock}
                                      onChange={(e) => setFormState((s) => ({ ...s, pricePerStock: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`premium-${key}`}>
                                      Premija ({listing.listingCurrency})
                                    </Label>
                                    <Input
                                      id={`premium-${key}`}
                                      type="number"
                                      step="0.01"
                                      value={formState.premium}
                                      onChange={(e) => setFormState((s) => ({ ...s, premium: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`date-${key}`}>Datum dospeca</Label>
                                    <Input
                                      id={`date-${key}`}
                                      type="date"
                                      min={addDaysISO(1)}
                                      value={formState.settlementDate}
                                      onChange={(e) => setFormState((s) => ({ ...s, settlementDate: e.target.value }))}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 md:col-span-4">
                                    <Button variant="ghost" size="sm" onClick={() => setOpenedKey(null)}>
                                      Odustani
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={isSubmitting}
                                      onClick={() => void submitOffer(listing)}
                                      className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                                    >
                                      {isSubmitting ? 'Slanje...' : 'Posalji ponudu prodavcu'}
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
        </div>
      )}
    </div>
  );
}
