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
import { SendHorizonal, Wallet } from 'lucide-react';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num)
    ? num.toLocaleString('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : (0).toFixed(decimals);
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
  const [isSubmitting] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

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
    // SAMO otvori OTP modal. Pare NE idu nigde dok se ne unese kod.
    console.log('[PAYMENT] onSubmit called - opening OTP modal ONLY, no payment sent');
    setShowVerification(true);
  };

  const selectedFrom = watch('fromAccountNumber');
  const fromAccountCurrency = accountLookup.get(selectedFrom)?.currency;

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-8">
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
              disabled={isSubmitting}
              className="h-11 px-8 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
            >
              <SendHorizonal className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Kreiranje...' : 'Nastavi na verifikaciju'}
            </Button>
          </div>
        </form>
      )}

      <VerificationModal
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onVerified={async (otpCode: string) => {
          // OTP je verifikovan - sad kreiraj placanje sa kodom
          try {
            const formData = getValues();
            await transactionService.createPayment({
              fromAccountNumber: formData.fromAccountNumber,
              toAccountNumber: formData.toAccountNumber,
              amount: formData.amount,
              recipientName: formData.recipientName,
              paymentCode: formData.paymentCode,
              paymentPurpose: formData.paymentPurpose,
              model: formData.model || undefined,
              callNumber: formData.callNumber || undefined,
              referenceNumber: formData.referenceNumber || undefined,
            }, otpCode);

            toast.success('Placanje je uspesno izvrseno.');
            setShowVerification(false);

            // Sacuvaj primaoca
            const toAcc = formData.toAccountNumber;
            const recipName = formData.recipientName || 'Novi primalac';
            if (toAcc && !recipients.some(r => r.accountNumber === toAcc)) {
              try {
                await paymentRecipientService.create({ name: recipName, accountNumber: toAcc });
                toast.success('Primalac sacuvan u sablone.');
              } catch { /* ignore */ }
            }
            navigate('/payments/history');
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Kreiranje placanja nije uspelo.');
          }
        }}
      />
    </div>
  );
}
