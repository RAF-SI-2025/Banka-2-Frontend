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
import { useAuth } from '@/context/AuthContext';
import { cardService } from '@/services/cardService';
import { accountService } from '@/services/accountService';
import type { Card, Account } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CreditCard, Loader2, Plus } from 'lucide-react';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function maskCardNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length >= 8) {
    const first4 = digits.slice(0, 4);
    const last4 = digits.slice(-4);
    return `${first4} **** **** ${last4}`;
  }
  const last4 = digits.slice(-4);
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
  if (cardType === 'VISA') return 'bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-white';
  if (cardType === 'MASTERCARD') return 'bg-gradient-to-br from-red-500 via-orange-500 to-amber-600 text-white';
  if (cardType === 'DINACARD') return 'bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 text-white';
  if (cardType === 'AMERICAN_EXPRESS') return 'bg-gradient-to-br from-slate-600 via-slate-700 to-zinc-800 text-white';
  return 'bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 text-white';
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
  const { isAdmin } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingCardId, setProcessingCardId] = useState<number | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('100000');
  const [creatingCard, setCreatingCard] = useState(false);

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
    accountService.getMyAccounts().then((data) => {
      setAccounts(Array.isArray(data) ? data : []);
    }).catch(() => setAccounts([]));
  }, []);

  const handleCreateCard = async () => {
    if (!selectedAccountId) {
      toast.error('Izaberite račun za karticu.');
      return;
    }

    // Provera limita: max 2 kartice po licnom racunu
    const selectedAccount = accounts.find((a) => String(a.id) === selectedAccountId);
    const cardsForAccount = asArray<Card>(cards).filter(
      (c) => c.accountNumber === selectedAccount?.accountNumber && c.status !== 'DEACTIVATED'
    );
    const isBusiness = selectedAccount?.accountType === 'BUSINESS' || selectedAccount?.accountType === 'POSLOVNI';
    const maxCards = isBusiness ? 1 : 2;
    if (cardsForAccount.length >= maxCards) {
      toast.error(
        isBusiness
          ? 'Poslovni račun može imati maksimalno 1 karticu po ovlašćenom licu.'
          : 'Lični račun može imati maksimalno 2 kartice.'
      );
      return;
    }

    setCreatingCard(true);
    try {
      await cardService.submitRequest({
        accountId: Number(selectedAccountId),
        cardLimit: Number(newCardLimit) || 100000,
      });
      toast.success('Zahtev za karticu je uspešno podnet! Čeka odobrenje zaposlenog.');
      setShowNewCard(false);
      setSelectedAccountId('');
      setNewCardLimit('100000');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Podnošenje zahteva nije uspelo.');
    } finally {
      setCreatingCard(false);
    }
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Moje kartice</h1>
            <p className="text-sm text-muted-foreground">
              Upravljajte karticama vezanim za vaše račune.
            </p>
          </div>
        </div>
        {!isAdmin && !showNewCard && (
          <Button
            onClick={() => setShowNewCard(true)}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova kartica
          </Button>
        )}
      </div>

      {/* New card form */}
      {showNewCard && (
        <UICard>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Zahtev za novu karticu</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowNewCard(false)}>Otkaži</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Račun *</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite račun" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.status === 'ACTIVE').map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name || a.accountType} — {a.accountNumber} ({a.currency || (a as unknown as Record<string, unknown>).currencyCode || 'RSD'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Limit kartice (RSD)</Label>
                <Input type="number" value={newCardLimit} onChange={(e) => setNewCardLimit(e.target.value)} />
              </div>
            </div>
            <Button
              onClick={handleCreateCard}
              disabled={creatingCard || !selectedAccountId}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
            >
              {creatingCard ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {creatingCard ? 'Kreiranje...' : 'Kreiraj karticu'}
            </Button>
          </CardContent>
        </UICard>
      )}

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
            <div key={card.id} className="group rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              {/* Credit card face */}
              <div className={`relative p-6 ${cardGradient(card.cardName || card.cardType || 'VISA')} min-h-[220px] flex flex-col justify-between overflow-hidden`}>
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
                {/* Decorative elements */}
                <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-xl" />
                <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/5 blur-lg" />
                <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-white/5 blur-md" />

                {/* Top row: type + status */}
                <div className="relative flex items-center justify-between">
                  <span className="text-lg font-bold tracking-wide drop-shadow-md">
                    {card.cardName || card.cardType || 'Visa Debit'}
                  </span>
                  <Badge
                    variant={statusBadgeVariant(card.status)}
                    className="text-[11px] shadow-sm backdrop-blur-sm"
                  >
                    {statusLabel(card.status)}
                  </Badge>
                </div>

                {/* Card number */}
                <p className="relative font-mono text-2xl tracking-[0.18em] drop-shadow-md select-none">
                  {maskCardNumber(card.cardNumber)}
                </p>

                {/* Bottom details */}
                <div className="relative flex justify-between items-end text-sm">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-widest opacity-70">Vlasnik</p>
                    <p className="font-semibold drop-shadow-sm">{card.ownerName || card.holderName || '-'}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] uppercase tracking-widest opacity-70">Istek</p>
                    <p className="font-semibold drop-shadow-sm">{formatDate(card.expirationDate)}</p>
                  </div>
                </div>

                {/* Decorative chip */}
                <div className="absolute top-16 left-6 h-8 w-11 rounded-md bg-gradient-to-br from-amber-300/80 to-amber-500/60 shadow-inner" />

                {/* Large watermark icon */}
                <div className="absolute bottom-4 right-4 opacity-[0.08] pointer-events-none">
                  <CreditCard className="h-28 w-28" />
                </div>
              </div>

              {/* Card details + actions */}
              <div className="bg-card border border-t-0 rounded-b-2xl px-6 py-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Račun</span>
                  <span className="font-medium">{card.accountNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limit</span>
                  <span className="font-medium">{formatAmount(card.cardLimit ?? card.limit)} RSD</span>
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
                  {card.status === 'BLOCKED' && isAdmin && (
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
                  {card.status === 'BLOCKED' && !isAdmin && (
                    <p className="text-xs text-muted-foreground py-1">Kontaktirajte banku za deblokiranje.</p>
                  )}
                  {card.status === 'DEACTIVATED' && (
                    <p className="text-xs text-muted-foreground py-1">Kartica je deaktivirana i ne može se ponovo aktivirati.</p>
                  )}
                  {card.status !== 'DEACTIVATED' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => runCardAction(card.id, 'limit')}
                        disabled={processingCardId === card.id || card.status === 'BLOCKED'}
                        title={card.status === 'BLOCKED' ? 'Promena limita nije dozvoljena dok je kartica blokirana' : undefined}
                      >
                        Promeni limit
                      </Button>
                      {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => runCardAction(card.id, 'deactivate')}
                        disabled={processingCardId === card.id}
                      >
                        Deaktiviraj
                      </Button>
                      )}
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
