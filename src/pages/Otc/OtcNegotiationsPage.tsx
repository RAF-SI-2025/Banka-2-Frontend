import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Handshake, Reply, X } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import otcService from '@/services/otcService';
import { accountService } from '@/services/accountService';
import type { OtcOffer, CounterOtcOfferRequest } from '@/types/celina3';
import type { Account } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { asArray, formatAmount, getErrorMessage, getPreferredAccount } from '@/utils/formatters';
import { computeOfferDeviation } from './otcOfferUtils';
import { createIsMeMatcher } from './otcUtils';
import OtcSourceFilterChip, { type OtcSource } from '@/components/otc/OtcSourceFilterChip';
import OtcSubHero from '@/components/otc/OtcSubHero';
import OtcInterBankOffersTab from './OtcInterBankOffersTab';

// FIX FE-OTC-05: kljuc za Discord-style "neprocitano" merenje za intra-bank
// pregovore. Inter-bank tab koristi isti kljuc (`otc:lastEntrance`) tako da
// jedan vremenski snapshot pokriva oba kanala (paritet sa starim ponasanjem
// pre cleanup-a 24.05).
const LAST_ENTRANCE_KEY = 'otc:lastEntrance';

export default function OtcNegotiationsPage() {
  const { user, isAdmin, isAgent, isSupervisor } = useAuth();
  const isEmployee = isAdmin || isAgent || isSupervisor;
  // FIX FE-OTC-03: shared isMe matcher (JWT id + normalizovano ime fallback).
  const isMe = useMemo(() => createIsMeMatcher(user), [user]);
  const [source, setSource] = useState<OtcSource>('all');
  const [offers, setOffers] = useState<OtcOffer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
  const [openedOfferId, setOpenedOfferId] = useState<number | null>(null);
  const [counterFormByOfferId, setCounterFormByOfferId] = useState<Record<number, CounterOtcOfferRequest>>({});

  // FIX FE-OTC-05: capture timestamp pre nego sto user vidi listu (Discord-style
  // unread). Cuvamo "snapshot at mount" izvan localStorage-a da ne smetamo
  // inter-bank tab parent-u (`OtcInterBankOffersTab` koji cita isti kljuc).
  const [unreadBaselineTs] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = window.localStorage.getItem(LAST_ENTRANCE_KEY);
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  });

  // FE-OTC-02 fix: useCallback + cancelled flag (pattern iz OtcContractsPage)
  // — prevenira state update posle unmount-a i daje stabilne reference za
  // hooks deps liste / external call-eve.
  const reloadAccounts = useCallback(async () => {
    try {
      const list = isEmployee
        ? asArray<Account>(await accountService.getBankAccounts())
        : asArray<Account>(await accountService.getMyAccounts());
      setAccounts(list.filter((a) => a.status === 'ACTIVE'));
    } catch {
      setAccounts([]);
    }
  }, [isEmployee]);

  const reloadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await otcService.listMyActiveOffers();
      setOffers(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje ponuda.');
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await otcService.listMyActiveOffers();
        if (!cancelled) setOffers(data ?? []);
      } catch {
        if (!cancelled) {
          toast.error('Neuspesno ucitavanje ponuda.');
          setOffers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const list = isEmployee
          ? asArray<Account>(await accountService.getBankAccounts())
          : asArray<Account>(await accountService.getMyAccounts());
        if (!cancelled) setAccounts(list.filter((a) => a.status === 'ACTIVE'));
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEmployee]);

  const activeOffers = useMemo(
    () => offers.filter((o) => o.status === 'ACTIVE'),
    [offers],
  );

  const handleAccept = async (offer: OtcOffer) => {
    setBusyOfferId(offer.id);
    try {
      // Fix iz vece-2: ako trenutni korisnik nije kupac (npr seller koji prihvata
      // counter-offer), ne saljemo accountId — BE auto-resolve buyer-ov racun.
      // FIX FE-OTC-03: koristimo shared isMe (id + ime fallback).
      const currentIsBuyer = isMe(offer.buyerId, offer.buyerName);
      let buyerAccountId: number | undefined;
      if (currentIsBuyer) {
        const preferred = getPreferredAccount(accounts, offer.listingCurrency);
        if (!preferred) {
          toast.error('Nemate nijedan aktivan racun za placanje premije.');
          setBusyOfferId(null);
          return;
        }
        buyerAccountId = preferred.id;
      }
      await otcService.acceptOffer(offer.id, buyerAccountId);
      toast.success('Ponuda je prihvacena, opcioni ugovor je sklopljen. Premija je preneta sa racuna.');
      // T4A-002 fix: posle accept premija je preneta (skinuta sa kupca, dodata na prodavca),
      // pa moramo refresh-ovati accounts da kartica u sidebar-u prikaze novo stanje.
      await Promise.all([reloadOffers(), reloadAccounts()]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Prihvatanje ponude nije uspelo.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  const handleDecline = async (offer: OtcOffer) => {
    if (!window.confirm('Sigurno zelite da otkazete ovaj pregovor?')) return;
    setBusyOfferId(offer.id);
    try {
      await otcService.declineOffer(offer.id);
      toast.success('Pregovor je otkazan.');
      await reloadOffers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Otkazivanje nije uspelo.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  const openCounterForm = (offer: OtcOffer) => {
    setOpenedOfferId(offer.id);
    setCounterFormByOfferId((prev) => ({
      ...prev,
      [offer.id]: {
        quantity: offer.quantity,
        pricePerStock: offer.pricePerStock,
        premium: offer.premium,
        settlementDate: offer.settlementDate,
      },
    }));
  };

  const handleCounter = async (offer: OtcOffer) => {
    const form = counterFormByOfferId[offer.id];
    if (!form) { toast.error('Popunite sve vrednosti kontraponude.'); return; }
    // R1 477: validacija kontraponude pre slanja (qty/cena/premija/datum).
    const qty = Number(form.quantity);
    const price = Number(form.pricePerStock);
    const premium = Number(form.premium);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Kolicina mora biti pozitivan ceo broj.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Cena po hartiji mora biti pozitivan broj.');
      return;
    }
    if (!Number.isFinite(premium) || premium < 0) {
      toast.error('Premija ne sme biti negativna.');
      return;
    }
    if (!form.settlementDate) {
      toast.error('Datum poravnanja je obavezan.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const settle = new Date(form.settlementDate);
    if (Number.isNaN(settle.getTime()) || settle < today) {
      toast.error('Datum poravnanja mora biti danas ili u buducnosti.');
      return;
    }
    setBusyOfferId(offer.id);
    try {
      await otcService.counterOffer(offer.id, form);
      toast.success('Kontraponuda je poslata drugoj strani.');
      setOpenedOfferId(null);
      await reloadOffers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Slanje kontraponude nije uspelo.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  const updateCounterForm = (offerId: number, field: keyof CounterOtcOfferRequest, value: string) => {
    setCounterFormByOfferId((prev) => {
      const current = prev[offerId] ?? { quantity: 1, pricePerStock: 0, premium: 0, settlementDate: '' };
      const numeric = field !== 'settlementDate' ? Number(value) : value;
      return { ...prev, [offerId]: { ...current, [field]: numeric } };
    });
  };

  const myTurnCount = activeOffers.filter((o) => o.myTurn).length;
  const asBuyerCount = activeOffers.filter((o) => isMe(o.buyerId, o.buyerName)).length;
  const asSellerCount = activeOffers.filter((o) => isMe(o.sellerId, o.sellerName)).length;

  // FIX FE-OTC-05: count "neprocitano" — aktivne ponude koje je druga strana
  // izmenila posle poslednjeg ulaska, i sad cekaju nas. Heuristika: lastModifiedById
  // nije nas, ts > unreadBaselineTs (capture-d na mount-u). Paritet sa
  // OtcInterBankOffersTab pattern-om.
  const unreadCount = useMemo(() => {
    if (loading) return 0;
    return activeOffers.filter((o) => {
      if (isMe(o.lastModifiedById, '')) return false;
      const ts = Date.parse(o.lastModifiedAt);
      return Number.isFinite(ts) && ts > unreadBaselineTs;
    }).length;
  }, [activeOffers, loading, isMe, unreadBaselineTs]);

  // FIX FE-OTC-05: posle prvog render-a azuriraj `otc:lastEntrance` (sa malim
  // delay-em da unread baseline iznad pokrije prikazan red, kao Discord/Slack).
  // Inter-bank tab cita isti kljuc — ovde sinhronizujemo oba kanala.
  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(LAST_ENTRANCE_KEY, String(Date.now()));
      } catch {
        // localStorage moze biti onemogucen u nekim iframe context-ima
      }
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [loading]);

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      <OtcSubHero
        icon={Handshake}
        title="Moji pregovori"
        description="Aktivne OTC ponude u kojima si kupac ili prodavac. Tvoj red znaci da druga strana ceka tvoj odgovor."
        gradientFrom="from-emerald-500"
        gradientTo="to-teal-600"
        kpis={source === 'inter' ? undefined : [
          { label: 'Aktivnih', value: String(activeOffers.length) },
          { label: 'Tvoj red', value: String(myTurnCount), tone: myTurnCount > 0 ? 'warning' : 'default' },
          { label: 'Neprocitano', value: String(unreadCount), tone: unreadCount > 0 ? 'warning' : 'default' },
          { label: 'Kao kupac', value: String(asBuyerCount) },
          { label: 'Kao prodavac', value: String(asSellerCount) },
        ]}
      />

      <OtcSourceFilterChip value={source} onChange={setSource} />

      {/* Source chip upravlja DVA disjunktna izvora (intra: GET /otc/offers/active,
          trading-service; inter: GET /interbank/otc/offers/my, banka-core). "Sve"
          mora prikazati OBA — pa render nije binarni vec dva nezavisna uslova:
          intra kartica kad je source 'all'|'intra', inter tab kad je 'all'|'inter'. */}
      {(source === 'all' || source === 'intra') && (
        <Card>
          <CardHeader>
            <CardTitle>Moji aktivni pregovori (intra-bank)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : activeOffers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Trenutno nemate aktivnih pregovora. Idite na <strong>Pretrazi</strong> da pokrenete nov pregovor.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hartija</TableHead>
                    <TableHead>Kupac / Prodavac</TableHead>
                    <TableHead>Kolicina</TableHead>
                    <TableHead>Cena / Premija</TableHead>
                    <TableHead>Dospece</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOffers.map((offer) => {
                    const deviation = computeOfferDeviation(offer.pricePerStock, offer.currentPrice);
                    return (
                    <Fragment key={offer.id}>
                      <TableRow className={deviation?.rowClass}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{offer.listingTicker}</span>
                            <span className="text-xs text-muted-foreground">{offer.listingName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span>Kupac: {offer.buyerName}</span>
                              {isMe(offer.buyerId, offer.buyerName) && (
                                <Badge variant="info" className="text-[10px] px-1 py-0 h-4">VI</Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1.5">
                              <span>Prodavac: {offer.sellerName}</span>
                              {isMe(offer.sellerId, offer.sellerName) && (
                                <Badge variant="info" className="text-[10px] px-1 py-0 h-4">VI</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{offer.quantity}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <span>{formatAmount(offer.pricePerStock)} / {offer.listingCurrency}</span>
                            {deviation && (
                              <Badge variant="outline" className={`text-[10px] font-semibold ${deviation.badgeClass}`}>
                                {deviation.label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            Prem: {formatAmount(offer.premium)} {offer.listingCurrency}
                          </div>
                        </TableCell>
                        <TableCell>{offer.settlementDate}</TableCell>
                        <TableCell>
                          {offer.myTurn ? (
                            <Badge variant="warning">Moj red</Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              title={`Ceka da ${offer.waitingOnUserId === offer.buyerId ? offer.buyerName : offer.sellerName} odgovori`}
                            >
                              Ceka {offer.waitingOnUserId === offer.buyerId ? 'kupca' : 'prodavca'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {offer.myTurn && (
                              <Button
                                size="sm" variant="default"
                                disabled={busyOfferId === offer.id}
                                onClick={() => handleAccept(offer)}
                                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Prihvati
                              </Button>
                            )}
                            {offer.myTurn && (
                              <Button
                                size="sm" variant="outline"
                                disabled={busyOfferId === offer.id}
                                onClick={() =>
                                  openedOfferId === offer.id ? setOpenedOfferId(null) : openCounterForm(offer)
                                }
                              >
                                <Reply className="h-3.5 w-3.5 mr-1" />
                                Kontraponuda
                              </Button>
                            )}
                            <Button
                              size="sm" variant="ghost"
                              disabled={busyOfferId === offer.id}
                              onClick={() => handleDecline(offer)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Otkazi
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {openedOfferId === offer.id && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-2">
                              <div className="space-y-1">
                                <Label htmlFor={`cq-${offer.id}`}>Kolicina</Label>
                                <Input
                                  id={`cq-${offer.id}`} type="number" min={1}
                                  value={String(counterFormByOfferId[offer.id]?.quantity ?? offer.quantity)}
                                  onChange={(e) => updateCounterForm(offer.id, 'quantity', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`cp-${offer.id}`}>Cena ({offer.listingCurrency})</Label>
                                <Input
                                  id={`cp-${offer.id}`} type="number" step="0.01"
                                  value={String(counterFormByOfferId[offer.id]?.pricePerStock ?? offer.pricePerStock)}
                                  onChange={(e) => updateCounterForm(offer.id, 'pricePerStock', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`cpm-${offer.id}`}>Premija</Label>
                                <Input
                                  id={`cpm-${offer.id}`} type="number" step="0.01"
                                  value={String(counterFormByOfferId[offer.id]?.premium ?? offer.premium)}
                                  onChange={(e) => updateCounterForm(offer.id, 'premium', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`csd-${offer.id}`}>Dospece</Label>
                                <Input
                                  id={`csd-${offer.id}`} type="date"
                                  value={String(counterFormByOfferId[offer.id]?.settlementDate ?? offer.settlementDate)}
                                  onChange={(e) => updateCounterForm(offer.id, 'settlementDate', e.target.value)}
                                />
                              </div>
                              <div className="flex justify-end gap-2 md:col-span-4">
                                <Button variant="ghost" size="sm" onClick={() => setOpenedOfferId(null)}>
                                  Odustani
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={busyOfferId === offer.id}
                                  onClick={() => handleCounter(offer)}
                                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                                >
                                  Posalji kontraponudu
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
      )}

      {(source === 'all' || source === 'inter') && (
        <OtcInterBankOffersTab />
      )}
    </div>
  );
}
