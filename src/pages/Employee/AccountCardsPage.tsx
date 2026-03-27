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
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { cardService } from '@/services/cardService';
import type { Account, CardType, Card as BankCard } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const cardStatusLabels: Record<string, string> = {
  ACTIVE: 'Aktivna',
  BLOCKED: 'Blokirana',
  DEACTIVATED: 'Deaktivirana',
};

const cardStatusVariant: Record<string, 'success' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  BLOCKED: 'destructive',
  DEACTIVATED: 'secondary',
};

const cardTypeLabels: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  DINACARD: 'DinaCard',
  AMERICAN_EXPRESS: 'American Express',
};

function maskCardNumber(number: string): string {
  return `**** **** **** ${number.slice(-4)}`;
}

function formatBalance(amount: number, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount) || 0;
  return `${n.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`;
}

function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length !== 18) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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
      // Pretraga po imenu vlasnika - prikazuje listu rezultata
      if (ownerName.trim() && !accountNumber) {
        const allAccounts = await accountService.getAll({ ownerName: ownerName.trim(), page: 0, limit: 20 });
        const results = allAccounts.content ?? [];
        if (results.length === 0) throw new Error('Nema rezultata');
        if (results.length === 1) {
          // Samo jedan rezultat - odmah ga selektuj
          const accountData = results[0];
          setAccount(accountData);
          const cardsData = await cardService.getByAccount(accountData.id);
          setCards(Array.isArray(cardsData) ? cardsData : []);
        } else {
          // Vise rezultata - prikazi listu za izbor
          setSearchResults(results);
          setAccount(null);
          setCards([]);
        }
        return;
      }

      // Pretraga po broju racuna / ID-ju
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
        <div>
          <div className="flex items-center gap-2">
            <CreditCardIcon className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Portal kartica</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pregledajte i upravljajte karticama za odabrani racun.
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <Search className="h-4 w-4 text-indigo-500" />
            <CardTitle>Pretraga racuna</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-sm font-medium">Broj racuna</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="18 cifara"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="pl-8"
                  onKeyDown={(e) => e.key === 'Enter' && searchCards()}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-sm font-medium">Ime vlasnika</label>
              <Input
                placeholder="Ime ili prezime"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCards()}
              />
            </div>
            <Button
              onClick={searchCards}
              disabled={loading}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Pretrazi
            </Button>
            <Button variant="outline" onClick={() => setShowCreateCard(!showCreateCard)}>
              <Plus className="mr-2 h-4 w-4" /> Nova kartica
            </Button>
          </div>

          {/* Search results list (multiple accounts found by name) */}
          {searchResults.length > 0 && (
            <div className="border rounded-md divide-y shadow-sm">
              <p className="px-3 py-2 text-xs text-muted-foreground font-medium bg-muted/30">
                Pronadjeno {searchResults.length} racuna -- izaberite:
              </p>
              {searchResults.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between gap-2"
                  onClick={() => selectSearchResult(acc)}
                >
                  <span>
                    <strong>{acc.ownerName || '-'}</strong>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{formatAccountNumber(acc.accountNumber)}</span>
                  </span>
                  <Badge variant={acc.status === 'ACTIVE' ? 'success' : acc.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                    {acc.status === 'ACTIVE' ? 'Aktivan' : acc.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {/* Account info */}
          {account && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <span>Racun: <strong className="font-mono">{formatAccountNumber(account.accountNumber)}</strong></span>
              <span>Vlasnik: <strong>{account.ownerName}</strong></span>
              <Badge variant={account.status === 'ACTIVE' ? 'success' : account.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                {account.status === 'ACTIVE' ? 'Aktivan' : account.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create card form */}
      {showCreateCard && account && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <Plus className="h-4 w-4 text-indigo-500" />
              <CardTitle>Nova kartica</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tip kartice</label>
                <Select value={newCardType} onValueChange={(val) => setNewCardType(val as CardType)}>
                  <SelectTrigger className="w-[200px]">
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
                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Kreiraj karticu
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreateCard(false); setNewCardType(''); }}>
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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj kartice</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Vlasnik</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Istek</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-36 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell className="text-right"><div className="ml-auto h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : !account ? (
        <Card>
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
        <Card>
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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj kartice</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Vlasnik</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Istek</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono">{maskCardNumber(card.cardNumber)}</TableCell>
                  <TableCell>
                    <Badge variant="info">{cardTypeLabels[card.cardType] || card.cardType}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{card.holderName}</TableCell>
                  <TableCell className="font-medium">
                    {formatBalance(card.limit, account.currency)}
                  </TableCell>
                  <TableCell>{formatDate(card.expirationDate)}</TableCell>
                  <TableCell>
                    <Badge variant={cardStatusVariant[card.status]}>
                      {cardStatusLabels[card.status] || card.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {card.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAction(card.id, 'block')}
                          disabled={processingId === card.id}
                          title="Blokiraj"
                        >
                          {processingId === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldOff className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {card.status === 'BLOCKED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAction(card.id, 'unblock')}
                          disabled={processingId === card.id}
                          title="Deblokiraj"
                        >
                          {processingId === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {card.status !== 'DEACTIVATED' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => runAction(card.id, 'deactivate')}
                          disabled={processingId === card.id}
                          title="Deaktiviraj"
                        >
                          {processingId === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldX className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
