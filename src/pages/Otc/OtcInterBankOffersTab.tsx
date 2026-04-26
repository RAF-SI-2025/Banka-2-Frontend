import { Fragment, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Check, Reply, X, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import interbankOtcService from '@/services/interbankOtcService';
import { accountService } from '@/services/accountService';
import type { Account } from '@/types/celina2';
import type {
  CounterOtcInterbankOfferRequest,
  OtcInterbankOffer,
} from '@/types/celina4';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { asArray, formatAmount, formatDateTime, getErrorMessage } from '@/utils/formatters';
import { computeOfferDeviation } from './otcOfferUtils';

type OpenState =
  | { type: 'accept'; offerId: string }
  | { type: 'counter'; offerId: string }
  | null;

type Props = {
  onAcceptedOffer?: () => void;
};

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background';

export default function OtcInterBankOffersTab({ onAcceptedOffer }: Props) {
  const { isAdmin, isAgent, isSupervisor } = useAuth();
  const isEmployee = isAdmin || isAgent || isSupervisor;

  const [offers, setOffers] = useState<OtcInterbankOffer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [openState, setOpenState] = useState<OpenState>(null);
  const [acceptAccountByOfferId, setAcceptAccountByOfferId] = useState<Record<string, string>>({});
  const [counterFormByOfferId, setCounterFormByOfferId] = useState<Record<string, CounterOtcInterbankOfferRequest>>(
    {},
  );

  const reloadOffers = async () => {
    setLoadingOffers(true);
    try {
      const data = await interbankOtcService.listMyOffers();
      setOffers(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje inter-bank ponuda.');
      setOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  };

  useEffect(() => {
    void reloadOffers();
    void (async () => {
      try {
        const list = isEmployee
          ? asArray<Account>(await accountService.getBankAccounts())
          : asArray<Account>(await accountService.getMyAccounts());
        setAccounts(list.filter((account) => account.status === 'ACTIVE'));
      } catch {
        setAccounts([]);
      }
    })();
  }, [isEmployee]);

  const activeOffers = useMemo(
    () => offers.filter((offer) => offer.status === 'ACTIVE'),
    [offers],
  );

  const pickMatchingAccount = (currency: string): Account | undefined =>
    accounts.find((account) => account.currency === currency) ?? accounts[0];

  const openAcceptForm = (offer: OtcInterbankOffer) => {
    const preferred = pickMatchingAccount(offer.listingCurrency);
    setAcceptAccountByOfferId((prev) => ({
      ...prev,
      [offer.offerId]: prev[offer.offerId] ?? String(preferred?.id ?? ''),
    }));
    setOpenState({ type: 'accept', offerId: offer.offerId });
  };

  const openCounterForm = (offer: OtcInterbankOffer) => {
    setCounterFormByOfferId((prev) => ({
      ...prev,
      [offer.offerId]:
        prev[offer.offerId] ?? {
          offerId: offer.offerId,
          quantity: offer.quantity,
          pricePerStock: offer.pricePerStock,
          premium: offer.premium,
          settlementDate: offer.settlementDate,
        },
    }));
    setOpenState({ type: 'counter', offerId: offer.offerId });
  };

  const updateCounterForm = (
    offerId: string,
    field: keyof CounterOtcInterbankOfferRequest,
    value: string,
  ) => {
    setCounterFormByOfferId((prev) => {
      const current = prev[offerId] ?? {
        offerId,
        quantity: 0,
        pricePerStock: 0,
        premium: 0,
        settlementDate: '',
      };

      const nextValue =
        field === 'settlementDate' || field === 'offerId'
          ? value
          : Number(value);

      return {
        ...prev,
        [offerId]: {
          ...current,
          [field]: nextValue,
        },
      };
    });
  };

  const handleAccept = async (offer: OtcInterbankOffer) => {
    const selectedAccountId = Number(acceptAccountByOfferId[offer.offerId]);
    if (!Number.isFinite(selectedAccountId) || selectedAccountId <= 0) {
      toast.error('Izaberite racun za placanje premije.');
      return;
    }

    setBusyOfferId(offer.offerId);
    try {
      await interbankOtcService.acceptOffer(offer.offerId, selectedAccountId);
      toast.success('Inter-bank ponuda je prihvacena.');
      setOpenState(null);
      await reloadOffers();
      onAcceptedOffer?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Prihvatanje inter-bank ponude nije uspelo.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  const handleCounter = async (offer: OtcInterbankOffer) => {
    const form = counterFormByOfferId[offer.offerId];
    if (!form) {
      toast.error('Popunite sve vrednosti kontraponude.');
      return;
    }
    if (!Number.isFinite(form.quantity) || form.quantity <= 0) {
      toast.error('Kolicina mora biti pozitivan broj.');
      return;
    }
    if (!Number.isFinite(form.pricePerStock) || form.pricePerStock <= 0) {
      toast.error('Cena po akciji mora biti pozitivan broj.');
      return;
    }
    if (!Number.isFinite(form.premium) || form.premium <= 0) {
      toast.error('Premija mora biti pozitivan broj.');
      return;
    }
    if (!form.settlementDate) {
      toast.error('Datum dospeca je obavezan.');
      return;
    }

    setBusyOfferId(offer.offerId);
    try {
      await interbankOtcService.counterOffer(offer.offerId, form);
      toast.success('Inter-bank kontraponuda je poslata.');
      setOpenState(null);
      await reloadOffers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Slanje inter-bank kontraponude nije uspelo.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  const handleDecline = async (offer: OtcInterbankOffer) => {
    if (!window.confirm('Sigurno zelite da odbijete ovu inter-bank ponudu?')) {
      return;
    }

    setBusyOfferId(offer.offerId);
    try {
      await interbankOtcService.declineOffer(offer.offerId);
      toast.success('Inter-bank ponuda je odbijena.');
      await reloadOffers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Odbijanje inter-bank ponude nije uspelo.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Aktivne inter-bank ponude</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOffers ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : activeOffers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Trenutno nemate aktivnih inter-bank pregovora.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banka kupca / prodavca</TableHead>
                  <TableHead>Hartija</TableHead>
                  <TableHead>Kolicina</TableHead>
                  <TableHead>Cena / Premija</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Waiting on</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOffers.map((offer) => {
                  const deviation = computeOfferDeviation(offer.pricePerStock, offer.currentPrice);
                  const isAcceptOpen = openState?.type === 'accept' && openState.offerId === offer.offerId;
                  const isCounterOpen = openState?.type === 'counter' && openState.offerId === offer.offerId;

                  return (
                    <Fragment key={offer.offerId}>
                      <TableRow className={deviation?.rowClass}>
                        <TableCell className="text-sm">
                          <div>Kupac: {offer.buyerBankCode}</div>
                          <div className="text-muted-foreground">Prodavac: {offer.sellerBankCode}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{offer.listingTicker}</span>
                            <span className="text-xs text-muted-foreground">{offer.listingName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{offer.quantity}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <span>
                              {formatAmount(offer.pricePerStock)} {offer.listingCurrency}
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
                        <TableCell className="text-sm">
                          <div>{offer.settlementDate}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(offer.lastModifiedAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={offer.myTurn ? 'warning' : 'secondary'}>
                              {offer.myTurn ? 'Moj red' : 'Ceka drugu stranu'}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {offer.waitingOnBankCode} / {offer.waitingOnUserId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {offer.myTurn ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                disabled={busyOfferId === offer.offerId}
                                onClick={() =>
                                  isAcceptOpen ? setOpenState(null) : openAcceptForm(offer)
                                }
                                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                Prihvati
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyOfferId === offer.offerId}
                                onClick={() =>
                                  isCounterOpen ? setOpenState(null) : openCounterForm(offer)
                                }
                              >
                                <Reply className="mr-1 h-3.5 w-3.5" />
                                Kontraponuda
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyOfferId === offer.offerId}
                                onClick={() => void handleDecline(offer)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="mr-1 h-3.5 w-3.5" />
                                Odbij
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isAcceptOpen && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7}>
                            <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-[minmax(0,1fr)_auto]">
                              <div className="space-y-1">
                                <Label htmlFor={`remote-accept-account-${offer.offerId}`}>
                                  Racun za placanje premije
                                </Label>
                                <select
                                  id={`remote-accept-account-${offer.offerId}`}
                                  value={acceptAccountByOfferId[offer.offerId] ?? ''}
                                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                    setAcceptAccountByOfferId((prev) => ({
                                      ...prev,
                                      [offer.offerId]: event.target.value,
                                    }))
                                  }
                                  className={selectClassName}
                                >
                                  <option value="">Izaberite racun</option>
                                  {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.accountNumber} ({account.currency})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex justify-end gap-2 md:items-end">
                                <Button size="sm" variant="ghost" onClick={() => setOpenState(null)}>
                                  Odustani
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={busyOfferId === offer.offerId}
                                  onClick={() => void handleAccept(offer)}
                                  className="bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                                >
                                  Potvrdi prihvatanje
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {isCounterOpen && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7}>
                            <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-4">
                              <div className="space-y-1">
                                <Label htmlFor={`remote-counter-qty-${offer.offerId}`}>Kolicina</Label>
                                <Input
                                  id={`remote-counter-qty-${offer.offerId}`}
                                  type="number"
                                  min={1}
                                  value={String(counterFormByOfferId[offer.offerId]?.quantity ?? offer.quantity)}
                                  onChange={(event) =>
                                    updateCounterForm(offer.offerId, 'quantity', event.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`remote-counter-price-${offer.offerId}`}>
                                  Cena po akciji ({offer.listingCurrency})
                                </Label>
                                <Input
                                  id={`remote-counter-price-${offer.offerId}`}
                                  type="number"
                                  step="0.01"
                                  value={String(
                                    counterFormByOfferId[offer.offerId]?.pricePerStock ?? offer.pricePerStock,
                                  )}
                                  onChange={(event) =>
                                    updateCounterForm(offer.offerId, 'pricePerStock', event.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`remote-counter-premium-${offer.offerId}`}>
                                  Premija ({offer.listingCurrency})
                                </Label>
                                <Input
                                  id={`remote-counter-premium-${offer.offerId}`}
                                  type="number"
                                  step="0.01"
                                  value={String(counterFormByOfferId[offer.offerId]?.premium ?? offer.premium)}
                                  onChange={(event) =>
                                    updateCounterForm(offer.offerId, 'premium', event.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`remote-counter-date-${offer.offerId}`}>Dospece</Label>
                                <Input
                                  id={`remote-counter-date-${offer.offerId}`}
                                  type="date"
                                  value={String(
                                    counterFormByOfferId[offer.offerId]?.settlementDate ?? offer.settlementDate,
                                  )}
                                  onChange={(event) =>
                                    updateCounterForm(offer.offerId, 'settlementDate', event.target.value)
                                  }
                                />
                              </div>
                              <div className="md:col-span-4 flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setOpenState(null)}>
                                  Odustani
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={busyOfferId === offer.offerId}
                                  onClick={() => void handleCounter(offer)}
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

      {accounts.length === 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nemate aktivan racun za placanje premije, pa prihvatanje inter-bank ponude nece biti moguce.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
