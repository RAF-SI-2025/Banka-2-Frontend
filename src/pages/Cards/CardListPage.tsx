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

import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import { cardService } from '@/services/cardService';
import { accountService } from '@/services/accountService';
import type { Card, Account, AuthorizedPerson } from '@/types/celina2';
import { asArray, formatAmount, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CreditCard, Loader2, Plus, Wifi, Shield, Calendar, UserPlus } from 'lucide-react';


function maskCardNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length >= 8) {
    const first4 = digits.slice(0, 4);
    const last4 = digits.slice(-4);
    return `${first4}  ****  ****  ${last4}`;
  }
  const last4 = digits.slice(-4);
  return `****  ****  ****  ${last4}`;
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
  if (cardType === 'VISA') return 'from-blue-700 via-blue-800 to-slate-900';
  if (cardType === 'MASTERCARD') return 'from-red-600 via-rose-700 to-red-900';
  if (cardType === 'DINACARD') return 'from-emerald-600 via-green-700 to-teal-800';
  if (cardType === 'AMERICAN_EXPRESS') return 'from-slate-600 via-slate-700 to-zinc-900';
  return 'from-indigo-600 via-violet-700 to-purple-900';
}


function formatExpiryShort(value: string | null | undefined): string {
  if (!value) return 'MM/YY';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'MM/YY';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

/* 3D tilt effect hook */
function useCardTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 8;
    const rotateX = ((centerY - y) / centerY) * 5;
    el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  }, []);

  return { ref, handleMouseMove, handleMouseLeave };
}

/* Chip SVG */
function CardChip() {
  return (
    <div className="h-9 w-12 rounded-md overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 opacity-90" />
      <div className="absolute inset-0 flex flex-col justify-between p-[3px]">
        <div className="flex gap-[2px]">
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
        </div>
        <div className="flex gap-[2px]">
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
        </div>
        <div className="flex gap-[2px]">
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
        </div>
        <div className="flex gap-[2px]">
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
          <div className="h-[3px] flex-1 bg-amber-600/30 rounded-full" />
        </div>
      </div>
      <div className="absolute inset-[3px] border border-amber-600/20 rounded-sm" />
    </div>
  );
}

/* Single credit card visual */
function CreditCardVisual({ card }: { card: Card }) {
  const { ref, handleMouseMove, handleMouseLeave } = useCardTilt();
  const gradientClass = cardGradient(card.cardName || card.cardType || 'VISA');

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative transition-transform duration-200 ease-out will-change-transform"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className={`relative bg-gradient-to-br ${gradientClass} text-white rounded-2xl p-6 min-h-[230px] flex flex-col justify-between overflow-hidden select-none`}>
        {/* Shine/glare overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.06) 50%, transparent 55%)',
          }}
        />
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/[0.07] blur-xl" />
        <div className="absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-white/[0.04] blur-lg" />
        <div className="absolute top-1/3 right-1/3 h-24 w-24 rounded-full bg-white/[0.03] blur-md" />

        {/* Top row: type + contactless + status */}
        <div className="relative flex items-start justify-between">
          <span className="text-lg font-bold tracking-wide drop-shadow-md">
            {card.cardName || card.cardType || 'Visa Debit'}
          </span>
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 opacity-60 rotate-90" />
            <Badge
              variant={statusBadgeVariant(card.status)}
              className="text-[11px] shadow-sm backdrop-blur-sm"
            >
              {statusLabel(card.status)}
            </Badge>
          </div>
        </div>

        {/* Chip */}
        <div className="relative mt-2">
          <CardChip />
        </div>

        {/* Card number */}
        <p className="relative font-mono text-[22px] tracking-[0.22em] drop-shadow-md mt-3">
          {maskCardNumber(card.cardNumber)}
        </p>

        {/* Bottom details */}
        <div className="relative flex justify-between items-end text-sm mt-3">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-medium">Vlasnik</p>
            <p className="font-semibold drop-shadow-sm text-[13px]">{(card.ownerName || card.holderName || '-').toUpperCase()}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-medium">Vazi do</p>
            <p className="font-semibold drop-shadow-sm text-[15px] font-mono">{formatExpiryShort(card.expirationDate)}</p>
          </div>
        </div>

        {/* Large watermark icon */}
        <div className="absolute bottom-3 right-3 opacity-[0.06] pointer-events-none">
          <CreditCard className="h-24 w-24" />
        </div>
      </div>
    </div>
  );
}

