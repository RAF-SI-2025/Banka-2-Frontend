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
import type { Account, PaymentRecipient } from '@/types/celina2';
import { newPaymentSchema, type NewPaymentFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VerificationModal from '@/components/shared/VerificationModal';
import { SendHorizonal } from 'lucide-react';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  const onSubmit = async (data: NewPaymentFormData) => {
    setIsSubmitting(true);
    try {
      const result = await transactionService.createPayment({
        fromAccountNumber: data.fromAccountNumber,
        toAccountNumber: data.toAccountNumber,
        amount: data.amount,
        recipientName: data.recipientName,
        paymentCode: data.paymentCode,
        paymentPurpose: data.paymentPurpose,
        model: data.model || undefined,
        callNumber: data.callNumber || undefined,
        referenceNumber: data.referenceNumber || undefined,
      });

      setPendingTransactionId(result.id);
      setShowVerification(true);
      toast.info('Placanje je kreirano. Potrebna je verifikacija.');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message || 'Kreiranje placanja nije uspelo.';
      toast.error(msg);
      if (msg.toLowerCase().includes('ne postoji') || msg.toLowerCase().includes('not found')) {
        setValue('toAccountNumber', '');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedFrom = watch('fromAccountNumber');
  const fromAccountCurrency = accountLookup.get(selectedFrom)?.currency;

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2">
          <SendHorizonal className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Novi platni nalog</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Popunite podatke za kreiranje novog platnog naloga.</p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Nalog za placanje</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-10 w-full rounded bg-muted animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-10 w-full rounded bg-muted animate-pulse" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                  <div className="h-10 w-full rounded bg-muted animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                  <div className="h-10 w-full rounded bg-muted animate-pulse" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-10 w-full rounded bg-muted animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                  <div className="h-10 w-full rounded bg-muted animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-[88px] w-full rounded bg-muted animate-pulse" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="fromAccount">Racun platioca</Label>
                <select
                  id="fromAccount"
                  title="Racun platioca"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

              <div className="space-y-2">
                <Label htmlFor="savedRecipient">Sacuvani primalac (opciono)</Label>
                <select
                  id="savedRecipient"
                  title="Sacuvani primalac"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  <Label htmlFor="toAccount">Racun primaoca</Label>
                  <Input id="toAccount" {...register('toAccountNumber')} placeholder="18 cifara" />
                  {errors.toAccountNumber && (
                    <p className="text-sm text-destructive">{errors.toAccountNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Naziv primaoca</Label>
                  <Input id="recipientName" {...register('recipientName')} placeholder="Naziv primaoca" />
                  {errors.recipientName && <p className="text-sm text-destructive">{errors.recipientName.message}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Iznos</Label>
                  <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                  {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentCode">Sifra placanja</Label>
                  <Input id="paymentCode" {...register('paymentCode')} placeholder="289" />
                  {errors.paymentCode && <p className="text-sm text-destructive">{errors.paymentCode.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Svrha placanja</Label>
                <textarea
                  id="purpose"
                  className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('paymentPurpose')}
                  placeholder="Unesite svrhu placanja"
                />
                {errors.paymentPurpose && <p className="text-sm text-destructive">{errors.paymentPurpose.message}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" {...register('model')} placeholder="npr. 97" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callNumber">Poziv na broj</Label>
                  <Input id="callNumber" {...register('callNumber')} placeholder="Opcionalno" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referenceNumber">Referentni broj</Label>
                  <Input id="referenceNumber" {...register('referenceNumber')} placeholder="Opcionalno" />
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Valuta odabranog racuna: <span className="font-semibold text-foreground">{fromAccountCurrency || '-'}</span>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                >
                  {isSubmitting ? 'Kreiranje...' : 'Nastavi na verifikaciju'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <VerificationModal
        transactionId={pendingTransactionId}
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onSuccess={async () => {
          setShowVerification(false);
          const toAcc = watch('toAccountNumber');
          const recipName = watch('recipientName') || 'Novi primalac';
          if (toAcc && !recipients.some(r => r.accountNumber === toAcc)) {
            try {
              await paymentRecipientService.create({ name: recipName, accountNumber: toAcc });
              toast.success('Primalac sacuvan u sablone.');
            } catch { /* ignore */ }
          }
          navigate('/payments/history');
        }}
      />
    </div>
  );
}
