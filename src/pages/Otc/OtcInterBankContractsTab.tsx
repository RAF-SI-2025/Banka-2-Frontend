import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import interbankOtcService from '@/services/interbankOtcService';
import { accountService } from '@/services/accountService';
import type { Account } from '@/types/celina2';
import type {
  InterbankTransaction,
  OtcInterbankContract,
  OtcInterbankContractStatus,
} from '@/types/celina4';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { asArray, formatAmount, formatDate, formatDateTime, getErrorMessage } from '@/utils/formatters';

const CONTRACT_STATUS_LABEL: Record<OtcInterbankContractStatus, string> = {
  ACTIVE: 'Aktivan',
  EXERCISED: 'Iskoriscen',
  EXPIRED: 'Istekao',
};

const SAGA_PHASES = [
  'Rezervacija sredstava',
  'Rezervacija hartija',
  'Transfer',
  'Prenos vlasnistva',
  'Finalizacija',
] as const;

type FilterValue = OtcInterbankContractStatus | 'ALL';

type SagaProgressState = {
  contract: OtcInterbankContract;
  transaction: InterbankTransaction;
};

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background';

function isTerminalStatus(status: InterbankTransaction['status']) {
  return status === 'COMMITTED' || status === 'ABORTED' || status === 'STUCK';
}

function getStatusBadgeVariant(status: OtcInterbankContractStatus): 'success' | 'secondary' | 'warning' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'EXERCISED') return 'secondary';
  return 'warning';
}

function getTransactionLookupId(transaction: InterbankTransaction): string {
  return transaction.transactionId || String(transaction.id);
}

