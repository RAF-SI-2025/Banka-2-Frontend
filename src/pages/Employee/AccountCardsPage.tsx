// FE2-14b: Employee portal - upravljanje karticama po racunu

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  CreditCard as CreditCardIcon,
  ShieldCheck,
  ShieldOff,
  ShieldX,
  Loader2,
  CheckCircle2,
  Ban,
  XCircle,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { cardService } from '@/services/cardService';
import type { Account, CardType, Card as BankCard } from '@/types/celina2';
import { formatDate, formatBalance, formatAccountNumber } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  CARD_STATUS_LABELS as cardStatusLabels,
  CARD_STATUS_DOTS as cardStatusDots,
  CARD_TYPE_LABELS as cardTypeLabels,
} from '@/utils/cardLabels';

const cardTypeGradients: Record<string, string> = {
  VISA: 'from-blue-600 to-blue-800',
  MASTERCARD: 'from-orange-500 to-red-600',
  DINACARD: 'from-emerald-500 to-green-700',
  AMERICAN_EXPRESS: 'from-indigo-500 to-violet-700',
};

export default function AccountCardsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [accountNumber, setAccountNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [searchResults, setSearchResults] = useState<Account[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [newCardType, setNewCardType] = useState<CardType | ''>('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Stats
  const stats = {
    total: cards.length,
    active: cards.filter(c => c.status === 'ACTIVE').length,
    blocked: cards.filter(c => c.status === 'BLOCKED').length,
    deactivated: cards.filter(c => c.status === 'DEACTIVATED').length,
  };

  // Load account and cards from route param
  useEffect(() => {
    const loadById = async () => {
      if (!id) return;
      const accountId = Number(id);
      if (!accountId || Number.isNaN(accountId)) return;
      setLoading(true);
      try {
        const accountData = await accountService.getById(accountId);
        setAccountNumber(accountData.accountNumber);
        setAccount(accountData);
        const cardsData = await cardService.getByAccount(accountId);
        setCards(Array.isArray(cardsData) ? cardsData : []);
      } catch {
        toast.error('Greska pri ucitavanju racuna.');
      } finally {
        setLoading(false);
      }
    };
    loadById();
  }, [id]);

  const searchCards = useCallback(async () => {
    if (!accountNumber && !ownerName.trim()) {
      toast.error('Unesite broj racuna ili ime vlasnika.');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);
    try {
      if (ownerName.trim() && !accountNumber) {
        const allAccounts = await accountService.getAll({ ownerName: ownerName.trim(), page: 0, limit: 20 });
        const results = allAccounts.content ?? [];
        if (results.length === 0) throw new Error('Nema rezultata');
        if (results.length === 1) {
          const accountData = results[0];
          setAccount(accountData);
          const cardsData = await cardService.getByAccount(accountData.id);
          setCards(Array.isArray(cardsData) ? cardsData : []);
        } else {
          setSearchResults(results);
          setAccount(null);
          setCards([]);
        }
        return;
      }

      let accountData;
      const numId = Number(accountNumber);
      if (Number.isFinite(numId) && numId > 0 && numId < 1000000) {
        accountData = await accountService.getById(numId);
      } else {
        const allAccounts = await accountService.getAll({ page: 0, limit: 100 });
        const found = allAccounts.content?.find((a: { accountNumber?: string }) =>
          a.accountNumber?.includes(accountNumber.replace(/-/g, ''))
        );
        if (!found) throw new Error('Racun nije pronadjen');
        accountData = found;
      }
      setAccount(accountData);
      const cardsData = await cardService.getByAccount(accountData.id);
      setCards(Array.isArray(cardsData) ? cardsData : []);
    } catch {
      setError('Pretraga kartica nije uspela.');
      setCards([]);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [accountNumber, ownerName]);

  const selectSearchResult = useCallback(async (selectedAccount: Account) => {
    setSearchResults([]);
    setAccount(selectedAccount);
    setAccountNumber(selectedAccount.accountNumber);
    setLoading(true);
    try {
      const cardsData = await cardService.getByAccount(selectedAccount.id);
      setCards(Array.isArray(cardsData) ? cardsData : []);
    } catch {
      toast.error('Ucitavanje kartica nije uspelo.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = async (cardId: number, action: 'block' | 'unblock' | 'deactivate') => {
    if (action === 'deactivate') {
      const confirmed = window.confirm(
        'Da li ste sigurni da zelite da deaktivirate karticu? Deaktivirana kartica se NE MOZE ponovo aktivirati.'
      );
      if (!confirmed) return;
    }
    setProcessingId(cardId);
    try {
      if (action === 'block') await cardService.block(cardId);
      if (action === 'unblock') await cardService.unblock(cardId);
      if (action === 'deactivate') await cardService.deactivate(cardId);
      toast.success('Status kartice je azuriran.');
      await searchCards();
    } catch {
      toast.error('Akcija nad karticom nije uspela.');
    } finally {
      setProcessingId(null);
    }
  };

  const createNewCard = async () => {
    if (!accountNumber || !newCardType) {
      toast.error('Izaberite tip kartice.');
      return;
    }

    setIsCreating(true);
    try {
      await cardService.create({ accountId: account?.id ?? 0 });
      toast.success('Kartica kreirana.');
      setShowCreateCard(false);
      setNewCardType('');
      await searchCards();
    } catch {
      toast.error('Kreiranje kartice nije uspelo.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/employee/accounts')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Nazad na portal racuna
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <CreditCardIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portal kartica</h1>
            <p className="text-sm text-muted-foreground">
              Pregledajte i upravljajte karticama za odabrani racun.
            </p>
          </div>
        </div>
      </div>

      {/* Stats row (visible when cards are loaded) */}
      {account && cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Ukupno', value: stats.total, icon: CreditCardIcon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
            { label: 'Aktivne', value: stats.active, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
            { label: 'Blokirane', value: stats.blocked, icon: Ban, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
            { label: 'Deaktivirane', value: stats.deactivated, icon: XCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
          ].map((s) => (
            <Card key={s.label} className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold font-mono">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <Search className="h-4 w-4 text-indigo-500" />
            <CardTitle>Pretraga racuna</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-sm font-medium">Broj racuna</label>
              <div className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.01]' : ''}`}>
                <Search className={`absolute left-3 top-2.5 h-4 w-4 transition-colors ${searchFocused ? 'text-indigo-500' : 'text-muted-foreground'}`} />
                <Input
                  placeholder="18 cifara"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="pl-9 h-10"
                  onKeyDown={(e) => e.key === 'Enter' && searchCards()}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-sm font-medium">Ime vlasnika</label>
              <Input
                placeholder="Ime ili prezime"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCards()}
                className="h-10"
              />
            </div>
            <Button
              onClick={searchCards}
              disabled={loading}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all h-10"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Pretrazi
            </Button>
            <Button variant="outline" onClick={() => setShowCreateCard(!showCreateCard)} className="h-10">
              <Plus className="mr-2 h-4 w-4" /> Nova kartica
            </Button>
          </div>

          {/* Search results list */}
          {searchResults.length > 0 && (
            <div className="border rounded-xl divide-y shadow-lg overflow-hidden">
              <p className="px-4 py-2.5 text-xs text-muted-foreground font-medium bg-muted/30">
                Pronadjeno {searchResults.length} racuna -- izaberite:
              </p>
              {searchResults.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className="w-full text-left px-4 py-3 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between gap-2"
                  onClick={() => selectSearchResult(acc)}
                >
                  <span>
                    <strong>{acc.ownerName || '-'}</strong>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{formatAccountNumber(acc.accountNumber)}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${acc.status === 'ACTIVE' ? 'bg-emerald-500' : acc.status === 'BLOCKED' ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <span className="text-xs">{acc.status === 'ACTIVE' ? 'Aktivan' : acc.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Account info */}
          {account && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-5 py-3.5 text-sm">
              <span>Racun: <strong className="font-mono">{formatAccountNumber(account.accountNumber)}</strong></span>
              <span>Vlasnik: <strong>{account.ownerName}</strong></span>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${account.status === 'ACTIVE' ? 'bg-emerald-500' : account.status === 'BLOCKED' ? 'bg-red-500' : 'bg-gray-400'}`} />
                <span className="text-sm">{account.status === 'ACTIVE' ? 'Aktivan' : account.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create card form */}
      {showCreateCard && account && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <Plus className="h-4 w-4 text-indigo-500" />
              <CardTitle>Nova kartica</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tip kartice</label>
                <Select value={newCardType} onValueChange={(val) => setNewCardType(val as CardType)}>
                  <SelectTrigger className="w-[220px] h-10">
                    <SelectValue placeholder="Izaberite tip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VISA">Visa</SelectItem>
                    <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                    <SelectItem value="DINACARD">DinaCard</SelectItem>
                    <SelectItem value="AMERICAN_EXPRESS">American Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={createNewCard}
                disabled={isCreating || !newCardType}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all h-10"
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Kreiraj karticu
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreateCard(false); setNewCardType(''); }} className="h-10">
                Otkazi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cards display */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
          ))}
        </div>
      ) : !account ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <CreditCardIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Pretrazite racun da biste videli kartice</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Unesite broj racuna ili ime vlasnika i kliknite na pretragu.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : cards.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <CreditCardIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Nema kartica za ovaj racun</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Kreirajte novu karticu pomocu dugmeta iznad.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const gradient = (card.cardType && cardTypeGradients[card.cardType]) || 'from-indigo-500 to-violet-700';
            return (
              <Card
                key={card.id}
                className="rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {/* Visual card header */}
                <div className={`relative bg-gradient-to-br ${gradient} p-5 text-white`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/20" />
                    <div className="absolute -left-3 -bottom-3 h-20 w-20 rounded-full bg-white/10" />
                  </div>
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                        {card.cardName || (card.cardType && cardTypeLabels[card.cardType]) || 'Kartica'}
                      </span>
                      <CreditCardIcon className="h-5 w-5 text-white/40" />
                    </div>
                    <p className="text-lg font-mono font-bold tracking-widest">
                      {/* BE vec vraca maskiran broj (5798********5571) — ne re-maskiramo. */}
                      {card.cardNumber || '—'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{card.ownerName || card.holderName || '-'}</span>
                      <span>{formatDate(card.expirationDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Card details */}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${cardStatusDots[card.status]}`} />
                      <span className="text-sm font-medium">{cardStatusLabels[card.status] || card.status}</span>
                    </div>
                    <span className="text-sm font-mono font-semibold tabular-nums">
                      {formatBalance(card.cardLimit ?? card.limit ?? 0, account?.currency ?? '')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {card.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8"
                        onClick={() => runAction(card.id, 'block')}
                        disabled={processingId === card.id}
                      >
                        {processingId === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="mr-1 h-3.5 w-3.5" />}
                        Blokiraj
                      </Button>
                    )}
                    {card.status === 'BLOCKED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8"
                        onClick={() => runAction(card.id, 'unblock')}
                        disabled={processingId === card.id}
                      >
                        {processingId === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
                        Deblokiraj
                      </Button>
                    )}
                    {card.status === 'DEACTIVATED' && (
                      <span className="flex-1 flex items-center justify-center text-xs text-muted-foreground h-8">Trajno deaktivirana</span>
                    )}
                    {card.status !== 'DEACTIVATED' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8"
                        onClick={() => runAction(card.id, 'deactivate')}
                        disabled={processingId === card.id}
                      >
                        {processingId === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
