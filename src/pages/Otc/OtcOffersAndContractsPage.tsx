import { Fragment, useEffect, useMemo, useState } from 'react';
import { ScrollText, Zap, Reply, X, Check, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import otcService from '@/services/otcService';
import { accountService } from '@/services/accountService';
import type {
  OtcOffer,
  OtcContract,
  OtcContractStatus,
  CounterOtcOfferRequest,
} from '@/types/celina3';
import type { Account } from '@/types/celina2';
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
import { formatAmount, formatDateTime, asArray, getErrorMessage } from '@/utils/formatters';
import OtcInterBankContractsTab from './OtcInterBankContractsTab';

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktivan',
  EXERCISED: 'Iskoriscen',
  EXPIRED: 'Istekao',
};

const statusBadgeVariant = (status: string): 'success' | 'secondary' | 'destructive' | 'warning' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ACCEPTED' || status === 'EXERCISED') return 'secondary';
  if (status === 'EXPIRED') return 'warning';
  return 'destructive';
};

/**
 * Spec (Celina 4): zeleno ≤ ±5% odstupanja cene ponude od trzisne cene,
 * zuto ±5-20%, crveno > ±20%. Vraca klase za pozadinu reda + labelu.
 */
type OfferDeviation = {
  percent: number;
  label: string;
  rowClass: string;
  badgeClass: string;
};

function computeOfferDeviation(
  pricePerStock: number,
  currentPrice: number | null | undefined,
): OfferDeviation | null {
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }
  const pct = ((pricePerStock - currentPrice) / currentPrice) * 100;
  const abs = Math.abs(pct);
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
  const label = `${sign}${abs.toFixed(1)}%`;
  if (abs <= 5) {
    return {
      percent: pct,
      label,
      rowClass: 'bg-emerald-500/5 hover:bg-emerald-500/10',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    };
  }
  if (abs <= 20) {
    return {
      percent: pct,
      label,
      rowClass: 'bg-amber-500/5 hover:bg-amber-500/10',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }
  return {
    percent: pct,
    label,
    rowClass: 'bg-red-500/5 hover:bg-red-500/10',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  };
}

type Tab = 'offers' | 'contracts' | 'contracts-remote';