function normalizePhase(phase: string | null | undefined): string {
  return String(phase ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function getCurrentPhaseIndex(transaction: InterbankTransaction): number | null {
  if (transaction.status === 'COMMITTED') return 5;

  const phase = normalizePhase(transaction.currentPhase);
  if (!phase) {
    return null;
  }

  if (phase.includes('FINAL') || phase.includes('COMMIT')) return 5;
  if (phase.includes('OWNERSHIP') || phase.includes('VLASNIST')) return 4;
  if (phase.includes('TRANSFER')) return 3;
  if (phase.includes('SECUR') || phase.includes('HARTIJ') || phase.includes('STOCK')) return 2;
  if (phase.includes('FUND') || phase.includes('SREDST')) return 1;

  return null;
}

function isFutureSettlementDate(settlementDate: string): boolean {
  const date = new Date(`${settlementDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

function matchesCurrentUser(contract: OtcInterbankContract, user: ReturnType<typeof useAuth>['user']): boolean {
  if (!user) return false;

  const identifiers = new Set(
    [
      String(user.id),
      user.email,
      user.username,
      `${user.firstName} ${user.lastName}`.trim(),
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  return [contract.buyerUserId, contract.buyerName]
    .map((value) => value.trim().toLowerCase())
    .some((value) => identifiers.has(value));
}

function getPreferredAccount(accounts: Account[], currency: string): Account | undefined {
  return accounts.find((account) => account.currency === currency) ?? accounts[0];
}

export default function OtcInterBankContractsTab() {
  const { user, isAdmin, isAgent, isSupervisor } = useAuth();
  const isEmployee = isAdmin || isAgent || isSupervisor;

  const [contracts, setContracts] = useState<OtcInterbankContract[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [selectedContract, setSelectedContract] = useState<OtcInterbankContract | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [busyContractId, setBusyContractId] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<SagaProgressState | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const reloadContracts = useCallback(async (nextFilter: FilterValue = filter) => {
    setLoadingContracts(true);
    try {
      const data = await interbankOtcService.listMyContracts(nextFilter === 'ALL' ? undefined : nextFilter);
      setContracts(data ?? []);
    } catch {
      toast.error('Neuspesno ucitavanje inter-bank ugovora.');
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  }, [filter]);

  useEffect(() => {
    void reloadContracts(filter);
  }, [filter, reloadContracts]);

  useEffect(() => {
    void (async () => {
      try {
        const data = isEmployee
          ? asArray<Account>(await accountService.getBankAccounts())
          : asArray<Account>(await accountService.getMyAccounts());
        setAccounts(data.filter((account) => account.status === 'ACTIVE'));
      } catch {
        setAccounts([]);
      }
    })();
  }, [isEmployee]);

  useEffect(() => {
    if (!progressState) {
      return;
    }

    if (isTerminalStatus(progressState.transaction.status)) {
      return;
    }

    const transactionLookupId = getTransactionLookupId(progressState.transaction);
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const { data } = await api.get<InterbankTransaction>(`/interbank/payments/${transactionLookupId}`);
          setProgressState((current) => current ? { ...current, transaction: data } : current);

          if (isTerminalStatus(data.status)) {
            window.clearInterval(intervalId);
            await reloadContracts(filter);

            if (data.status === 'COMMITTED') {
              toast.success('Inter-bank exercise je uspesno finalizovan.');
            } else {
              toast.error(data.failureReason || 'Inter-bank exercise je prekinut.');
            }
          }
        } catch (error) {
          window.clearInterval(intervalId);
          const message = getErrorMessage(error, 'Neuspesno pracenje inter-bank SAGA statusa.');
          setPollError(message);
          toast.error(message);
        }
      })();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [filter, progressState, reloadContracts]);

  const currentPhaseIndex = getCurrentPhaseIndex(progressState?.transaction ?? {
    id: 0,
    transactionId: '',
    type: 'OTC',
    status: 'INITIATED',
    senderBankCode: '',
    receiverBankCode: '',
    createdAt: '',
    retryCount: 0,
  });

  const progressValue = currentPhaseIndex == null ? 15 : (currentPhaseIndex / SAGA_PHASES.length) * 100;
  const progressTerminal = progressState ? isTerminalStatus(progressState.transaction.status) : false;

  const openExerciseDialog = (contract: OtcInterbankContract) => {
    const preferredAccount = getPreferredAccount(accounts, contract.listingCurrency);
    setSelectedContract(contract);
    setSelectedAccountId(preferredAccount ? String(preferredAccount.id) : '');
  };

  const closeExerciseDialog = () => {
    if (busyContractId) {
      return;
    }
    setSelectedContract(null);
    setSelectedAccountId('');
  };

  const closeProgressDialog = () => {
    if (!progressTerminal && !pollError) {
      return;
    }
    setProgressState(null);
    setPollError(null);
  };

  const handleExercise = async () => {
    if (!selectedContract) {
      return;
    }

    const buyerAccountId = Number(selectedAccountId);
    if (!Number.isFinite(buyerAccountId) || buyerAccountId <= 0) {
      toast.error('Izaberite racun za placanje strike cene.');
      return;
    }

    setBusyContractId(selectedContract.id);
    try {
      const transaction = await interbankOtcService.exerciseContract(selectedContract.id, buyerAccountId);
      setSelectedContract(null);
      setPollError(null);
      setProgressState({ contract: selectedContract, transaction });

      if (isTerminalStatus(transaction.status)) {
        await reloadContracts(filter);

        if (transaction.status === 'COMMITTED') {
          toast.success('Inter-bank exercise je uspesno finalizovan.');
        } else {
          toast.error(transaction.failureReason || 'Inter-bank exercise je prekinut.');
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Pokretanje inter-bank exercise flow-a nije uspelo.'));
    } finally {
      setBusyContractId(null);
    }
  };

  const selectedAccount = useMemo(
    () => accounts.find((account) => String(account.id) === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const selectedContractMetrics = useMemo(() => {
    if (!selectedContract) {
      return null;
    }

    const strikeCost = selectedContract.strikePrice * selectedContract.quantity;
    const marketValue =
      selectedContract.currentPrice != null
        ? selectedContract.currentPrice * selectedContract.quantity
        : null;
    const projectedProfit =
      marketValue != null
        ? marketValue - strikeCost - selectedContract.premium
        : null;

    return { strikeCost, marketValue, projectedProfit };
  }, [selectedContract]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Sklopljeni inter-bank ugovori</CardTitle>
          <div className="flex gap-1" role="tablist" aria-label="Filter statusa inter-bank ugovora">
            {(['ALL', 'ACTIVE', 'EXERCISED', 'EXPIRED'] as FilterValue[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === value
                    ? 'bg-indigo-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                role="tab"
                aria-selected={filter === value}
              >
                {value === 'ALL' ? 'Svi' : CONTRACT_STATUS_LABEL[value]}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loadingContracts ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nema inter-bank ugovora za izabrani status.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hartija</TableHead>
                  <TableHead>Banka kupca / prodavca</TableHead>
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
                {contracts.map((contract) => {
                  const amBuyer = matchesCurrentUser(contract, user);
                  const canExercise =
                    contract.status === 'ACTIVE' &&
                    amBuyer &&
                    isFutureSettlementDate(contract.settlementDate);

                  return (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{contract.listingTicker}</span>
                          <span className="text-xs text-muted-foreground">{contract.listingName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>Kupac: {contract.buyerBankCode}</div>
                        <div className="text-muted-foreground">Prodavac: {contract.sellerBankCode}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>Kupac: {contract.buyerName}</div>
                        <div className="text-muted-foreground">Prodavac: {contract.sellerName}</div>
                      </TableCell>
                      <TableCell className="font-mono">{contract.quantity}</TableCell>
                      <TableCell className="font-mono text-sm">
                        <div>
                          {formatAmount(contract.strikePrice)} {contract.listingCurrency}
                        </div>
                        <div className="text-muted-foreground">
                          Prem: {formatAmount(contract.premium)} {contract.listingCurrency}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {contract.currentPrice != null
                          ? `${formatAmount(contract.currentPrice)} ${contract.listingCurrency}`
                          : '-'}
                      </TableCell>
                      <TableCell>{formatDate(contract.settlementDate)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(contract.status)}>
                          {CONTRACT_STATUS_LABEL[contract.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canExercise ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyContractId === contract.id}
                            onClick={() => openExerciseDialog(contract)}
                            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                          >
                            <Zap className="mr-1 h-3.5 w-3.5" />
                            Iskoristi
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

      {accounts.length === 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nemate aktivan racun za placanje strike cene.
          </AlertDescription>
        </Alert>
      )}

      <Dialog.Root open={!!selectedContract} onOpenChange={(open) => !open && closeExerciseDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  Iskoristi inter-bank opciju
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Pregled troska, projekcije profita i izbor racuna za placanje strike cene.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={busyContractId != null}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Zatvori"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {selectedContract && selectedContractMetrics && (
              <div className="space-y-5 p-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Strike × kolicina
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {formatAmount(selectedContractMetrics.strikeCost)} {selectedContract.listingCurrency}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Trenutna trzisna vrednost
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {selectedContractMetrics.marketValue != null
                          ? `${formatAmount(selectedContractMetrics.marketValue)} ${selectedContract.listingCurrency}`
                          : '-'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Profit projekcija
                      </div>
                      <div
                        className={`mt-2 text-lg font-semibold ${
                          (selectedContractMetrics.projectedProfit ?? 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {selectedContractMetrics.projectedProfit != null
                          ? `${formatAmount(selectedContractMetrics.projectedProfit)} ${selectedContract.listingCurrency}`
                          : '-'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <div className="font-medium">
                    {selectedContract.listingTicker} · {selectedContract.quantity} akcija
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Dospece: {formatDate(selectedContract.settlementDate)} · Kreiran: {formatDateTime(selectedContract.createdAt)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interbank-exercise-account">
                    Racun za placanje strike cene
                  </Label>
                  <select
                    id="interbank-exercise-account"
                    className={selectClassName}
                    value={selectedAccountId}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                  >
                    <option value="">Izaberite racun</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={String(account.id)}>
                        {account.accountNumber} · {account.currency}
                      </option>
                    ))}
                  </select>
                  {selectedAccount && (
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                      Dostupno: {formatAmount(selectedAccount.availableBalance)} {selectedAccount.currency}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeExerciseDialog}>
                    Otkazi
                  </Button>
                  <Button
                    type="button"
                    disabled={busyContractId === selectedContract.id}
                    onClick={handleExercise}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                  >
                    {busyContractId === selectedContract.id ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Pokrecem SAGA...
                      </>
                    ) : (
                      <>
                        <Wallet className="mr-1 h-4 w-4" />
                        Potvrdi exercise
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={!!progressState}
        onOpenChange={(open) => {
          if (!open) {
            closeProgressDialog();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  SAGA exercise u toku
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Status inter-bank prenosa novca i vlasnistva nad hartijama.
                </Dialog.Description>
              </div>
              {progressTerminal || pollError ? (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Zatvori"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              ) : null}
            </div>

            {progressState && (
              <div className="space-y-5 p-6">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {progressState.contract.listingTicker} · {progressState.contract.quantity} akcija
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Transaction ID: {getTransactionLookupId(progressState.transaction)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        progressState.transaction.status === 'COMMITTED'
                          ? 'success'
                          : progressState.transaction.status === 'ABORTED'
                            ? 'destructive'
                            : 'info'
                      }
                    >
                      {progressState.transaction.status}
                    </Badge>
                  </div>
                </div>

                {currentPhaseIndex == null ? (
                  <Alert variant={progressTerminal ? 'success' : pollError ? 'destructive' : 'info'}>
                    {pollError ? (
                      <XCircle className="h-4 w-4" />
                    ) : progressTerminal ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <AlertTitle>
                      {pollError
                        ? 'Pracenje SAGA statusa nije uspelo'
                        : progressTerminal
                          ? 'SAGA flow je zavrsen'
                          : 'Izvrsavanje u toku...'}
                    </AlertTitle>
                    <AlertDescription>
                      {pollError
                        ? pollError
                        : progressState.transaction.failureReason ||
                          'Backend jos ne vraca currentPhase, pa se prikazuje pojednostavljen status spinner.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <Progress value={progressValue} indicatorClassName="bg-gradient-to-r from-indigo-500 to-violet-600" />
                    <div className="space-y-3">
                      {SAGA_PHASES.map((label, index) => {
                        const phaseNumber = index + 1;
                        const completed = progressState.transaction.status === 'COMMITTED' || phaseNumber < currentPhaseIndex;
                        const active =
                          !progressTerminal &&
                          !pollError &&
                          phaseNumber === currentPhaseIndex;
                        const failed =
                          progressState.transaction.status === 'ABORTED' &&
                          phaseNumber === currentPhaseIndex;

                        return (
                          <div
                            key={label}
                            className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                              completed
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : active
                                  ? 'border-indigo-500/30 bg-indigo-500/5'
                                  : failed
                                    ? 'border-red-500/30 bg-red-500/5'
                                    : 'border-border bg-background'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {completed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : failed ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : active ? (
                                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                              ) : (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold text-muted-foreground">
                                  {phaseNumber}
                                </span>
                              )}
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {completed ? 'Zavrseno' : failed ? 'Prekinuto' : active ? 'U toku' : 'Na cekanju'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {progressState.transaction.failureReason && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>SAGA je abortirana</AlertTitle>
                    <AlertDescription>
                      {progressState.transaction.failureReason}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
