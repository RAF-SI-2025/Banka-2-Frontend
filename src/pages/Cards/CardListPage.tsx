import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import { cardService } from '@/services/cardService';
import { accountService } from '@/services/accountService';
import type { Card, Account, AuthorizedPerson } from '@/types/celina2';
import { asArray, formatAmount, formatDate, getErrorMessage, isBusinessAccountType } from '@/utils/formatters';
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
import * as Dialog from '@radix-ui/react-dialog';


import {
  CARD_STATUS_LABELS,
  CARD_STATUS_BADGE_VARIANT,
  computeCardUsage,
} from '@/utils/cardLabels';

function statusBadgeVariant(status: string): 'success' | 'warning' | 'secondary' {
  return CARD_STATUS_BADGE_VARIANT[status] ?? 'secondary';
}

function statusLabel(status: string): string {
  return CARD_STATUS_LABELS[status] ?? status;
}

function cardGradient(cardType: string, cardCategory?: string): string {
  // Tip placanja prevazilazi brend boju — za CREDIT i PREPAID koristimo karakteristicne palete.
  if (cardCategory === 'CREDIT') {
    return 'from-amber-500 via-yellow-600 to-orange-800'; // gold kreditna kartica
  }
  if (cardCategory === 'INTERNET_PREPAID') {
    return 'from-cyan-500 via-sky-700 to-blue-900'; // futuristicki neon prepaid
  }
  // DEBIT: zadrzava brand boju (postojeci postavljen behavior)
  if (cardType === 'VISA') return 'from-blue-700 via-blue-800 to-slate-900';
  if (cardType === 'MASTERCARD') return 'from-red-600 via-rose-700 to-red-900';
  if (cardType === 'DINACARD') return 'from-emerald-600 via-green-700 to-teal-800';
  if (cardType === 'AMERICAN_EXPRESS') return 'from-slate-600 via-slate-700 to-zinc-900';
  return 'from-indigo-600 via-violet-700 to-purple-900';
}

/**
 * Kategoriski overlay efekti — daje svakoj 3D kartici jedinstven hologram:
 * - DEBIT: subtilan shine (postojeci)
 * - CREDIT: zlatni grid + sjajni edge highlight
 * - PREPAID: aurora effect sa pulsing neonom
 */
