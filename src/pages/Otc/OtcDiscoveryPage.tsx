import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Handshake, Search, TrendingUp } from 'lucide-react';
import { toast } from '@/lib/notify';
import otcService from '@/services/otcService';
import interbankOtcService from '@/services/interbankOtcService';
import type { OtcListing, CreateOtcOfferRequest } from '@/types/celina3';
import type { CreateOtcInterbankOfferRequest, OtcInterbankListing } from '@/types/celina4';
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

const OUR_BANK_LABEL = 'Banka 2';

/**
 * Normalizovan red discovery tabele — objedinjuje intra (`/otc/listings`) i
 * inter-bank (`/interbank/otc/listings`) listinge u jedinstven prikaz sa
 * kolonom "Banka". `origin` diskriminator odlucuje kroz koji servis ide
 * kreiranje ponude i koja polja koristimo za payload.
 */
type DiscoveryRow = {
  key: string;
  origin: 'intra' | 'inter';
  bankLabel: string;
  listingTicker: string;
  listingName: string;
  listingCurrency: string;
  currentPrice: number;
  availableQuantity: number;
  /** Sekundarni broj ("dostupno / ukupno") — samo intra ima publicQuantity. */
  publicQuantity?: number;
  sellerName: string;
  sellerRole?: string;
  searchHaystack: string;
  /** Originalni izvorni objekat — koristi se pri kreiranju ponude. */
  intra?: OtcListing;
  inter?: OtcInterbankListing;
};

function intraToRow(l: OtcListing): DiscoveryRow {
  return {
    key: `intra:${l.listingId}:${l.sellerId}`,
    origin: 'intra',
    bankLabel: OUR_BANK_LABEL,
    listingTicker: l.listingTicker,
    listingName: l.listingName,
    listingCurrency: l.listingCurrency,
    currentPrice: l.currentPrice,
    availableQuantity: l.availablePublicQuantity,
    publicQuantity: l.publicQuantity,
    sellerName: l.sellerName,
    sellerRole: l.sellerRole,
    searchHaystack: `${l.listingTicker} ${l.listingName} ${l.sellerName} ${OUR_BANK_LABEL}`.toLowerCase(),
    intra: l,
  };
}

function interToRow(l: OtcInterbankListing): DiscoveryRow {
  return {
    key: `inter:${l.bankCode}:${l.sellerPublicId}:${l.listingTicker}`,
    origin: 'inter',
    bankLabel: l.bankCode,
    listingTicker: l.listingTicker,
    listingName: l.listingName,
    listingCurrency: l.listingCurrency,
    currentPrice: l.currentPrice,
    availableQuantity: l.availableQuantity,
    sellerName: l.sellerName,
    sellerRole: l.sellerRole,
    searchHaystack: `${l.listingTicker} ${l.listingName} ${l.sellerName} ${l.bankCode}`.toLowerCase(),
    inter: l,
  };
}

