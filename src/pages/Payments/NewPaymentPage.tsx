//
// Ova stranica sadrzi formu za kreiranje novog platnog naloga.
// - react-hook-form + zodResolver(newPaymentSchema)
// - Polja: racun posiljaoca (dropdown mojih racuna), racun primaoca, ime primaoca,
//   iznos, sifra placanja, svrha placanja, model, poziv na broj, referentni broj
// - Mogucnost biranja primaoca iz liste sacuvanih (paymentRecipientService.getAll)
// - Nakon submit => transactionService.createPayment()
// - Otvara VerificationModal za OTP potvrdu
// - Spec: "Novi platni nalog" stranica iz Celine 2

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { paymentRecipientService } from '@/services/paymentRecipientService';
import { transactionService } from '@/services/transactionService';
import interbankPaymentService from '@/services/interbankPaymentService';
import type { Account, PaymentRecipient } from '@/types/celina2';
import {
  INTERBANK_TERMINAL_STATUSES,
  type InterbankPayment,
  type InterbankPaymentInitiateRequest,
} from '@/types/celina4';
import { newPaymentSchema, type NewPaymentFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VerificationModal from '@/components/shared/VerificationModal';
import { SendHorizonal, Wallet, ArrowRight, User, FileText, Hash, BookUser, CheckCircle2, X, Globe, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { asArray, formatAmount, getErrorMessage } from '@/utils/formatters';

const OUR_BANK_PREFIX = '222';
const INTERBANK_POLL_MS = 3000;
const INTERBANK_MAX_POLLS = 40;
// Spec Celina 5 (Nova) Sc 5/11 indirect FE coverage: kad korisnik reloaduje
// stranicu dok je inter-bank placanje u toku, zelimo da rehydrate-ujemo
// modal i nastavimo polling. txId se cuva u sessionStorage da preživi reload
// ali ne zatvaranje tab-a (sigurnosni princip kao i sa JWT-om).
const INTERBANK_ACTIVE_TX_KEY = 'interbank-active-tx';

function isInterbank(accountNumber: string): boolean {
  return accountNumber.length >= 3 && accountNumber.slice(0, 3) !== OUR_BANK_PREFIX;
}

// Spec Celina 5 (Nova) 2PC flow — 4 faze koje user vidi u stepper-u:
//   1. Inicijalizacija (INITIATED)
//   2. Prepare (PREPARING / PREPARED) — Banka A salje, Banka B priprema
//   3. Commit (COMMITTING) — sredstva idu sa A na B
//   4. Zavrseno (COMMITTED)
//
// Terminal statusi ABORTED i STUCK markiraju gde je flow stao + prikazuju
// failureReason ako BE pruzi.
const INTERBANK_STEPS = [
  { key: 'INITIATED', label: 'Inicijalizacija', description: 'Transakcija pokrenuta' },
  { key: 'PREPARED', label: 'Prepare', description: 'Banka primaoca proverava racun' },
  { key: 'COMMITTING', label: 'Commit', description: 'Prenos sredstava' },
  { key: 'COMMITTED', label: 'Zavrseno', description: 'Sredstva preneta primaocu' },
] as const;

type InterbankStepState = 'pending' | 'active' | 'done' | 'failed';

function getInterbankStepState(stepKey: string, status: string): InterbankStepState {
  // Mapa: koji step-index ce biti "active" za svaki status
  const stepIndex: Record<string, number> = {
    INITIATED: 0,
    PREPARING: 1,
    PREPARED: 1,
    COMMITTING: 2,
    ABORTING: 2,
    COMMITTED: 3,
    ABORTED: -1, // failed at last active step
    STUCK: -1,
  };
  const targetKeys: readonly string[] = INTERBANK_STEPS.map((s) => s.key);
  const stepKeyIndex = targetKeys.indexOf(stepKey);
  const activeIndex = stepIndex[status] ?? 0;

  if (status === 'COMMITTED') {
    return 'done'; // svi koraci zavrseni
  }

  if (status === 'ABORTED' || status === 'STUCK') {
    // Faza koja je pokusana ali nije uspela — uzimamo poslednje viđeno stanje.
    // Posto BE moze poslati ABORTING pre ABORTED, koristimo ABORTING-step kao
    // "failed marker"; ali ako je vec ABORTED bez ABORTING, padamo na PREPARING.
    // U praksi: ako je ABORTED, oznaci poslednji "active" step kao failed.
    if (stepKeyIndex < 2) return 'done'; // INITIATED, PREPARED se smatraju zavrsenim
    if (stepKeyIndex === 2) return 'failed'; // COMMITTING/ABORTING marker
    return 'pending'; // COMMITTED nije dosegnuto
  }

  if (stepKeyIndex < activeIndex) return 'done';
  if (stepKeyIndex === activeIndex) return 'active';
  return 'pending';
}

export default function NewPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAccount = searchParams.get('from') || '';
  const preselectedToAccount = searchParams.get('to') || '';
  const preselectedRecipient = searchParams.get('recipient') || '';
  const preselectedAmount = searchParams.get('amount') || '';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showVerification, setShowVerification] = useState(false);
  const [saveRecipientPrompt, setSaveRecipientPrompt] = useState<{ name: string; accountNumber: string } | null>(null);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [interbankTracking, setInterbankTracking] = useState<InterbankPayment | null>(null);
  const [retryingStuck, setRetryingStuck] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<NewPaymentFormData>({
    resolver: zodResolver(newPaymentSchema),
    defaultValues: {
      fromAccountNumber: preselectedAccount,
      toAccountNumber: preselectedToAccount,
      amount: preselectedAmount ? Number(preselectedAmount) : 0,
      recipientName: preselectedRecipient,
      paymentCode: '289',
      paymentPurpose: '',
      model: '',
      callNumber: '',
      referenceNumber: '',
    },
  });

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [myAccounts, savedRecipients] = await Promise.all([
          accountService.getMyAccounts(),
          paymentRecipientService.getAll(),
        ]);

        if (!mounted) return;
        const safeAccounts = asArray<Account>(myAccounts);
        const safeRecipients = asArray<PaymentRecipient>(savedRecipients);

        setAccounts(safeAccounts);
        setRecipients(safeRecipients);

        if (!preselectedAccount && safeAccounts.length > 0) {
          setValue('fromAccountNumber', safeAccounts[0].accountNumber);
        }
      } catch {
        if (!mounted) return;
        toast.error('Neuspesno ucitavanje racuna ili primalaca.');
        setAccounts([]);
        setRecipients([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [preselectedAccount, setValue]);

  const selectedRecipientAccount = watch('toAccountNumber');

  useEffect(() => {
    if (!selectedRecipientAccount) return;
    const selectedRecipient = asArray<PaymentRecipient>(recipients).find((r) => r.accountNumber === selectedRecipientAccount);
    if (selectedRecipient) {
      setValue('recipientName', selectedRecipient.name, { shouldValidate: true });
    }
  }, [recipients, selectedRecipientAccount, setValue]);

  const accountLookup = useMemo(() => {
    const map = new Map<string, Account>();
    asArray<Account>(accounts).forEach((account) => map.set(account.accountNumber, account));
    return map;
  }, [accounts]);

  const onSubmit = async () => {
    setShowVerification(true);
  };

  const selectedFrom = watch('fromAccountNumber');
  const fromAccount = accountLookup.get(selectedFrom);
  const fromAccountCurrency = fromAccount?.currency;

  // Watch all fields for live preview
  const watchedAmount = watch('amount');
  const watchedTo = watch('toAccountNumber');
  const watchedRecipientName = watch('recipientName');
  const watchedPurpose = watch('paymentPurpose');
  const watchedCode = watch('paymentCode');
  const watchedModel = watch('model');
  const watchedCallNumber = watch('callNumber');

  // Spec Celina 5 (Nova): Banner se prikazuje cim user unese broj racuna sa
  // prefiksom razlicit od `222` (nasa banka). Tako klijent zna pre submit-a
  // da je ovo medjubankarsko placanje (2PC flow, moze trajati do 2 min).
  const isInterBankFlow = useMemo(() => {
    if (!watchedTo || watchedTo.length < 3) return false;
    return isInterbank(watchedTo);
  }, [watchedTo]);

  // Spec Celina 5 (Nova) Sc 11 indirect FE coverage: ako user reloaduje
  // stranicu dok je inter-bank placanje u toku, transakcija je vec
  // inicirana na BE-u i nastavlja u retry scheduler-u. Rehydrate-ujemo
  // tracking modal: fetchujemo status, prikazujemo modal i resume-ujemo
  // polling. Ako BE vrati 404 (npr. txId iz davnijeg ciscenja), tihi
  // cleanup sessionStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTxId = window.sessionStorage.getItem(INTERBANK_ACTIVE_TX_KEY);
    if (!savedTxId) return;

    let cancelled = false;
    void (async () => {
      try {
        const status = await interbankPaymentService.getStatus(savedTxId);
        if (cancelled) return;
        setInterbankTracking(status);
        if (INTERBANK_TERMINAL_STATUSES.includes(status.status)) {
          window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
          return;
        }
        toast.info('Nastavljam pracenje inter-bank transakcije iz prethodne sesije...');
        try {
          const finalStatus = await pollInterbankUntilDone(savedTxId);
          if (cancelled) return;
          if (finalStatus.status === 'COMMITTED') {
            toast.success('Inter-bank placanje je uspesno izvrseno.');
            window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
          } else if (finalStatus.failureReason) {
            toast.error(finalStatus.failureReason);
            if (INTERBANK_TERMINAL_STATUSES.includes(finalStatus.status)) {
              window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
            }
          }
        } catch {
          if (cancelled) return;
          toast.error('Nastavak pracenja statusa nije uspeo.');
        }
      } catch {
        if (!cancelled) {
          window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Spec Celina 5 (Nova): "Sistem ce automatski pokusati ponovno povezivanje"
  // za STUCK transakcije. User moze rucno triggerovati retry — fetcha status
  // jos jednom (BE moze u medjuvremenu vec resiti) i resume polling-a ako
  // je status izasao iz STUCK-a.
  const handleRetryStuck = async () => {
    if (!interbankTracking) return;
    setRetryingStuck(true);
    try {
      const refreshed = await interbankPaymentService.getStatus(interbankTracking.transactionId);
      setInterbankTracking(refreshed);
      if (refreshed.status === 'STUCK') {
        toast.info('Transakcija je i dalje zaglavljena. Pokusajte ponovo za par sekundi.');
      } else if (INTERBANK_TERMINAL_STATUSES.includes(refreshed.status)) {
        if (refreshed.status === 'COMMITTED') {
          toast.success('Transakcija je u medjuvremenu uspesno zavrsena.');
        } else {
          toast.error(refreshed.failureReason ?? 'Transakcija nije uspela.');
        }
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
        }
      } else {
        // Vratila se u in-progress stanje (npr. PREPARING), nastavi polling
        toast.info('Transakcija je nastavila — pratite napredak.');
        try {
          const finalStatus = await pollInterbankUntilDone(refreshed.transactionId);
          if (finalStatus.status === 'COMMITTED') {
            toast.success('Inter-bank placanje je uspesno izvrseno.');
          } else if (finalStatus.failureReason) {
            toast.error(finalStatus.failureReason);
          }
          if (
            typeof window !== 'undefined' &&
            INTERBANK_TERMINAL_STATUSES.includes(finalStatus.status)
          ) {
            window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
          }
        } catch {
          toast.error('Polling statusa nije uspeo. Pogledajte istoriju placanja.');
        }
      }
    } catch {
      toast.error('Nije bilo moguce osveziti status. Banka primaoca jos nije dostupna.');
    } finally {
      setRetryingStuck(false);
    }
  };

  const pollInterbankUntilDone = async (transactionId: string) => {
    let attempts = 0;
    let lastStatus: InterbankPayment['status'] | null = null;
    while (attempts < INTERBANK_MAX_POLLS) {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, INTERBANK_POLL_MS));
      const status = await interbankPaymentService.getStatus(transactionId);
      // Spec UX polish: toast notifikacija pri svakoj fazi prelaza (osim
      // terminalnih, koje ce biti najavljen u onSubmit handler-u). Tako
      // user dobija povratnu informaciju i pre nego sto pogleda modal.
      if (
        lastStatus !== status.status &&
        !INTERBANK_TERMINAL_STATUSES.includes(status.status)
      ) {
        const phaseToast: Partial<Record<InterbankPayment['status'], string>> = {
          PREPARING: 'Faza 1 (Prepare): Banka primaoca proverava racun...',
          PREPARED: 'Faza 1 zavrsena: Banka primaoca je spremna.',
          COMMITTING: 'Faza 2 (Commit): Prebacujem sredstva...',
          ABORTING: 'Pokusavam abortiranje transakcije...',
        };
        const msg = phaseToast[status.status];
        if (msg) toast.info(msg);
        lastStatus = status.status;
      }
      setInterbankTracking((prev) =>
        prev &&
        prev.status === status.status &&
        prev.transactionId === status.transactionId &&
        prev.failureReason === status.failureReason
          ? prev
          : status,
      );
      if (INTERBANK_TERMINAL_STATUSES.includes(status.status)) {
        return status;
      }
    }

    // Spec Celina 5 (Nova) Sc 5 indirect FE coverage: kad istekne polling
    // budget od INTERBANK_MAX_POLLS × INTERBANK_POLL_MS = 2 minuta, eskaliramo
    // na STUCK status. To pokrece amber STUCK banner sa "Pokusaj ponovo"
    // dugmetom (handleRetryStuck), koje user moze kliknuti vise puta dok
    // BE retry scheduler ne razresi transakciju.
    const finalStatus = await interbankPaymentService.getStatus(transactionId);
    if (INTERBANK_TERMINAL_STATUSES.includes(finalStatus.status)) {
      setInterbankTracking(finalStatus);
      return finalStatus;
    }
    const stuckStatus: InterbankPayment = {
      ...finalStatus,
      status: 'STUCK',
      failureReason:
        finalStatus.failureReason ??
        `Pracenje statusa je isteklo posle ${(INTERBANK_MAX_POLLS * INTERBANK_POLL_MS) / 1000}s. ` +
        'Banka primaoca jos nije zavrsila 2PC flow. Sistem ce nastaviti retry u pozadini — ' +
        'mozete osveziti status rucno klikom na "Pokusaj ponovo".',
    };
    setInterbankTracking(stuckStatus);
    return stuckStatus;
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <SendHorizonal className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novi platni nalog</h1>
          <p className="text-sm text-muted-foreground">Popunite podatke za kreiranje novog platnog naloga.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

      {/* Left column: Form (2/3 width) */}
      <div className="lg:col-span-2 space-y-6">

      {isLoading ? (
        /* Skeleton loading state */
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-muted animate-pulse" />
              <div className="h-6 w-48 rounded bg-muted animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-muted animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-[88px] w-full rounded-xl bg-muted animate-pulse" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* Section 1: Racun platioca */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <CardTitle className="text-lg">Racun platioca</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromAccount" className="text-sm font-medium text-muted-foreground">Izaberite racun</Label>
                <select
                  id="fromAccount"
                  title="Racun platioca"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register('fromAccountNumber')}
                >
                  <option value="">Izaberite racun</option>
                  {asArray<Account>(accounts).map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.name || account.accountType} | {account.accountNumber} | {formatAmount(account.availableBalance)}{' '}
                      {account.currency}
                    </option>
                  ))}
                </select>
                {errors.fromAccountNumber && (
                  <p className="text-sm text-destructive">{errors.fromAccountNumber.message}</p>
                )}
              </div>

              {/* Currency info box */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                    <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valuta odabranog racuna</p>
                    <p className="font-bold text-xl font-mono tabular-nums text-indigo-600 dark:text-indigo-400">{fromAccountCurrency || '-'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Primalac */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <CardTitle className="text-lg">Podaci o primaocu</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="savedRecipient" className="text-sm font-medium text-muted-foreground">Sacuvani primalac (opciono)</Label>
                <select
                  id="savedRecipient"
                  title="Sacuvani primalac"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onChange={(e) => {
                    const accountNumber = e.target.value;
                    if (!accountNumber) return;
                    setValue('toAccountNumber', accountNumber, { shouldValidate: true });
                  }}
                >
                  <option value="">Bez sablona</option>
                  {asArray<PaymentRecipient>(recipients).map((recipient) => (
                    <option key={recipient.id} value={recipient.accountNumber}>
                      {recipient.name} | {recipient.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="toAccount" className="text-sm font-medium text-muted-foreground">Racun primaoca</Label>
                  <Input id="toAccount" className="h-11 rounded-xl" {...register('toAccountNumber')} placeholder="18 cifara" />
                  {errors.toAccountNumber && (
                    <p className="text-sm text-destructive">{errors.toAccountNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientName" className="text-sm font-medium text-muted-foreground">Naziv primaoca</Label>
                  <Input id="recipientName" className="h-11 rounded-xl" {...register('recipientName')} placeholder="Naziv primaoca" />
                  {errors.recipientName && <p className="text-sm text-destructive">{errors.recipientName.message}</p>}
                </div>
              </div>

              {isInterBankFlow && (
                <div
                  data-testid="interbank-warning-banner"
                  className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                    <Globe className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Medjubankarsko placanje
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                      Broj racuna primaoca pocinje sa <span className="font-mono font-semibold">{watchedTo.slice(0, 3)}</span> — to je druga banka.
                      Transakcija ide kroz 2-Phase Commit protokol i moze trajati do 2 minuta. Status pratite u real-time-u nakon potvrde.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Detalji placanja */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <CardTitle className="text-lg">Detalji placanja</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium text-muted-foreground">Iznos</Label>
                  <Input id="amount" className="h-11 rounded-xl font-mono tabular-nums" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                  {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentCode" className="text-sm font-medium text-muted-foreground">Sifra placanja</Label>
                  <Input id="paymentCode" className="h-11 rounded-xl font-mono" {...register('paymentCode')} placeholder="289" />
                  {errors.paymentCode && <p className="text-sm text-destructive">{errors.paymentCode.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose" className="text-sm font-medium text-muted-foreground">Svrha placanja</Label>
                <textarea
                  id="purpose"
                  className="flex min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register('paymentPurpose')}
                  placeholder="Unesite svrhu placanja"
                />
                {errors.paymentPurpose && <p className="text-sm text-destructive">{errors.paymentPurpose.message}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm font-medium text-muted-foreground">Model</Label>
                  <Input id="model" className="h-11 rounded-xl font-mono" {...register('model')} placeholder="npr. 97" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callNumber" className="text-sm font-medium text-muted-foreground">Poziv na broj</Label>
                  <Input id="callNumber" className="h-11 rounded-xl font-mono" {...register('callNumber')} placeholder="Opcionalno" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referenceNumber" className="text-sm font-medium text-muted-foreground">Referentni broj</Label>
                  <Input id="referenceNumber" className="h-11 rounded-xl font-mono" {...register('referenceNumber')} placeholder="Opcionalno" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit section */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="h-11 px-8 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
            >
              <SendHorizonal className="h-4 w-4 mr-2" />
              Nastavi na verifikaciju
            </Button>
          </div>
        </form>
      )}

      </div>{/* end left column */}

      {/* Right column: Sticky preview (1/3 width) */}
      {!isLoading && (
      <div className="hidden lg:block self-start sticky top-8">
        <div className="space-y-4">
          {/* Live preview card */}
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <CardTitle className="text-base">Pregled naloga</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* From account */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sa racuna</p>
                {fromAccount ? (
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <p className="text-sm font-medium truncate">{fromAccount.name || fromAccount.accountType}</p>
                    <p className="text-xs font-mono text-muted-foreground">{fromAccount.accountNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Raspolozivo: <span className="font-mono font-semibold text-foreground">{formatAmount(fromAccount.availableBalance)} {fromAccount.currency}</span></p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nije izabran</p>
                )}
              </div>

              {/* Arrow */}
              {(watchedTo || watchedRecipientName) && (
                <div className="flex justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
                    <ArrowRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400 rotate-90" />
                  </div>
                </div>
              )}

              {/* To account */}
              {(watchedTo || watchedRecipientName) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Na racun</p>
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    {watchedRecipientName && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm font-medium">{watchedRecipientName}</p>
                      </div>
                    )}
                    {watchedTo && <p className="text-xs font-mono text-muted-foreground">{watchedTo}</p>}
                  </div>
                </div>
              )}

              {/* Amount */}
              {watchedAmount > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Iznos</p>
                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 text-center">
                    <p className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                      {formatAmount(watchedAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{fromAccountCurrency || 'RSD'}</p>
                  </div>
                </div>
              )}

              {/* Details */}
              {(watchedPurpose || watchedCode) && (
                <div className="space-y-2 pt-1 border-t">
                  {watchedCode && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Sifra
                      </span>
                      <span className="font-mono">{watchedCode}</span>
                    </div>
                  )}
                  {watchedPurpose && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Svrha
                      </p>
                      <p className="text-sm line-clamp-2">{watchedPurpose}</p>
                    </div>
                  )}
                  {watchedModel && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-mono">{watchedModel}</span>
                    </div>
                  )}
                  {watchedCallNumber && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Poziv na br.</span>
                      <span className="font-mono">{watchedCallNumber}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!fromAccount && !watchedTo && !watchedAmount && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Popunite formu da vidite pregled naloga.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      </div>{/* end grid */}

      {/* Save recipient prompt - shown after successful payment */}
      {saveRecipientPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-up">
          <Card className="w-full max-w-md mx-4 rounded-2xl border shadow-2xl">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                    <BookUser className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Sacuvaj primaoca?</h3>
                    <p className="text-sm text-muted-foreground">Za brze buduce uplate</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Zatvori"
                  title="Zatvori"
                  onClick={() => {
                    setSaveRecipientPrompt(null);
                    navigate('/payments/history');
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{saveRecipientPrompt.name}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground ml-6">{saveRecipientPrompt.accountNumber}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => {
                    setSaveRecipientPrompt(null);
                    navigate('/payments/history');
                  }}
                >
                  Preskoci
                </Button>
                <Button
                  disabled={savingRecipient}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
                  onClick={async () => {
                    setSavingRecipient(true);
                    try {
                      await paymentRecipientService.create({
                        name: saveRecipientPrompt.name,
                        accountNumber: saveRecipientPrompt.accountNumber,
                      });
                      toast.success('Primalac sacuvan u sablone.');
                    } catch {
                      toast.error('Cuvanje primaoca nije uspelo.');
                    } finally {
                      setSavingRecipient(false);
                      setSaveRecipientPrompt(null);
                      navigate('/payments/history');
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {savingRecipient ? 'Cuvanje...' : 'Sacuvaj'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <VerificationModal
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onVerified={async (otpCode: string) => {
          // OTP je verifikovan - sada biramo flow: intra-bank ili inter-bank.
          try {
            const formData = getValues();
            const paymentDto = {
              fromAccountNumber: formData.fromAccountNumber,
              toAccountNumber: formData.toAccountNumber,
              amount: formData.amount,
              recipientName: formData.recipientName,
              paymentCode: formData.paymentCode,
              paymentPurpose: formData.paymentPurpose,
              model: formData.model || undefined,
              callNumber: formData.callNumber || undefined,
              referenceNumber: formData.referenceNumber || undefined,
            };

            if (isInterbank(formData.toAccountNumber)) {
              const initiated = await interbankPaymentService.initiatePayment({
                senderAccountNumber: formData.fromAccountNumber,
                receiverAccountNumber: formData.toAccountNumber,
                receiverName: formData.recipientName,
                amount: formData.amount,
                currency: fromAccountCurrency || 'RSD',
                description: formData.paymentPurpose || undefined,
                otpCode,
                paymentCode: formData.paymentCode,
                paymentPurpose: formData.paymentPurpose || undefined,
                model: formData.model || undefined,
                callNumber: formData.callNumber || undefined,
                referenceNumber: formData.referenceNumber || undefined,
              } as InterbankPaymentInitiateRequest & {
                paymentCode?: string;
                paymentPurpose?: string;
                model?: string;
                callNumber?: string;
                referenceNumber?: string;
              });
              setInterbankTracking(initiated);
              // Spec Celina 5 (Nova) Sc 11: persistiramo aktivni txId tako da
              // user moze reloadovati stranicu i rehydrate tracking modal.
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(INTERBANK_ACTIVE_TX_KEY, initiated.transactionId);
              }
              toast.info('Inter-bank transakcija u obradi...');
              const finalStatus = await pollInterbankUntilDone(initiated.transactionId);
              if (finalStatus.status === 'COMMITTED') {
                toast.success('Inter-bank placanje je uspesno izvrseno.');
              } else {
                const reason = finalStatus.failureReason || 'Inter-bank transakcija nije uspesno zavrsena.';
                toast.error(reason);
              }
              if (
                typeof window !== 'undefined' &&
                INTERBANK_TERMINAL_STATUSES.includes(finalStatus.status)
              ) {
                window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
              }
            } else {
              await transactionService.createPayment(paymentDto, otpCode);
              toast.success('Placanje je uspesno izvrseno.');
            }

            setShowVerification(false);

            // Proveri da li je primalac vec sacuvan — ako nije, ponudi opciju cuvanja
            const toAcc = formData.toAccountNumber;
            const recipName = formData.recipientName || 'Novi primalac';
            const isAlreadySaved = toAcc && recipients.some(r => r.accountNumber === toAcc);
            if (toAcc && !isAlreadySaved) {
              setSaveRecipientPrompt({ name: recipName, accountNumber: toAcc });
            } else {
              navigate('/payments/history');
            }
          } catch (err) {
            toast.error(getErrorMessage(err, 'Kreiranje placanja nije uspelo.'));
            throw err;
          }
        }}
      />

      {interbankTracking && (() => {
        const isTerminal = INTERBANK_TERMINAL_STATUSES.includes(interbankTracking.status);
        const isSuccess = interbankTracking.status === 'COMMITTED';
        const isAborted = interbankTracking.status === 'ABORTED';
        const isStuck = interbankTracking.status === 'STUCK';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-up"
            data-testid="interbank-status-modal"
          >
            <Card className="w-full max-w-lg mx-4 rounded-2xl border shadow-2xl">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${
                        isSuccess
                          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30'
                          : isAborted || isStuck
                            ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30'
                            : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30'
                      }`}
                    >
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Medjubankarsko placanje</h3>
                      <p className="text-xs text-muted-foreground">
                        Transaction ID: <span className="font-mono">{interbankTracking.transactionId}</span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-mono font-medium ${
                      isSuccess
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : isAborted || isStuck
                          ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                          : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    }`}
                    data-testid="interbank-status-badge"
                  >
                    {interbankTracking.status}
                  </span>
                </div>

                {/* 2PC stepper — vizualizuje napredak kroz 4 faze */}
                <div className="space-y-2" data-testid="interbank-stepper">
                  {INTERBANK_STEPS.map((step, index) => {
                    const state = getInterbankStepState(step.key, interbankTracking.status);
                    const isLast = index === INTERBANK_STEPS.length - 1;

                    return (
                      <div
                        key={step.key}
                        className="flex items-start gap-3"
                        data-testid={`interbank-step-${step.key}`}
                        data-state={state}
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                              state === 'done'
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : state === 'active'
                                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                  : state === 'failed'
                                    ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'border-muted bg-muted/40 text-muted-foreground'
                            }`}
                          >
                            {state === 'done' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : state === 'active' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : state === 'failed' ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <span className="text-xs font-semibold">{index + 1}</span>
                            )}
                          </div>
                          {!isLast && (
                            <div
                              className={`mt-1 h-6 w-0.5 ${
                                state === 'done' ? 'bg-emerald-500/50' : 'bg-border'
                              }`}
                            />
                          )}
                        </div>
                        <div className="pb-2">
                          <p
                            className={`text-sm font-medium ${
                              state === 'done'
                                ? 'text-foreground'
                                : state === 'active'
                                  ? 'text-foreground'
                                  : state === 'failed'
                                    ? 'text-rose-700 dark:text-rose-300'
                                    : 'text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isStuck && (
                  <div
                    className="rounded-lg border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/30 p-3"
                    data-testid="interbank-stuck-warning"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          Transakcija je zaglavljena (STUCK)
                        </p>
                        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                          Banka primaoca nije odgovorila u ocekivanom vremenu. Sistem ce automatski pokusati ponovno
                          povezivanje. Mozete i rucno proveriti status — ako je transakcija u medjuvremenu zavrsena,
                          status ce se odmah azurirati.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRetryStuck()}
                        disabled={retryingStuck}
                        data-testid="interbank-stuck-retry-btn"
                        className="border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      >
                        {retryingStuck ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Proveravam...
                          </>
                        ) : (
                          <>
                            <SendHorizonal className="mr-2 h-3 w-3" />
                            Pokusaj ponovo
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {interbankTracking.failureReason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/30 p-3">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Razlog</p>
                    <p className="text-xs text-rose-700/80 dark:text-rose-300/80">{interbankTracking.failureReason}</p>
                  </div>
                )}

                {!isTerminal && (
                  <p className="text-xs text-muted-foreground italic">
                    Polling na svake {INTERBANK_POLL_MS / 1000}s — 2PC moze trajati do 2 minuta.
                  </p>
                )}

                {isTerminal && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        setInterbankTracking(null);
                        if (typeof window !== 'undefined') {
                          window.sessionStorage.removeItem(INTERBANK_ACTIVE_TX_KEY);
                        }
                      }}
                    >
                      Zatvori
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
