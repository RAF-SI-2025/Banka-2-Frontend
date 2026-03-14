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

  const [showVerification, setShowVerification] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<number | null>(null);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [submittedData, setSubmittedData] = useState<TransferFormData | null>(null);

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
          toast.error('Nemate dostupnih računa za prenos.');
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

        toast.error(getErrorMessage(error, 'Neuspešno učitavanje računa.'));
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
        const rate = await currencyService.getRate(
          fromAccountData.currency,
          toAccountData.currency
        );

        if (cancelled) return;

        setExchangePreview({
          rate: rate.middleRate,
          convertedAmount: amount * rate.middleRate,
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
    return amount * 0.01;
  }, [amount, fromAccountData, toAccountData]);

  const totalDebit = useMemo(() => {
    return amount > 0 ? amount + commission : 0;
  }, [amount, commission]);

  const onSubmit = async (data: TransferFormData) => {
    if (!fromAccountData) {
      toast.error('Izaberite račun pošiljaoca.');
      return;
    }

    if (!toAccountData) {
      toast.error('Izaberite račun primaoca.');
      return;
    }

    if (data.fromAccountNumber === data.toAccountNumber) {
      toast.error('Račun pošiljaoca i primaoca ne mogu biti isti.');
      return;
    }

    if (Number(data.amount) <= 0) {
      toast.error('Iznos mora biti veći od nule.');
      return;
    }

    if (insufficientFunds) {
      toast.error('Nemate dovoljno raspoloživih sredstava na izabranom računu.');
      return;
    }

    setSubmittedData(data);
    setShowConfirmStep(true);
  };

  const handleConfirmTransfer = async () => {
    if (!submittedData) return;

    setIsSubmitting(true);

    try {
      const transfer = await transactionService.createTransfer({
        fromAccountNumber: submittedData.fromAccountNumber,
        toAccountNumber: submittedData.toAccountNumber,
        amount: Number(submittedData.amount),
      });

      setPendingTransactionId(transfer.id);
      setShowConfirmStep(false);
      setShowVerification(true);
      toast.info('Prenos je kreiran. Potrebna je verifikacija.');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Kreiranje prenosa nije uspelo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationClose = () => {
    setShowVerification(false);
  };

  const handleVerificationSuccess = () => {
    setShowVerification(false);
    toast.success('Prenos je uspešno verifikovan.');
    navigate('/accounts');
  };

  return (
    <div className="container mx-auto max-w-2xl py-6">
      <h1 className="mb-6 text-3xl font-bold">Prenos između računa</h1>

      <Card>
        <CardHeader>
          <CardTitle>{showConfirmStep ? 'Potvrda prenosa' : 'Novi prenos'}</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Učitavanje računa...</p>
          ) : safeAccounts.length === 0 ? (
            <p className="text-muted-foreground">Nemate dostupnih računa za prenos.</p>
          ) : showConfirmStep && submittedData && fromAccountData && toAccountData ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Račun pošiljaoca:</span> {fromAccountData.accountNumber} |{' '}
                  {fromAccountData.currency}
                </p>
                <p>
                  <span className="font-medium">Račun primaoca:</span> {toAccountData.accountNumber} |{' '}
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
                      <span className="font-medium">Ukupno za terećenje:</span> {formatAmount(totalDebit)}{' '}
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
                <Button type="button" onClick={handleConfirmTransfer} disabled={isSubmitting}>
                  {isSubmitting ? 'Kreiranje...' : 'Potvrdi transfer'}
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="fromAccount">Račun pošiljaoca</Label>
                <select
                  id="fromAccount"
                  title="Račun pošiljaoca"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('fromAccountNumber')}
                  disabled={isSubmitting}
                >
                  <option value="">Izaberite račun</option>
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
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    Raspoloživo stanje: {formatAmount(fromAccountData.availableBalance)}{' '}
                    {fromAccountData.currency}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="toAccount">Račun primaoca</Label>
                <select
                  id="toAccount"
                  title="Račun primaoca"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('toAccountNumber')}
                  disabled={isSubmitting}
                >
                  <option value="">Izaberite račun</option>
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
                    Nemate dovoljno raspoloživih sredstava na računu pošiljaoca.
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
                    Ukupno za terećenje: {formatAmount(totalDebit)} {fromAccountData.currency}
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
                <Button type="submit" disabled={isSubmitting || isLoading}>
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
        onClose={handleVerificationClose}
        onSuccess={handleVerificationSuccess}
      />
    </div>
  );
}