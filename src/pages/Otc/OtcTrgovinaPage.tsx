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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatAmount, getErrorMessage } from '@/utils/formatters';
import OtcInterBankDiscoveryTab from './OtcInterBankDiscoveryTab';

const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

interface OfferFormState {
  quantity: string;
  pricePerStock: string;
  premium: string;
  settlementDate: string;
}

/**
 * Portal: OTC Trgovina (intra-bank) — prikaz svih akcija koje drugi
 * korisnici javno nude. Inicijalizacija pregovora se vrsi klikom na
 * "Napravi ponudu" — otvara se formica i kreira se nova OtcOffer sa
 * trenutnim korisnikom kao kupcem.
 */
export default function OtcTrgovinaPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'local' | 'remote'>('local');
  const [listings, setListings] = useState<OtcListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [submittingListingId, setSubmittingListingId] = useState<number | null>(null);
  const [openedListingId, setOpenedListingId] = useState<number | null>(null);
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const openForListing = (listing: OtcListing) => {
    setOpenedListingId(listing.listingId);
    setFormState({
      quantity: String(Math.min(listing.availablePublicQuantity, 1)),
      pricePerStock: listing.currentPrice ? String(listing.currentPrice) : '',
      premium: '',
      settlementDate: addDaysISO(7),
    });
  };

  const submitOffer = async (listing: OtcListing) => {
    const qty = Number(formState.quantity);
    const price = Number(formState.pricePerStock);
    const premium = Number(formState.premium);

    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Kolicina mora biti pozitivan broj.');
      return;
    }
    if (qty > listing.availablePublicQuantity) {
      toast.error(`Dostupno je samo ${listing.availablePublicQuantity} akcija.`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Cena po akciji mora biti pozitivna.');
      return;
    }
    if (!Number.isFinite(premium) || premium <= 0) {
      toast.error('Premija mora biti pozitivna.');
      return;
    }
    if (!formState.settlementDate) {
      toast.error('Datum dospeca je obavezan.');
      return;
    }

    const payload: CreateOtcOfferRequest = {
      listingId: listing.listingId,
      sellerId: listing.sellerId,
      quantity: qty,
      pricePerStock: price,
      premium: premium,
      settlementDate: formState.settlementDate,
    };

    setSubmittingListingId(listing.listingId);
    try {
      await otcService.createOffer(payload);
      toast.success('Ponuda je poslata prodavcu.');
      setOpenedListingId(null);
      navigate('/otc/offers');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Neuspesno kreiranje ponude.'));
    } finally {
      setSubmittingListingId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <Handshake className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">OTC trgovina</h1>
          <p className="text-sm text-muted-foreground">
            Direktna kupoprodaja akcija unutar nase banke i kroz partnerske banke — bez provizije berze
          </p>
        </div>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          <strong>Kako funkcionise:</strong> na tabu "Iz nase banke" vidite javne OTC ponude korisnika iz nase
          banke, dok tab "Iz drugih banaka" prikazuje ponude partnerskih banaka. U oba slucaja kupac pravi ponudu
          (kolicina, cena po akciji, premija i datum dospeca), a druga strana je prihvata ili salje kontraponudu.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'local' | 'remote')}>
        <TabsList>
          <TabsTrigger value="local">Iz nase banke</TabsTrigger>
          <TabsTrigger value="remote">Iz drugih banaka</TabsTrigger>
        </TabsList>

        <TabsContent value="local">
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
                      {filtered.map((listing) => (
                        <Fragment key={listing.portfolioId}>
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
                                variant={openedListingId === listing.listingId ? 'secondary' : 'default'}
                                onClick={() =>
                                  openedListingId === listing.listingId
                                    ? setOpenedListingId(null)
                                    : openForListing(listing)
                                }
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                              >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                {openedListingId === listing.listingId ? 'Zatvori' : 'Napravi ponudu'}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {openedListingId === listing.listingId && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={5}>
                                <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-4">
                                  <div className="space-y-1">
                                    <Label htmlFor={`qty-${listing.listingId}`}>Kolicina akcija</Label>
                                    <Input
                                      id={`qty-${listing.listingId}`}
                                      type="number"
                                      min={1}
                                      max={listing.availablePublicQuantity}
                                      value={formState.quantity}
                                      onChange={(e) =>
                                        setFormState((s) => ({ ...s, quantity: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`price-${listing.listingId}`}>
                                      Cena po akciji ({listing.listingCurrency})
                                    </Label>
                                    <Input
                                      id={`price-${listing.listingId}`}
                                      type="number"
                                      step="0.01"
                                      value={formState.pricePerStock}
                                      onChange={(e) =>
                                        setFormState((s) => ({ ...s, pricePerStock: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`premium-${listing.listingId}`}>
                                      Premija ({listing.listingCurrency})
                                    </Label>
                                    <Input
                                      id={`premium-${listing.listingId}`}
                                      type="number"
                                      step="0.01"
                                      value={formState.premium}
                                      onChange={(e) =>
                                        setFormState((s) => ({ ...s, premium: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`date-${listing.listingId}`}>Datum dospeca</Label>
                                    <Input
                                      id={`date-${listing.listingId}`}
                                      type="date"
                                      min={addDaysISO(1)}
                                      value={formState.settlementDate}
                                      onChange={(e) =>
                                        setFormState((s) => ({ ...s, settlementDate: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 md:col-span-4">
                                    <Button variant="ghost" size="sm" onClick={() => setOpenedListingId(null)}>
                                      Odustani
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={submittingListingId === listing.listingId}
                                      onClick={() => void submitOffer(listing)}
                                      className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                                    >
                                      {submittingListingId === listing.listingId
                                        ? 'Slanje...'
                                        : 'Posalji ponudu prodavcu'}
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="remote">
          <OtcInterBankDiscoveryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