function categoryHologramClass(cardCategory?: string): string {
  if (cardCategory === 'CREDIT') {
    return 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.25),transparent_60%)] before:pointer-events-none';
  }
  if (cardCategory === 'INTERNET_PREPAID') {
    return 'before:absolute before:inset-0 before:bg-[conic-gradient(from_180deg_at_50%_50%,rgba(56,189,248,0.18),rgba(14,165,233,0.0),rgba(125,211,252,0.18),rgba(14,165,233,0.0))] before:pointer-events-none before:animate-pulse';
  }
  return '';
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
  const gradientClass = cardGradient(card.cardName || card.cardType || 'VISA', card.cardCategory);
  const hologramClass = categoryHologramClass(card.cardCategory);
  const categoryLabel = card.cardCategory === 'CREDIT'
    ? 'CREDIT'
    : card.cardCategory === 'INTERNET_PREPAID'
      ? 'PREPAID'
      : 'DEBIT';
  const categoryBadgeClass = card.cardCategory === 'CREDIT'
    ? 'bg-amber-300/30 text-amber-100 border-amber-200/40'
    : card.cardCategory === 'INTERNET_PREPAID'
      ? 'bg-cyan-300/30 text-cyan-50 border-cyan-200/40'
      : 'bg-white/15 text-white/90 border-white/20';

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative transition-transform duration-200 ease-out will-change-transform"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className={`relative bg-gradient-to-br ${gradientClass} ${hologramClass} text-white rounded-2xl p-6 min-h-[230px] flex flex-col justify-between overflow-hidden select-none`}>
        {/* Shine/glare overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.06) 50%, transparent 55%)',
          }}
        />
        {/* CREDIT: zlatni grid linije */}
        {card.cardCategory === 'CREDIT' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent 0, transparent 14px, rgba(255,215,0,0.35) 14px, rgba(255,215,0,0.35) 15px)',
            }}
          />
        )}
        {/* PREPAID: hex grid pattern */}
        {card.cardCategory === 'INTERNET_PREPAID' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(125,211,252,0.45) 0px, transparent 2px), ' +
                'radial-gradient(circle at 60% 70%, rgba(56,189,248,0.45) 0px, transparent 2px), ' +
                'radial-gradient(circle at 85% 20%, rgba(165,233,253,0.45) 0px, transparent 2px)',
              backgroundSize: '40px 40px, 50px 50px, 30px 30px',
            }}
          />
        )}
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/[0.07] blur-xl" />
        <div className="absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-white/[0.04] blur-lg" />
        <div className="absolute top-1/3 right-1/3 h-24 w-24 rounded-full bg-white/[0.03] blur-md" />

        {/* Top row: type + category badge + contactless + status */}
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-wide drop-shadow-md">
              {card.cardName || card.cardType || 'Visa Debit'}
            </span>
            <span className={`text-[9px] font-bold tracking-[0.15em] px-2 py-0.5 rounded border backdrop-blur-sm ${categoryBadgeClass}`} data-testid={`card-category-badge-${card.id}`}>
              {categoryLabel}
            </span>
          </div>
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

        {/* Card number — BE vec vraca maskiran broj (5798********5571, Celina 2 §321).
            Ne re-maskiramo na FE-u: re-maskiranje je lomljivo (zavisi od toga da BE
            zadrzi prve+zadnje 4 vidljive). Prikazujemo BE vrednost direktno. */}
        <p className="relative font-mono text-[22px] tracking-[0.22em] drop-shadow-md mt-3">
          {card.cardNumber || '—'}
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
  // SC28 fix: spec C2 §274-291 trazi vise tipova/brendova kartica.
  // BE enum CardType: VISA, MASTERCARD, DINACARD, AMERICAN_EXPRESS.
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD' | 'DINACARD' | 'AMERICAN_EXPRESS'>('VISA');
  // 14.05 vece-3 dopuna: tip placanja — DEBIT / CREDIT / INTERNET_PREPAID
  const [cardCategory, setCardCategory] = useState<'DEBIT' | 'CREDIT' | 'INTERNET_PREPAID'>('DEBIT');
  const [creditLimit, setCreditLimit] = useState<string>('50000');
  const [confirmBlockCardId, setConfirmBlockCardId] = useState<number | null>(null);
  // ACCEPTED-DEVIATION (user-directed 03.06): zahtev za karticu se podnosi jednim
  // korakom, bez email verifikacionog koda (uklonjen C2 Sc28 §308 OTP gate). OTP
  // ostaje SAMO na placanju i transferu (money-out).
  // Top-up / withdraw za INTERNET_PREPAID kartice
  const [topUpCardId, setTopUpCardId] = useState<number | null>(null);
  const [topUpDirection, setTopUpDirection] = useState<'top-up' | 'withdraw'>('top-up');
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [topUpAccountId, setTopUpAccountId] = useState<string>('');
  const [topUpBusy, setTopUpBusy] = useState(false);

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
  const isBizAccount = isBusinessAccountType(selectedAccount?.accountType);

  const loadAccounts = async () => {
    try {
      const data = await accountService.getMyAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    }
  };

  useEffect(() => {
    loadCards();
    loadAccounts();
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

  const resetNewCardForm = () => {
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
  };

  /** Validacija forme pre podnosenja zahteva za karticu. */
  const validateNewCardForm = (): boolean => {
    if (!selectedAccountId) {
      toast.error('Izaberite racun za karticu.');
      return false;
    }
    const acct = accounts.find((a) => String(a.id) === selectedAccountId);
    const cardsForAccount = asArray<Card>(cards).filter(
      (c) => c.accountNumber === acct?.accountNumber && c.status !== 'DEACTIVATED'
    );
    const isBusiness = isBusinessAccountType(acct?.accountType);
    const maxCards = isBusiness ? 1 : 2;
    if (cardsForAccount.length >= maxCards) {
      toast.error(
        isBusiness
          ? 'Poslovni racun moze imati maksimalno 1 karticu po ovlascenom licu.'
          : 'Licni racun moze imati maksimalno 2 kartice.'
      );
      return false;
    }
    if (isBusiness && cardRecipient === 'authorized') {
      if (showNewAuthorizedPerson) {
        if (!newApFirstName.trim() || !newApLastName.trim() || !newApEmail.trim() || !newApPhone.trim()) {
          toast.error('Popunite sve podatke o ovlascenom licu.');
          return false;
        }
      } else if (!selectedAuthorizedPersonId) {
        toast.error('Izaberite ovlasceno lice.');
        return false;
      }
    }
    return true;
  };

  // ACCEPTED-DEVIATION (user-directed 03.06): jednostavan submit bez OTP/email koda.
  const handleCreateCard = async () => {
    if (!validateNewCardForm()) return;

    const acct = accounts.find((a) => String(a.id) === selectedAccountId);
    const isBusiness = isBusinessAccountType(acct?.accountType);

    setCreatingCard(true);
    try {
      const requestData: { accountId: number; cardLimit?: number; cardType?: string; cardCategory?: string; creditLimit?: number; authorizedPersonId?: number; authorizedPerson?: Partial<import('@/types/celina2').AuthorizedPerson> } = {
        accountId: Number(selectedAccountId),
        cardLimit: Number(newCardLimit) || 100000,
        cardType: cardBrand,
        cardCategory: cardCategory,
      };
      if (cardCategory === 'CREDIT') {
        requestData.creditLimit = Number(creditLimit) || 0;
      }

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
      resetNewCardForm();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Podnosenje zahteva nije uspelo.'));
    } finally {
      setCreatingCard(false);
    }
  };

  const runCardAction = async (cardId: number, action: 'block' | 'unblock' | 'deactivate' | 'limit') => {
    // SC30 fix: blokada kartice je destruktivna akcija — trazimo confirm pre poziva.
    if (action === 'block') {
      setConfirmBlockCardId(cardId);
      return;
    }
    setProcessingCardId(cardId);
    try {
      if (action === 'unblock') {
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
            data-testid="card-request-cta"
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Zatrazi novu karticu
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
            <Button variant="outline" size="sm" onClick={resetNewCardForm}>Otkazi</Button>
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
                <Label>Brend kartice *</Label>
                <Select value={cardBrand} onValueChange={(val) => setCardBrand(val as 'VISA' | 'MASTERCARD' | 'DINACARD' | 'AMERICAN_EXPRESS')}>
                  <SelectTrigger data-testid="card-brand-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VISA">Visa</SelectItem>
                    <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                    <SelectItem value="DINACARD">DinaCard</SelectItem>
                    <SelectItem value="AMERICAN_EXPRESS">American Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tip placanja *</Label>
                <Select value={cardCategory} onValueChange={(val) => setCardCategory(val as 'DEBIT' | 'CREDIT' | 'INTERNET_PREPAID')}>
                  <SelectTrigger data-testid="card-category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">Debit (direktan debit sa racuna)</SelectItem>
                    <SelectItem value="CREDIT">Credit (kartica na rate)</SelectItem>
                    <SelectItem value="INTERNET_PREPAID">Internet Prepaid (odvojen balance)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {cardCategory === 'DEBIT' && 'Skida se sa povezanog racuna pri placanju.'}
                  {cardCategory === 'CREDIT' && 'Banka odobrava kreditni limit; mesecna otplata.'}
                  {cardCategory === 'INTERNET_PREPAID' && 'Odvojen balance — prebacujes pare unapred za internet kupovine.'}
                </p>
              </div>
              {cardCategory === 'CREDIT' && (
                <div className="space-y-2">
                  <Label>Kreditni limit (RSD) *</Label>
                  <Input
                    type="number"
                    min="1000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    data-testid="credit-limit-input"
                  />
                  <p className="text-[11px] text-muted-foreground">Maksimalni iznos koji banka odobrava na rate.</p>
                </div>
              )}
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

            {/* ACCEPTED-DEVIATION (user-directed 03.06): jednokoracni submit zahteva
                za karticu — bez email verifikacionog koda. OTP samo na placanju/transferu. */}
            <Button
              onClick={handleCreateCard}
              disabled={creatingCard || !selectedAccountId}
              data-testid="card-submit-request-button"
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
            >
              {creatingCard ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {creatingCard ? 'Slanje zahteva...' : 'Zatrazi novu karticu'}
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
                  {/* R1-548: prsten samo kad postoji stvarna iskoriscenost (CREDIT/PREPAID);
                      za DEBIT nema spending podataka pa ne prikazujemo lazni 0%. */}
                  {(() => {
                    const usage = computeCardUsage(card);
                    return usage ? <LimitRing used={usage.used} total={usage.total} /> : null;
                  })()}
                </div>

                {/* Limit text */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limit</span>
                  <span className="font-semibold">{formatAmount(card.cardLimit ?? card.limit)} RSD</span>
                </div>

                {/* INTERNET_PREPAID: prikaz balance + Dopuni/Povuci */}
                {card.cardCategory === 'INTERNET_PREPAID' && (
                  <>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Balance na kartici</span>
                      <span className="font-semibold font-mono text-cyan-600 dark:text-cyan-400" data-testid={`prepaid-balance-${card.id}`}>
                        {formatAmount(card.prepaidBalance ?? 0)} RSD
                      </span>
                    </div>
                    {card.status === 'ACTIVE' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          data-testid={`card-topup-${card.id}`}
                          onClick={() => {
                            setTopUpCardId(card.id);
                            setTopUpDirection('top-up');
                            setTopUpAmount('');
                            setTopUpAccountId(accounts[0] ? String(accounts[0].id) : '');
                          }}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Dopuni
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={(card.prepaidBalance ?? 0) <= 0}
                          data-testid={`card-withdraw-${card.id}`}
                          onClick={() => {
                            setTopUpCardId(card.id);
                            setTopUpDirection('withdraw');
                            setTopUpAmount('');
                            setTopUpAccountId(accounts[0] ? String(accounts[0].id) : '');
                          }}
                        >
                          <Wifi className="mr-1 h-3.5 w-3.5 rotate-180" />
                          Povuci
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* CREDIT: prikaz creditLimit + outstanding */}
                {card.cardCategory === 'CREDIT' && (
                  <div className="border-t pt-2 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kreditni limit</span>
                      <span className="font-semibold font-mono text-amber-600 dark:text-amber-400">
                        {formatAmount(card.creditLimit ?? 0)} RSD
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dugovanje</span>
                      <span className="font-semibold font-mono text-red-600 dark:text-red-400">
                        {formatAmount(card.outstandingBalance ?? 0)} RSD
                      </span>
                    </div>
                  </div>
                )}

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

      {/* SC30 fix: Radix confirm dialog za blokadu kartice */}
      <Dialog.Root open={confirmBlockCardId !== null} onOpenChange={(open) => !open && setConfirmBlockCardId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-testid="card-block-confirm-dialog">
            <Dialog.Title className="text-lg font-semibold">Blokiraj karticu?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Posle blokade kartica vise nece moci da se koristi za placanja. Odblokirati moze samo zaposleni u banci.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmBlockCardId(null)}>Otkazi</Button>
              <Button
                variant="destructive"
                data-testid="card-block-confirm-button"
                onClick={async () => {
                  if (confirmBlockCardId === null) return;
                  const cardId = confirmBlockCardId;
                  setConfirmBlockCardId(null);
                  setProcessingCardId(cardId);
                  try {
                    await cardService.block(cardId);
                    await loadCards();
                    toast.success('Kartica je blokirana.');
                  } catch {
                    toast.error('Blokada kartice nije uspela.');
                  } finally {
                    setProcessingCardId(null);
                  }
                }}
              >
                Blokiraj
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Top-up / withdraw dialog za INTERNET_PREPAID kartice */}
      <Dialog.Root open={topUpCardId !== null} onOpenChange={(open) => !open && setTopUpCardId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl" data-testid="card-topup-dialog">
            <Dialog.Title className="text-lg font-semibold">
              {topUpDirection === 'top-up' ? 'Dopuna prepaid kartice' : 'Povlacenje sa prepaid kartice'}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {topUpDirection === 'top-up'
                ? 'Prebacuje iznos sa izabranog racuna na karticu.'
                : 'Prebacuje iznos sa kartice nazad na izabrani racun.'}
            </Dialog.Description>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>{topUpDirection === 'top-up' ? 'Sa racuna' : 'Na racun'} *</Label>
                <Select value={topUpAccountId} onValueChange={setTopUpAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite racun" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.status === 'ACTIVE').map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.accountNumber} ({a.currency || 'RSD'}) | {formatAmount(a.availableBalance)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Iznos *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  data-testid="topup-amount-input"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTopUpCardId(null)} disabled={topUpBusy}>Otkazi</Button>
              <Button
                data-testid="topup-confirm-button"
                disabled={topUpBusy || !topUpAccountId || !Number.isFinite(Number(topUpAmount)) || Number(topUpAmount) <= 0}
                onClick={async () => {
                  if (topUpCardId === null) return;
                  setTopUpBusy(true);
                  try {
                    const amount = Number(topUpAmount);
                    if (topUpDirection === 'top-up') {
                      await cardService.topUp(topUpCardId, Number(topUpAccountId), amount);
                      toast.success(`Kartica je dopunjena za ${amount} RSD.`);
                    } else {
                      await cardService.withdraw(topUpCardId, Number(topUpAccountId), amount);
                      toast.success(`Povuceno ${amount} RSD sa kartice na racun.`);
                    }
                    await loadCards();
                    await loadAccounts();
                    setTopUpCardId(null);
                  } catch (err) {
                    toast.error(getErrorMessage(err, topUpDirection === 'top-up' ? 'Dopuna nije uspela.' : 'Povlacenje nije uspelo.'));
                  } finally {
                    setTopUpBusy(false);
                  }
                }}
              >
                {topUpBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {topUpDirection === 'top-up' ? 'Dopuni' : 'Povuci'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