export default function OtcOffersAndContractsPage() {
  const { isAdmin, isAgent, isSupervisor } = useAuth();
  const isEmployee = isAdmin || isAgent || isSupervisor;
  const [tab, setTab] = useState<Tab>('offers');

  const [offers, setOffers] = useState<OtcOffer[]>([]);
  const [contracts, setContracts] = useState<OtcContract[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contractsFilter, setContractsFilter] = useState<OtcContractStatus | 'ALL'>('ALL');
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
  const [busyContractId, setBusyContractId] = useState<number | null>(null);
  const [counterFormByOfferId, setCounterFormByOfferId] = useState<Record<number, CounterOtcOfferRequest>>({});
  const [openedOfferId, setOpenedOfferId] = useState<number | null>(null);

  const reloadOffers = async () => {
    setLoadingOffers(true);
    try {
      const data = await otcService.listMyActiveOffers();
      setOffers(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje ponuda.');
      setOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  };

  const reloadContracts = async (filter: OtcContractStatus | 'ALL' = contractsFilter) => {
    setLoadingContracts(true);
    try {
      const data = await otcService.listMyContracts(filter);
      setContracts(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje ugovora.');
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  useEffect(() => {
    reloadOffers();
    reloadContracts();
    (async () => {
      try {
        const list = isEmployee
          ? asArray<Account>(await accountService.getBankAccounts())
          : asArray<Account>(await accountService.getMyAccounts());
        setAccounts(list.filter((a) => a.status === 'ACTIVE'));
      } catch {
        setAccounts([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployee]);

  const pickMatchingAccount = (currency: string): Account | undefined =>
    accounts.find((a) => a.currency === currency) ?? accounts[0];

  const handleAccept = async (offer: OtcOffer) => {
    const buyerAccount = pickMatchingAccount(offer.listingCurrency);
    if (!buyerAccount) {
      toast.error('Nemate nijedan aktivan racun za placanje premije.');
      return;
    }
    setBusyOfferId(offer.id);
    try {
      await otcService.acceptOffer(offer.id, buyerAccount.id);
      toast.success('Ponuda je prihvacena, opcioni ugovor je sklopljen.');
      await Promise.all([reloadOffers(), reloadContracts()]);
      setTab('contracts');
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

  const handleCounter = async (offer: OtcOffer) => {
    const form = counterFormByOfferId[offer.id];
    if (!form) {
      toast.error('Popunite sve vrednosti kontraponude.');
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

  const openCounterForm = (offer: OtcOffer) => {
    setOpenedOfferId(offer.id);
    setCounterFormByOfferId((prev) => ({
      ...prev,
      [offer.id]:
        prev[offer.id] ?? {
          quantity: offer.quantity,
          pricePerStock: offer.pricePerStock,
          premium: offer.premium,
          settlementDate: offer.settlementDate,
        },
    }));
  };

  const updateCounterForm = (offerId: number, field: keyof CounterOtcOfferRequest, value: string) => {
    setCounterFormByOfferId((prev) => {
      const current = prev[offerId] ?? {
        quantity: 0,
        pricePerStock: 0,
        premium: 0,
        settlementDate: '',
      };
      let nextValue: string | number = value;
      if (field !== 'settlementDate') {
        nextValue = Number(value);
      }
      return { ...prev, [offerId]: { ...current, [field]: nextValue } };
    });
  };

  const handleExercise = async (contract: OtcContract) => {
    if (!window.confirm(`Iskoristiti ugovor za ${contract.quantity} x ${contract.listingTicker}?`)) {
      return;
    }
    const buyerAccount = pickMatchingAccount(contract.listingCurrency);
    if (!buyerAccount) {
      toast.error('Nemate nijedan aktivan racun za placanje strike cene.');
      return;
    }
    setBusyContractId(contract.id);
    try {
      await otcService.exerciseContract(contract.id, buyerAccount.id);
      toast.success('Opcioni ugovor je iskoriscen — akcije su prebacene.');
      await reloadContracts(contractsFilter);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Iskoriscavanje nije uspelo.'));
    } finally {
      setBusyContractId(null);
    }
  };

  const activeOffers = useMemo(
    () => offers.filter((o) => o.status === 'ACTIVE'),
    [offers],
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">OTC ponude i ugovori</h1>
          <p className="text-sm text-muted-foreground">
            Pregovori u toku i sklopljeni opcioni ugovori za OTC trgovinu
          </p>
        </div>
      </div>

      <div
        className="flex gap-1 bg-muted/60 dark:bg-slate-800/60 p-1 rounded-xl border border-border/50 w-fit"
        role="tablist"
        aria-label="OTC ponude i ugovori tabovi"
      >
        <button
          type="button"
          onClick={() => setTab('offers')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'offers'
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          role="tab"
          aria-selected={tab === 'offers'}
        >
          Aktivne ponude
          {activeOffers.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeOffers.length}
            </Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('contracts')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'contracts'
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          role="tab"
          aria-selected={tab === 'contracts'}
        >
          Sklopljeni ugovori
        </button>
        <button
          type="button"
          onClick={() => setTab('contracts-remote')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'contracts-remote'
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          role="tab"
          aria-selected={tab === 'contracts-remote'}
        >
          Sklopljeni ugovori (inter-bank)
        </button>
      </div>

      {tab === 'offers' && (
        <Card>
          <CardHeader>
            <CardTitle>Moji aktivni pregovori</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOffers ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : activeOffers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Trenutno nemate aktivnih pregovora. Idite na OTC trgovinu da pokrenete nov pregovor.
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
                    <TableHead>Poslednja izmena</TableHead>
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
                          <div className="text-sm">
                            <div>Kupac: {offer.buyerName}</div>
                            <div className="text-muted-foreground">Prodavac: {offer.sellerName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{offer.quantity}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <span>
                              {formatAmount(offer.pricePerStock)} / {offer.listingCurrency}
                            </span>
                            {deviation && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold ${deviation.badgeClass}`}
                                title={`Odstupanje od trzisne cene (${offer.currentPrice} ${offer.listingCurrency})`}
                              >
                                {deviation.label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            Prem: {formatAmount(offer.premium)} {offer.listingCurrency}
                          </div>
                        </TableCell>
                        <TableCell>{offer.settlementDate}</TableCell>
                        <TableCell className="text-xs">
                          <div>{offer.lastModifiedByName}</div>
                          <div className="text-muted-foreground">
                            {formatDateTime(offer.lastModifiedAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={offer.myTurn ? 'warning' : 'secondary'}>
                            {offer.myTurn ? 'Moj red' : 'Ceka drugu stranu'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {offer.myTurn && (
                              <Button
                                size="sm"
                                variant="default"
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
                                size="sm"
                                variant="outline"
                                disabled={busyOfferId === offer.id}
                                onClick={() =>
                                  openedOfferId === offer.id
                                    ? setOpenedOfferId(null)
                                    : openCounterForm(offer)
                                }
                              >
                                <Reply className="h-3.5 w-3.5 mr-1" />
                                Kontraponuda
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
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
                          <TableCell colSpan={8}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-2">
                              <div className="space-y-1">
                                <Label htmlFor={`cq-${offer.id}`}>Kolicina</Label>
                                <Input
                                  id={`cq-${offer.id}`}
                                  type="number"
                                  min={1}
                                  value={String(counterFormByOfferId[offer.id]?.quantity ?? offer.quantity)}
                                  onChange={(e) => updateCounterForm(offer.id, 'quantity', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`cp-${offer.id}`}>
                                  Cena po akciji ({offer.listingCurrency})
                                </Label>
                                <Input
                                  id={`cp-${offer.id}`}
                                  type="number"
                                  step="0.01"
                                  value={String(counterFormByOfferId[offer.id]?.pricePerStock ?? offer.pricePerStock)}
                                  onChange={(e) => updateCounterForm(offer.id, 'pricePerStock', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`cpm-${offer.id}`}>Premija ({offer.listingCurrency})</Label>
                                <Input
                                  id={`cpm-${offer.id}`}
                                  type="number"
                                  step="0.01"
                                  value={String(counterFormByOfferId[offer.id]?.premium ?? offer.premium)}
                                  onChange={(e) => updateCounterForm(offer.id, 'premium', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`csd-${offer.id}`}>Dospece</Label>
                                <Input
                                  id={`csd-${offer.id}`}
                                  type="date"
                                  value={String(counterFormByOfferId[offer.id]?.settlementDate ?? offer.settlementDate)}
                                  onChange={(e) => updateCounterForm(offer.id, 'settlementDate', e.target.value)}
                                />
                              </div>
                              <div className="md:col-span-4 flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setOpenedOfferId(null)}
                                >
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

      {tab === 'contracts' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Opcioni ugovori</CardTitle>
            <div className="flex gap-1">
              {(['ALL', 'ACTIVE', 'EXERCISED', 'EXPIRED'] as Array<OtcContractStatus | 'ALL'>).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setContractsFilter(s);
                    reloadContracts(s);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    contractsFilter === s
                      ? 'bg-indigo-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {s === 'ALL' ? 'Svi' : CONTRACT_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loadingContracts ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : contracts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nema sklopljenih ugovora.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hartija</TableHead>
                    <TableHead>Kupac / Prodavac</TableHead>
                    <TableHead>Kolicina</TableHead>
                    <TableHead>Strike / Premija</TableHead>
                    <TableHead>Trenutna cena</TableHead>
                    <TableHead>Dospece</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcija</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => {
                    const inTheMoney = c.currentPrice != null && c.strikePrice < c.currentPrice;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{c.listingTicker}</span>
                            <span className="text-xs text-muted-foreground">{c.listingName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>Kupac: {c.buyerName}</div>
                          <div className="text-muted-foreground">Prodavac: {c.sellerName}</div>
                        </TableCell>
                        <TableCell className="font-mono">{c.quantity}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div>
                            {formatAmount(c.strikePrice)} {c.listingCurrency}
                          </div>
                          <div className="text-muted-foreground">
                            Prem: {formatAmount(c.premium)} {c.listingCurrency}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {c.currentPrice != null ? (
                            <span className={inTheMoney ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                              {formatAmount(c.currentPrice)} {c.listingCurrency}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{c.settlementDate}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(c.status)}>
                            {CONTRACT_STATUS_LABEL[c.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === 'ACTIVE' ? (
                            <Button
                              size="sm"
                              disabled={busyContractId === c.id}
                              onClick={() => handleExercise(c)}
                              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                            >
                              <Zap className="h-3.5 w-3.5 mr-1" />
                              {busyContractId === c.id ? 'Izvrsavanje...' : 'Iskoristi'}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'contracts-remote' && <OtcInterBankContractsTab />}

      {accounts.length === 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nemate aktivan racun — placanje premije i strike cene nece biti moguce.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