export default function OtcDiscoveryPage() {
  const navigate = useNavigate();
  const [source, setSource] = useState<OtcSource>('all');
  // FIX: "Sve" mora prikazati I nase I tudje listinge. Drzimo oba izvora odvojeno
  // i normalizujemo u jedinstven skup; izvor-chip filtrira nad istim skupom.
  const [intraListings, setIntraListings] = useState<OtcListing[]>([]);
  const [interListings, setInterListings] = useState<OtcInterbankListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Composite key (origin:listingId:sellerId) — vise prodavaca moze imati istu hartiju
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
    // Oba izvora nezavisno (Promise.allSettled): pad jednog ne sme oboriti drugi —
    // npr. partner banka nedostupna, ali nase listinge i dalje prikazujemo.
    const [intraRes, interRes] = await Promise.allSettled([
      otcService.listDiscovery(),
      interbankOtcService.listRemoteListings(),
    ]);
    if (intraRes.status === 'fulfilled') {
      setIntraListings(intraRes.value ?? []);
    } else {
      setIntraListings([]);
      toast.error('Neuspesno ucitavanje OTC ponuda iz nase banke.');
    }
    if (interRes.status === 'fulfilled') {
      setInterListings(interRes.value ?? []);
    } else {
      setInterListings([]);
      // Inter-bank discovery je best-effort; ne blokira intra prikaz.
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Normalizovan, objedinjen skup. Izvor-chip filtrira nad istim skupom
  // ('all' = oba, 'intra' = samo nase, 'inter' = samo tudje — vidi nizе render).
  const allRows = useMemo<DiscoveryRow[]>(
    () => [...intraListings.map(intraToRow), ...interListings.map(interToRow)],
    [intraListings, interListings],
  );

  const sourceRows = useMemo<DiscoveryRow[]>(() => {
    if (source === 'intra') return allRows.filter((r) => r.origin === 'intra');
    if (source === 'inter') return allRows.filter((r) => r.origin === 'inter');
    return allRows;
  }, [allRows, source]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sourceRows;
    const q = search.toLowerCase();
    return sourceRows.filter((r) => r.searchHaystack.includes(q));
  }, [search, sourceRows]);

  const openForListing = (row: DiscoveryRow) => {
    setOpenedKey(row.key);
    setFormState({
      // R1 776: default kolicina = 1 ako ima sta da se ponudi, inace 0.
      quantity: String(row.availableQuantity > 0 ? 1 : 0),
      pricePerStock: row.currentPrice ? String(row.currentPrice) : '',
      premium: '',
      settlementDate: addDaysISO(7),
    });
  };

  const submitOffer = async (row: DiscoveryRow) => {
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
    if (qty > row.availableQuantity) { toast.error(`Dostupno je samo ${row.availableQuantity}.`); return; }
    if (!Number.isFinite(price) || price <= 0) { toast.error('Cena mora biti pozitivna.'); return; }
    if (!Number.isFinite(premium) || premium <= 0) { toast.error('Premija mora biti pozitivna.'); return; }
    if (!formState.settlementDate) { toast.error('Datum dospeca je obavezan.'); return; }
    // R1 860: HTML `min` atribut ne sprecava programski/paste unos proslog datuma —
    // eksplicitno odbij settlement koji nije u buducnosti pre slanja ponude.
    if (!isFutureDateOnly(formState.settlementDate)) { toast.error('Datum dospeca mora biti u buducnosti.'); return; }

    setSubmittingKey(row.key);
    try {
      if (row.origin === 'inter' && row.inter) {
        const payload: CreateOtcInterbankOfferRequest = {
          sellerBankCode: row.inter.bankCode,
          sellerUserId: row.inter.sellerPublicId,
          listingTicker: row.inter.listingTicker,
          quantity: qty,
          pricePerStock: price,
          premium,
          settlementDate: formState.settlementDate,
        };
        await interbankOtcService.createOffer(payload);
      } else if (row.intra) {
        const payload: CreateOtcOfferRequest = {
          listingId: row.intra.listingId,
          sellerId: row.intra.sellerId,
          quantity: qty,
          pricePerStock: price,
          premium,
          settlementDate: formState.settlementDate,
        };
        await otcService.createOffer(payload);
      }
      toast.success('Ponuda poslata prodavcu. Pratite je u "Moji pregovori" - sad ceka da prodavac odgovori.');
      setOpenedKey(null);
      navigate('/otc/pregovori');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Neuspesno kreiranje ponude.'));
    } finally {
      setSubmittingKey(null);
    }
  };

  // KPI sazetak nad trenutno vidljivim skupom (posle izvor-filtera).
  const listingsCount = sourceRows.length;
  const totalQty = sourceRows.reduce((s, r) => s + (r.availableQuantity ?? 0), 0);
  const uniqueBanks = new Set(sourceRows.map((r) => r.bankLabel)).size;

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      <OtcSubHero
        icon={Search}
        title="Pretrazi javne akcije"
        description="Pregled javnih ponuda iz nase i partnerskih banaka. Klikni Napravi ponudu da postanes kupac."
        gradientFrom="from-indigo-500"
        gradientTo="to-violet-600"
        kpis={source === 'inter' ? undefined : [
          { label: 'Listinga', value: String(listingsCount) },
          { label: 'Komada javno', value: String(totalQty) },
          { label: 'Banaka', value: String(uniqueBanks) },
        ]}
      />

      <OtcSourceFilterChip value={source} onChange={setSource} />

      {source === 'inter' ? (
        // Za samo "Iz drugih banaka" zadrzavamo namenski tab sa rich role-filter
        // UX-om i auto-refresh-om. "Sve" i "Iz nase banke" idu kroz objedinjenu
        // tabelu ispod (koja takodje sadrzi inter-bank redove kad je source='all').
        <OtcInterBankDiscoveryTab />
      ) : (
        <div className="space-y-6">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretrazi po tickeru, nazivu, prodavcu ili banci..."
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
                    {source === 'intra'
                      ? 'Drugi korisnici iz nase banke jos nisu stavili akcije na javni rezim.'
                      : 'Trenutno nema javnih akcija iz nase ni partnerskih banaka.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hartija</TableHead>
                      <TableHead>Banka</TableHead>
                      <TableHead>Trenutna cena</TableHead>
                      <TableHead>Dostupno javno</TableHead>
                      <TableHead>Prodavac</TableHead>
                      <TableHead className="text-right">Akcija</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const key = row.key;
                      const isOpen = openedKey === key;
                      const isSubmitting = submittingKey === key;
                      const anySubmittingOther = submittingKey !== null && submittingKey !== key;
                      const isInter = row.origin === 'inter';
                      // Bug 1 paritet: inter-bank hartija koju ne nosimo u svom
                      // sistemu dolazi sa currentPrice=0 — pregovor BE hard-fail-uje.
                      const interTradeBlocked = isInter && !(row.currentPrice > 0);
                      return (
                        <Fragment key={key}>
                          <TableRow>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold">{row.listingTicker}</span>
                                <span className="text-xs text-muted-foreground">{row.listingName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={isInter ? 'secondary' : 'outline'}
                                className="font-normal"
                              >
                                {isInter && <Building2 className="mr-1 h-3 w-3" />}
                                {row.bankLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatAmount(row.currentPrice)} {row.listingCurrency}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {row.publicQuantity != null
                                  ? `${row.availableQuantity} / ${row.publicQuantity}`
                                  : row.availableQuantity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{row.sellerName}</span>
                                {row.sellerRole && (
                                  <span className="text-xs text-muted-foreground">{row.sellerRole}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={isOpen ? 'secondary' : 'default'}
                                // T4A-012 + FIX FE-OTC-01: disable trigger dok je u toku
                                // submisija na bilo kom redu (anySubmittingOther) ILI na
                                // sopstvenom redu (isSubmitting). Inter-bank hartija bez
                                // cene (interTradeBlocked) takodje disable.
                                disabled={anySubmittingOther || isSubmitting || (!isOpen && interTradeBlocked)}
                                title={
                                  interTradeBlocked
                                    ? 'Hartija nije u nasem sistemu (cena nije dostupna) — pregovor trenutno nije moguc.'
                                    : undefined
                                }
                                onClick={() =>
                                  isOpen ? setOpenedKey(null) : openForListing(row)
                                }
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                {isOpen ? 'Zatvori' : interTradeBlocked ? 'Nedostupno' : 'Napravi ponudu'}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={6}>
                                <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-4">
                                  <div className="space-y-1">
                                    <Label htmlFor={`qty-${key}`}>Kolicina akcija</Label>
                                    <Input
                                      id={`qty-${key}`}
                                      type="number"
                                      min={1}
                                      max={row.availableQuantity}
                                      value={formState.quantity}
                                      onChange={(e) => setFormState((s) => ({ ...s, quantity: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`price-${key}`}>
                                      Cena po akciji ({row.listingCurrency})
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
                                      Premija ({row.listingCurrency})
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
                                      onClick={() => void submitOffer(row)}
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