/* Circular progress ring */
function LimitRing({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (pct / 100) * circumference;
  const color = pct > 80 ? 'text-red-500' : pct > 50 ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle
          cx="28" cy="28" r={radius} fill="none" strokeWidth="4" strokeLinecap="round"
          stroke="currentColor"
          className={`${color} transition-all duration-700`}
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
        />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
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

  // Authorized person state (for business accounts)
  const [cardRecipient, setCardRecipient] = useState<'self' | 'authorized'>('self');
  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([]);
  const [selectedAuthorizedPersonId, setSelectedAuthorizedPersonId] = useState<string>('');
  const [showNewAuthorizedPerson, setShowNewAuthorizedPerson] = useState(false);
  const [newApFirstName, setNewApFirstName] = useState('');
  const [newApLastName, setNewApLastName] = useState('');
  const [newApEmail, setNewApEmail] = useState('');
  const [newApPhone, setNewApPhone] = useState('');

  const loadCards = async () => {
    setLoading(true);
    try {
      const data = await cardService.getMyCards();
      setCards(asArray<Card>(data));
    } catch {
      toast.error('Neuspesno ucitavanje kartica.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((a) => String(a.id) === selectedAccountId);
  const isBizAccount = selectedAccount?.accountType === 'BUSINESS' || selectedAccount?.accountType === 'POSLOVNI';

  useEffect(() => {
    loadCards();
    accountService.getMyAccounts().then((data) => {
      setAccounts(Array.isArray(data) ? data : []);
    }).catch(() => setAccounts([]));
  }, []);

  // Fetch authorized persons when a business account is selected
  useEffect(() => {
    if (isBizAccount && selectedAccount?.accountNumber) {
      cardService.getAuthorizedPersons(selectedAccount.accountNumber)
        .then((data) => setAuthorizedPersons(Array.isArray(data) ? data : []))
        .catch(() => setAuthorizedPersons([]));
    } else {
      setAuthorizedPersons([]);
      setCardRecipient('self');
    }
  }, [selectedAccountId, isBizAccount, selectedAccount?.accountNumber]);

  const handleCreateCard = async () => {
    if (!selectedAccountId) {
      toast.error('Izaberite racun za karticu.');
      return;
    }

    const acct = accounts.find((a) => String(a.id) === selectedAccountId);
    const cardsForAccount = asArray<Card>(cards).filter(
      (c) => c.accountNumber === acct?.accountNumber && c.status !== 'DEACTIVATED'
    );
    const isBusiness = acct?.accountType === 'BUSINESS' || acct?.accountType === 'POSLOVNI';
    const maxCards = isBusiness ? 1 : 2;
    if (cardsForAccount.length >= maxCards) {
      toast.error(
        isBusiness
          ? 'Poslovni racun moze imati maksimalno 1 karticu po ovlascenom licu.'
          : 'Licni racun moze imati maksimalno 2 kartice.'
      );
      return;
    }

    // Validate authorized person for business accounts
    if (isBusiness && cardRecipient === 'authorized') {
      if (showNewAuthorizedPerson) {
        if (!newApFirstName.trim() || !newApLastName.trim() || !newApEmail.trim() || !newApPhone.trim()) {
          toast.error('Popunite sve podatke o ovlascenom licu.');
          return;
        }
      } else if (!selectedAuthorizedPersonId) {
        toast.error('Izaberite ovlasceno lice.');
        return;
      }
    }

    setCreatingCard(true);
    try {
      const requestData: { accountId: number; cardLimit?: number; authorizedPersonId?: number; authorizedPerson?: Partial<import('@/types/celina2').AuthorizedPerson> } = {
        accountId: Number(selectedAccountId),
        cardLimit: Number(newCardLimit) || 100000,
      };

      if (isBusiness && cardRecipient === 'authorized') {
        if (showNewAuthorizedPerson) {
          requestData.authorizedPerson = {
            firstName: newApFirstName.trim(),
            lastName: newApLastName.trim(),
            email: newApEmail.trim(),
            phoneNumber: newApPhone.trim(),
          };
        } else {
          requestData.authorizedPersonId = Number(selectedAuthorizedPersonId);
        }
      }

      await cardService.submitRequest(requestData);
      toast.success('Zahtev za karticu je uspesno podnet! Ceka odobrenje zaposlenog.');
      setShowNewCard(false);
      setSelectedAccountId('');
      setNewCardLimit('100000');
      setCardRecipient('self');
      setSelectedAuthorizedPersonId('');
      setShowNewAuthorizedPerson(false);
      setNewApFirstName('');
      setNewApLastName('');
      setNewApEmail('');
      setNewApPhone('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Podnosenje zahteva nije uspelo.');
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
        const confirmed = window.confirm('Da li ste sigurni da zelite deaktivaciju kartice?');
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
      toast.success('Akcija uspesno izvrsena.');
    } catch {
      toast.error('Akcija nije uspela.');
    } finally {
      setProcessingCardId(null);
    }
  };

  const safeCards = asArray<Card>(cards);
  const activeCount = safeCards.filter(c => c.status === 'ACTIVE').length;
  const blockedCount = safeCards.filter(c => c.status === 'BLOCKED').length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Moje kartice</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upravljajte karticama vezanim za vase racune
            </p>
          </div>
        </div>
        {!isAdmin && !showNewCard && (
          <Button
            onClick={() => setShowNewCard(true)}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova kartica
          </Button>
        )}
      </div>

      {/* Stats row */}
      {!loading && safeCards.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{safeCards.length}</p>
              <p className="text-xs text-muted-foreground">Ukupno kartica</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Aktivne</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{blockedCount}</p>
              <p className="text-xs text-muted-foreground">Blokirane</p>
            </div>
          </div>
        </div>
      )}

      {/* New card form */}
      {showNewCard && (
        <UICard className="rounded-2xl border-indigo-500/20 shadow-lg shadow-indigo-500/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Zahtev za novu karticu</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowNewCard(false)}>Otkazi</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Racun *</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite racun" />
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

            {/* Authorized person section — only for business accounts */}
            {isBizAccount && (
              <div className="space-y-4 rounded-xl border p-4 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UserPlus className="h-4 w-4 text-indigo-500" />
                  Kartica za
                </div>
                <Select value={cardRecipient} onValueChange={(val) => {
                  setCardRecipient(val as 'self' | 'authorized');
                  setSelectedAuthorizedPersonId('');
                  setShowNewAuthorizedPerson(false);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Za sebe (vlasnik racuna)</SelectItem>
                    <SelectItem value="authorized">Za ovlasceno lice</SelectItem>
                  </SelectContent>
                </Select>

                {cardRecipient === 'authorized' && (
                  <div className="space-y-4">
                    {/* Select existing or add new */}
                    <Select
                      value={showNewAuthorizedPerson ? '__new__' : selectedAuthorizedPersonId}
                      onValueChange={(val) => {
                        if (val === '__new__') {
                          setShowNewAuthorizedPerson(true);
                          setSelectedAuthorizedPersonId('');
                        } else {
                          setShowNewAuthorizedPerson(false);
                          setSelectedAuthorizedPersonId(val);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberite ovlasceno lice" />
                      </SelectTrigger>
                      <SelectContent>
                        {authorizedPersons.map((ap) => (
                          <SelectItem key={ap.id} value={String(ap.id)}>
                            {ap.firstName} {ap.lastName} — {ap.email}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Novo ovlasceno lice</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* New authorized person form */}
                    {showNewAuthorizedPerson && (
                      <div className="grid gap-3 md:grid-cols-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="space-y-2">
                          <Label>Ime *</Label>
                          <Input
                            value={newApFirstName}
                            onChange={(e) => setNewApFirstName(e.target.value)}
                            placeholder="Ime ovlascenog lica"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prezime *</Label>
                          <Input
                            value={newApLastName}
                            onChange={(e) => setNewApLastName(e.target.value)}
                            placeholder="Prezime ovlascenog lica"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={newApEmail}
                            onChange={(e) => setNewApEmail(e.target.value)}
                            placeholder="email@primer.rs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Telefon *</Label>
                          <Input
                            type="tel"
                            value={newApPhone}
                            onChange={(e) => setNewApPhone(e.target.value)}
                            placeholder="+381..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleCreateCard}
              disabled={creatingCard || !selectedAccountId}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
            >
              {creatingCard ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {creatingCard ? 'Kreiranje...' : 'Kreiraj karticu'}
            </Button>
          </CardContent>
        </UICard>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-4 animate-pulse">
              <div className="h-[230px] bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-2xl" />
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="h-4 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-8 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : safeCards.length === 0 ? (
        /* Empty state */
        <div className="flex justify-center py-20">
          <UICard className="max-w-md w-full text-center rounded-2xl">
            <CardContent className="pt-12 pb-12 flex flex-col items-center gap-5">
              <div className="rounded-full bg-muted p-5">
                <CreditCard className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Nemate kartica</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Trenutno nemate nijednu karticu vezanu za vase racune.
                </p>
              </div>
              {!isAdmin && (
                <Button
                  onClick={() => setShowNewCard(true)}
                  className="mt-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Zatrazite karticu
                </Button>
              )}
            </CardContent>
          </UICard>
        </div>
      ) : (
        /* Card grid */
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {safeCards.map((card, index) => (
            <div
              key={card.id}
              className="group space-y-0"
              style={{ animation: `fadeUp 0.5s ease-out ${index * 0.1}s both` }}
            >
              {/* 3D credit card */}
              <CreditCardVisual card={card} />

              {/* Card details + actions */}
              <div className="bg-card border rounded-2xl -mt-3 relative z-10 px-6 py-5 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                {/* Account + Limit info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Racun</p>
                    <p className="font-mono text-sm font-medium mt-0.5">{card.accountNumber}</p>
                  </div>
                  <LimitRing used={0} total={card.cardLimit ?? card.limit ?? 100000} />
                </div>

                {/* Limit text */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limit</span>
                  <span className="font-semibold">{formatAmount(card.cardLimit ?? card.limit)} RSD</span>
                </div>

                {/* Expiry */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Istice</span>
                  <span className="font-medium">{formatDate(card.expirationDate)}</span>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t space-y-3">
                  {/* Block/Unblock toggle */}
                  {card.status === 'ACTIVE' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Aktivna</span>
                      </div>
                      <Switch
                        checked={true}
                        onCheckedChange={() => runCardAction(card.id, 'block')}
                        disabled={processingCardId === card.id}
                      />
                    </div>
                  )}
                  {card.status === 'BLOCKED' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Blokirana</span>
                      </div>
                      {isAdmin ? (
                        <Switch
                          checked={false}
                          onCheckedChange={() => runCardAction(card.id, 'unblock')}
                          disabled={processingCardId === card.id}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">Kontaktirajte banku</p>
                      )}
                    </div>
                  )}
                  {card.status === 'DEACTIVATED' && (
                    <p className="text-xs text-muted-foreground text-center py-1">Kartica je deaktivirana.</p>
                  )}

                  {/* Action buttons */}
                  {card.status !== 'DEACTIVATED' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                        onClick={() => runCardAction(card.id, 'limit')}
                        disabled={processingCardId === card.id || card.status === 'BLOCKED'}
                        title={card.status === 'BLOCKED' ? 'Promena limita nije dozvoljena dok je kartica blokirana' : undefined}
                      >
                        {processingCardId === card.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Promeni limit
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-600 transition-all"
                          onClick={() => runCardAction(card.id, 'deactivate')}
                          disabled={processingCardId === card.id}
                        >
                          Deaktiviraj
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
