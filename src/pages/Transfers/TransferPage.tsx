// FE2-05/08a: Prenos izmedju racuna sa confirm step-om i provizijom

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import { transactionService } from '@/services/transactionService';
import type { Account } from '@/types/celina2';
import { transferSchema, type TransferFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeftRight, Wallet } from 'lucide-react';
import VerificationModal from '@/components/shared/VerificationModal';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
}

export default function TransferPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const preselectedFrom = searchParams.get('from') || '';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [submittedData, setSubmittedData] = useState<TransferFormData | null>(null);

  const [showVerification, setShowVerification] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<number | null>(null);

  const [exchangePreview, setExchangePreview] = useState<{
    rate: number;
    convertedAmount: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountNumber: preselectedFrom,
      toAccountNumber: '',
      amount: 0,
    },
  });

  useEffect(() => {
    let mounted = true;

    const loadAccounts = async () => {
      setIsLoading(true);

      try {
        const data = await accountService.getMyAccounts();

        if (!mounted) return;

        const safeAccounts = asArray<Account>(data);
        setAccounts(safeAccounts);

        if (safeAccounts.length === 0) {
          toast.error('Nemate dostupnih racuna za prenos.');
          return;
        }

        const hasPreselected = safeAccounts.some(
          (account) => account.accountNumber === preselectedFrom
        );

        const initialFrom =
          preselectedFrom && hasPreselected ? preselectedFrom : safeAccounts[0].accountNumber;

        reset({
          fromAccountNumber: initialFrom,
          toAccountNumber: '',
          amount: 0,
        });
      } catch (error) {
        if (!mounted) return;

        toast.error(getErrorMessage(error, 'Neuspesno ucitavanje racuna.'));
        setAccounts([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadAccounts();

    return () => {
      mounted = false;
    };
  }, [preselectedFrom, reset]);

  const fromAccount = watch('fromAccountNumber');
  const toAccount = watch('toAccountNumber');
  const amount = watch('amount') || 0;

  const safeAccounts = useMemo(() => asArray<Account>(accounts), [accounts]);

  const fromAccountData = useMemo(
    () => safeAccounts.find((account) => account.accountNumber === fromAccount),
    [safeAccounts, fromAccount]
  );

  const toAccountOptions = useMemo(
    () => safeAccounts.filter((account) => account.accountNumber !== fromAccount),
    [safeAccounts, fromAccount]
  );

  const toAccountData = useMemo(
    () => toAccountOptions.find((account) => account.accountNumber === toAccount),
    [toAccountOptions, toAccount]
  );

  useEffect(() => {
    if (toAccount && toAccount === fromAccount) {
      setValue('toAccountNumber', '');
    }
  }, [fromAccount, toAccount, setValue]);

  useEffect(() => {
    let cancelled = false;

    if (!fromAccountData || !toAccountData || !amount || amount <= 0) {
      setExchangePreview(null);
      return;
    }

    if (fromAccountData.currency === toAccountData.currency) {
      setExchangePreview(null);
      return;
    }

    const loadRate = async () => {
      try {
        const result = await currencyService.convert({
          fromCurrency: fromAccountData.currency,
          toCurrency: toAccountData.currency,
          amount,
        });

        if (cancelled) return;

        setExchangePreview({
          rate: result.exchangeRate,
          convertedAmount: result.convertedAmount,
        });
      } catch {
        if (cancelled) return;
        setExchangePreview(null);
      }
    };

    loadRate();

    return () => {
      cancelled = true;
    };
  }, [amount, fromAccountData, toAccountData]);

  const insufficientFunds = useMemo(() => {
    if (!fromAccountData) return false;
    return amount > 0 && Number(fromAccountData.availableBalance ?? 0) < Number(amount);
  }, [fromAccountData, amount]);

  const commission = useMemo(() => {
    if (!amount || amount <= 0) return 0;
    if (fromAccountData?.currency === toAccountData?.currency) return 0;
    return amount * 0.005;
  }, [amount, fromAccountData, toAccountData]);

  const totalDebit = useMemo(() => {
    return amount > 0 ? amount + commission : 0;
  }, [amount, commission]);

  const onSubmit = async (data: TransferFormData) => {
    if (!fromAccountData) {
      toast.error('Izaberite racun posiljaoca.');
      return;
    }

    if (!toAccountData) {
      toast.error('Izaberite racun primaoca.');
      return;
    }

    if (data.fromAccountNumber === data.toAccountNumber) {
      toast.error('Racun posiljaoca i primaoca ne mogu biti isti.');
      return;
    }

    if (Number(data.amount) <= 0) {
      toast.error('Iznos mora biti veci od nule.');
      return;
    }

    if (insufficientFunds) {
      toast.error('Nemate dovoljno raspolozivih sredstava na izabranom racunu.');
      return;
    }

    setSubmittedData(data);
    setShowConfirmStep(true);
  };

  const handleConfirmTransfer = async () => {
    if (!submittedData) return;

    setIsSubmitting(true);

    try {
      // Auto-detect: if currencies differ, server-side routes to FX
      const result = await transactionService.createTransfer({
        fromAccountNumber: submittedData.fromAccountNumber,
        toAccountNumber: submittedData.toAccountNumber,
        amount: Number(submittedData.amount),
      });

      // Otvori verifikacioni modal
      const txId = (result as unknown as { id?: number })?.id;
      if (txId) {
        setPendingTransactionId(txId);
        setShowVerification(true);
        toast.info('Prenos je kreiran. Potrebna je verifikacija.');
      } else {
        // Fallback: ako backend ne vraca ID, prenos je direktno izvrsen
        setShowConfirmStep(false);
        toast.success('Prenos je uspešno izvršen!');
        navigate('/accounts');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Kreiranje prenosa nije uspelo.'));
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="container mx-auto max-w-2xl py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <ArrowLeftRight className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prenos izmedju racuna</h1>
          <p className="text-sm text-muted-foreground">Prenesite sredstva izmedju vasih racuna brzo i sigurno.</p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>{showConfirmStep ? 'Potvrda prenosa' : 'Novi prenos'}</CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-10 w-full rounded bg-muted animate-pulse" />
              </div>
              <div className="h-12 w-full rounded-md bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-10 w-full rounded bg-muted animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-10 w-full rounded bg-muted animate-pulse" />
              </div>
            </div>
          ) : safeAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nema dostupnih racuna</h3>
              <p className="mt-1 text-sm text-muted-foreground">Nemate dostupnih racuna za prenos.</p>
            </div>
          ) : showConfirmStep && submittedData && fromAccountData && toAccountData ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Racun posiljaoca:</span> {fromAccountData.accountNumber} |{' '}
                  {fromAccountData.currency}
                </p>
                <p>
                  <span className="font-medium">Racun primaoca:</span> {toAccountData.accountNumber} |{' '}
                  {toAccountData.currency}
                </p>
                <p>
                  <span className="font-medium">Iznos:</span> {formatAmount(submittedData.amount)}{' '}
                  {fromAccountData.currency}
                </p>

                {exchangePreview && (
                  <>
                    <p>
                      <span className="font-medium">Kurs:</span> 1 {fromAccountData.currency} ={' '}
                      {formatAmount(exchangePreview.rate, 4)} {toAccountData.currency}
                    </p>
                    <p>
                      <span className="font-medium">Konvertovani iznos:</span>{' '}
                      {formatAmount(exchangePreview.convertedAmount)} {toAccountData.currency}
                    </p>
                    <p>
                      <span className="font-medium">Provizija:</span> {formatAmount(commission)}{' '}
                      {fromAccountData.currency}
                    </p>
                    <p>
                      <span className="font-medium">Ukupno za terecenje:</span> {formatAmount(totalDebit)}{' '}
                      {fromAccountData.currency}
                    </p>
                  </>
                )}

                {!exchangePreview && (
                  <p>
                    <span className="font-medium">Valute:</span> isti kurs nije potreban
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmStep(false)}
                  disabled={isSubmitting}
                >
                  Nazad
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmTransfer}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                >
                  {isSubmitting ? 'Kreiranje...' : 'Potvrdi transfer'}
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="fromAccount">Racun posiljaoca</Label>
                <select
                  id="fromAccount"
                  title="Racun posiljaoca"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('fromAccountNumber')}
                  disabled={isSubmitting}
                >
                  <option value="">Izaberite racun</option>
                  {safeAccounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} | {formatAmount(account.availableBalance)}{' '}
                      {account.currency}
                    </option>
                  ))}
                </select>
                {errors.fromAccountNumber && (
                  <p className="text-sm text-destructive">
                    {errors.fromAccountNumber.message}
                  </p>
                )}
              </div>

              {fromAccountData && (
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-muted-foreground">Raspolozivo stanje:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatAmount(fromAccountData.availableBalance)} {fromAccountData.currency}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="toAccount">Racun primaoca</Label>
                <select
                  id="toAccount"
                  title="Racun primaoca"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('toAccountNumber')}
                  disabled={isSubmitting}
                >
                  <option value="">Izaberite racun</option>
                  {toAccountOptions.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} | {formatAmount(account.availableBalance)}{' '}
                      {account.currency}
                    </option>
                  ))}
                </select>
                {errors.toAccountNumber && (
                  <p className="text-sm text-destructive">
                    {errors.toAccountNumber.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Iznos</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('amount', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
                {insufficientFunds && (
                  <p className="text-sm text-destructive">
                    Nemate dovoljno raspolozivih sredstava na racunu posiljaoca.
                  </p>
                )}
              </div>

              {exchangePreview && fromAccountData && toAccountData && (
                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p>
                    Kurs: 1 {fromAccountData.currency} = {formatAmount(exchangePreview.rate, 4)}{' '}
                    {toAccountData.currency}
                  </p>
                  <p>
                    Konvertovani iznos: {formatAmount(exchangePreview.convertedAmount)}{' '}
                    {toAccountData.currency}
                  </p>
                  <p>
                    Provizija: {formatAmount(commission)} {fromAccountData.currency}
                  </p>
                  <p>
                    Ukupno za terecenje: {formatAmount(totalDebit)} {fromAccountData.currency}
                  </p>
                </div>
              )}

              {fromAccountData &&
                toAccountData &&
                fromAccountData.currency === toAccountData.currency &&
                amount > 0 && (
                  <div className="space-y-1 rounded-md border p-3 text-sm">
                    <p>
                      Prenos bez konverzije: {formatAmount(amount)} {fromAccountData.currency}
                    </p>
                  </div>
                )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                >
                  Nastavi na potvrdu
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <VerificationModal
        transactionId={pendingTransactionId}
        isOpen={showVerification}
        onClose={() => {
          setShowVerification(false);
          setPendingTransactionId(null);
        }}
        onSuccess={() => {
          setShowVerification(false);
          setPendingTransactionId(null);
          setShowConfirmStep(false);
          toast.success('Prenos je uspešno verifikovan!');
          navigate('/accounts');
        }}
      />
    </div>
  );
}
