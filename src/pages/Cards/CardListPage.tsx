// Ova stranica prikazuje sve kartice ulogovanog korisnika.
// - cardService.getMyCards() za fetch
// - Kartice prikazati vizuelno (card-like UI sa brojem, tipom, statusom)
// - Akcije: blokiraj, deblokiraj, deaktiviraj, promeni limit
// - Maskiran broj kartice (**** **** **** 1234)
// - Zahtev za novu karticu: cardService.create({ accountNumber, cardType })
//   => email verifikacija (cardService.requestCardVerification)
// - Tipovi kartica: VISA, MASTERCARD, DINACARD, AMERICAN_EXPRESS
// - Za poslovni racun: kartica se pravi za ovlasceno lice (AuthorizedPerson)
//   => cardService.getAuthorizedPersons(accountNumber) za dropdown
// - Max kartice: 2 po licnom racunu, 1 po ovlascenom licu za poslovni
// - Spec: "Kartice" iz Celine 2
// - Luhn validacija za prikaz (16 cifara)

import { useEffect, useState } from 'react';
import { toast } from '@/lib/notify';
import { cardService } from '@/services/cardService';
import type { Card } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2 } from 'lucide-react';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function maskCardNumber(number: string): string {
  const last4 = number.slice(-4);
  return `**** **** **** ${last4}`;
}

function statusBadgeVariant(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'BLOCKED') return 'warning' as const;
  if (status === 'DEACTIVATED') return 'secondary' as const;
  return 'secondary' as const;
}

function statusLabel(status: string): string {
  if (status === 'ACTIVE') return 'Aktivna';
  if (status === 'BLOCKED') return 'Blokirana';
  if (status === 'DEACTIVATED') return 'Deaktivirana';
  return status;
}

function cardGradient(cardType: string): string {
  if (cardType === 'VISA') return 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white';
  if (cardType === 'MASTERCARD') return 'bg-gradient-to-br from-red-500 to-orange-600 text-white';
  if (cardType === 'DINACARD') return 'bg-gradient-to-br from-emerald-600 to-green-700 text-white';
  return 'bg-gradient-to-br from-slate-600 to-slate-800 text-white';
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS');
}

export default function CardListPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingCardId, setProcessingCardId] = useState<number | null>(null);

  const loadCards = async () => {
    setLoading(true);
    try {
      const data = await cardService.getMyCards();
      setCards(asArray<Card>(data));
    } catch {
      toast.error('Neuspešno učitavanje kartica.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const runCardAction = async (cardId: number, action: 'block' | 'unblock' | 'deactivate' | 'limit') => {
    setProcessingCardId(cardId);
    try {
      if (action === 'block') {
        await cardService.block(cardId);
      } else if (action === 'unblock') {
        await cardService.unblock(cardId);
      } else if (action === 'deactivate') {
        const confirmed = window.confirm('Da li ste sigurni da želite deaktivaciju kartice?');
        if (!confirmed) {
          setProcessingCardId(null);
          return;
        }
        await cardService.deactivate(cardId);
      } else {
        const newLimitRaw = window.prompt('Unesite novi limit kartice:');
        if (!newLimitRaw) {
          setProcessingCardId(null);
          return;
        }
        const parsedLimit = Number(newLimitRaw);
        if (Number.isNaN(parsedLimit) || parsedLimit < 0) {
          toast.error('Limit mora biti nenegativan broj.');
          setProcessingCardId(null);
          return;
        }
        await cardService.changeLimit(cardId, parsedLimit);
      }

      await loadCards();
      toast.success('Akcija uspešno izvršena.');
    } catch {
      toast.error('Akcija nije uspela.');
    } finally {
      setProcessingCardId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Moje kartice
        </h1>
        <p className="text-muted-foreground mt-1">
          Upravljajte karticama vezanim za vaše račune.
        </p>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden">
              <div className="h-56 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse rounded-xl p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-24 bg-slate-300 dark:bg-slate-600 rounded" />
                  <div className="h-5 w-16 bg-slate-300 dark:bg-slate-600 rounded-full" />
                </div>
                <div className="space-y-3">
                  <div className="h-6 w-48 bg-slate-300 dark:bg-slate-600 rounded" />
                  <div className="h-4 w-32 bg-slate-300 dark:bg-slate-600 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-slate-300 dark:bg-slate-600 rounded" />
                  <div className="h-8 w-20 bg-slate-300 dark:bg-slate-600 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : asArray<Card>(cards).length === 0 ? (
        /* Empty state */
        <div className="col-span-full flex justify-center py-16">
          <UICard className="max-w-md w-full text-center">
            <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <CreditCard className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Nemate kartica</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Trenutno nemate nijednu karticu vezanu za vaše račune.
                </p>
              </div>
            </CardContent>
          </UICard>
        </div>
      ) : (
        /* Card grid */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {asArray<Card>(cards).map((card) => (
            <div key={card.id} className="rounded-xl overflow-hidden shadow-lg">
              {/* Credit card face */}
              <div className={`relative p-6 ${cardGradient(card.cardType)} min-h-[220px] flex flex-col justify-between`}>
                {/* Top row: type + status */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold tracking-wide drop-shadow-sm">
                    {card.cardType}
                  </span>
                  <Badge
                    variant={statusBadgeVariant(card.status)}
                    className="text-[11px] shadow-sm"
                  >
                    {statusLabel(card.status)}
                  </Badge>
                </div>

                {/* Card number */}
                <p className="font-mono text-2xl tracking-[0.18em] drop-shadow-sm select-none">
                  {maskCardNumber(card.cardNumber)}
                </p>

                {/* Bottom details */}
                <div className="flex justify-between items-end text-sm">
                  <div className="space-y-0.5">
                    <p className="text-[11px] uppercase opacity-75">Vlasnik</p>
                    <p className="font-medium">{card.holderName}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[11px] uppercase opacity-75">Istek</p>
                    <p className="font-medium">{formatDate(card.expirationDate)}</p>
                  </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
                  <CreditCard className="h-24 w-24" />
                </div>
              </div>

              {/* Card details + actions */}
              <div className="bg-card border border-t-0 rounded-b-xl px-6 py-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Račun</span>
                  <span className="font-medium">{card.accountNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limit</span>
                  <span className="font-medium">{formatAmount(card.limit)} RSD</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {card.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => runCardAction(card.id, 'block')}
                      disabled={processingCardId === card.id}
                    >
                      {processingCardId === card.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Blokiraj
                    </Button>
                  )}
                  {card.status === 'BLOCKED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => runCardAction(card.id, 'unblock')}
                      disabled={processingCardId === card.id}
                    >
                      {processingCardId === card.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Deblokiraj
                    </Button>
                  )}
                  {card.status !== 'DEACTIVATED' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => runCardAction(card.id, 'limit')}
                        disabled={processingCardId === card.id}
                      >
                        Promeni limit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => runCardAction(card.id, 'deactivate')}
                        disabled={processingCardId === card.id}
                      >
                        Deaktiviraj
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
