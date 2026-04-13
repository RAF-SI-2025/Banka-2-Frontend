import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronUp,
  Landmark,
  Loader2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/notify';
import marginService from '@/services/marginService';
import type { MarginAccount, MarginTransaction } from '@/services/marginService';
import { formatAmount, getErrorMessage } from '@/utils/formatters';

type ModalType = 'deposit' | 'withdraw';

export default function MarginAccountsPage() {
  const [accounts, setAccounts] = useState<MarginAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Transaction history state per account
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [transactions, setTransactions] = useState<Record<number, MarginTransaction[]>>({});
  const [loadingTransactions, setLoadingTransactions] = useState<Set<number>>(new Set());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('deposit');
  const [modalAccount, setModalAccount] = useState<MarginAccount | null>(null);
  const [modalAmount, setModalAmount] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const data = await marginService.getMyAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      // Handle 404 gracefully
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 404
      ) {
        setAccounts([]);
      } else {
        setAccounts([]);
        setLoadError(getErrorMessage(error, 'Neuspesno ucitavanje marznih racuna.'));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const toggleTransactions = async (accountId: number) => {
    const next = new Set(expandedAccounts);
    if (next.has(accountId)) {
      next.delete(accountId);
      setExpandedAccounts(next);
      return;
    }

    next.add(accountId);
    setExpandedAccounts(next);

    if (transactions[accountId]) return;

    setLoadingTransactions((prev) => new Set(prev).add(accountId));

    try {
      const data = await marginService.getTransactions(accountId);
      setTransactions((prev) => ({ ...prev, [accountId]: Array.isArray(data) ? data : [] }));
    } catch {
      setTransactions((prev) => ({ ...prev, [accountId]: [] }));
    } finally {
      setLoadingTransactions((prev) => {
        const s = new Set(prev);
        s.delete(accountId);
        return s;
      });
    }
  };

  const openModal = (account: MarginAccount, type: ModalType) => {
    setModalAccount(account);
    setModalType(type);
    setModalAmount('');
    setModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (!modalAccount) return;
    const amount = Number(modalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Unesite validan iznos veci od 0.');
      return;
    }

    setModalSubmitting(true);

    try {
      if (modalType === 'deposit') {
        await marginService.deposit(modalAccount.id, amount);
        toast.success('Uplata je uspesno izvrsena.');
      } else {
        await marginService.withdraw(modalAccount.id, amount);
        toast.success('Isplata je uspesno izvrsena.');
      }
      setModalOpen(false);
      void loadAccounts();
      // Refresh transactions if expanded
      if (expandedAccounts.has(modalAccount.id)) {
        try {
          const data = await marginService.getTransactions(modalAccount.id);
          setTransactions((prev) => ({ ...prev, [modalAccount.id]: Array.isArray(data) ? data : [] }));
        } catch {
          // no-op
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error, `${modalType === 'deposit' ? 'Uplata' : 'Isplata'} nije uspela.`));
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Marzni racuni</h1>
            <p className="text-sm text-muted-foreground">
              Pregled i upravljanje vasim marznim racunima
            </p>
          </div>
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Greska pri ucitavanju</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-3">
                  <div className="h-6 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-60 animate-pulse rounded bg-muted/70" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="h-10 w-full animate-pulse rounded bg-muted" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 && !loadError ? (
          /* Empty state */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Landmark className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">Nemate otvorenih marznih racuna</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Trenutno nemate nijedan marzni racun. Marzni racuni se otvaraju automatski prilikom trgovanja na margini.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Account cards */
          <div className="grid gap-6 md:grid-cols-2">
            {accounts.map((account) => {
              const isBlocked = account.status === 'BLOCKED';
              const isExpanded = expandedAccounts.has(account.id);
              const accountTxns = transactions[account.id] ?? [];
              const isTxnLoading = loadingTransactions.has(account.id);

              return (
                <Card key={account.id} className={isBlocked ? 'border-red-300 dark:border-red-800' : ''}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                        <CardTitle className="text-base">{account.accountNumber}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Povezan sa: {account.linkedAccountNumber}
                      </p>
                    </div>
                    <Badge variant={isBlocked ? 'destructive' : 'success'}>
                      {isBlocked ? 'BLOKIRAN' : 'AKTIVAN'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Stats grid 2x2 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Inicijalna margina</p>
                        <p className="mt-1 font-mono font-semibold text-sm">
                          {formatAmount(account.initialMargin)} {account.currency}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Vrednost kredita</p>
                        <p className="mt-1 font-mono font-semibold text-sm">
                          {formatAmount(account.loanValue)} {account.currency}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Margina odrzavanja</p>
                        <p className="mt-1 font-mono font-semibold text-sm">
                          {formatAmount(account.maintenanceMargin)} {account.currency}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Ucesce banke</p>
                        <p className="mt-1 font-mono font-semibold text-sm">
                          {formatAmount(account.bankParticipation)}%
                        </p>
                      </div>
                    </div>

                    {/* Blocked banner */}
                    {isBlocked && (
                      <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                        Racun je blokiran. Uplatite sredstva da biste ga odblokirali.
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openModal(account, 'deposit')}
                      >
                        <ArrowDownToLine className="mr-2 h-4 w-4" />
                        Uplati
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={isBlocked}
                        onClick={() => openModal(account, 'withdraw')}
                      >
                        <ArrowUpFromLine className="mr-2 h-4 w-4" />
                        Isplati
                      </Button>
                    </div>

                    {/* Transaction history expandable */}
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => void toggleTransactions(account.id)}
                    >
                      <span>Istorija transakcija</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="space-y-2">
                        {isTxnLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : accountTxns.length === 0 ? (
                          <p className="py-3 text-center text-sm text-muted-foreground">
                            Nema transakcija za prikaz.
                          </p>
                        ) : (
                          <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-2">
                            {accountTxns.map((txn) => (
                              <div
                                key={txn.id}
                                className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="font-medium">
                                    {txn.type === 'DEPOSIT' ? 'Uplata' : 'Isplata'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(txn.createdAt).toLocaleDateString('sr-RS')}{' '}
                                    {new Date(txn.createdAt).toLocaleTimeString('sr-RS', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                                <span
                                  className={`font-mono font-semibold ${
                                    txn.type === 'DEPOSIT'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {txn.type === 'DEPOSIT' ? '+' : '-'}
                                  {formatAmount(txn.amount)} {txn.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit / Withdraw Modal */}
      <Dialog.Root
        open={modalOpen}
        onOpenChange={(open) => {
          if (!modalSubmitting) {
            setModalOpen(open);
            if (!open) setModalAccount(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  {modalType === 'deposit' ? 'Uplata na marzni racun' : 'Isplata sa marznog racuna'}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {modalAccount?.accountNumber}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Zatvori"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="margin-amount">Iznos ({modalAccount?.currency ?? 'RSD'})</Label>
                <Input
                  id="margin-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" disabled={modalSubmitting}>
                    Odustani
                  </Button>
                </Dialog.Close>
                <Button
                  type="button"
                  onClick={() => void handleModalSubmit()}
                  disabled={modalSubmitting || !modalAmount}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                >
                  {modalSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Obrada...
                    </>
                  ) : modalType === 'deposit' ? (
                    'Uplati'
                  ) : (
                    'Isplati'
                  )}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
