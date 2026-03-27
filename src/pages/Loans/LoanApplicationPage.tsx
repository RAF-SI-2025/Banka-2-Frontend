//
// Ova stranica sadrzi formu za podnoscenje zahteva za kredit.
// - react-hook-form + zodResolver(loanApplicationSchema)
// - Polja: tip kredita, tip kamate (fiksni/varijabilni), iznos, valuta, svrha kredita,
//   period otplate (dropdown sa dozvoljenim vrednostima iz REPAYMENT_PERIODS), racun, telefon
// - Opciona polja: status zaposlenja, mesecni prihod, stalni radni odnos, period zaposlenja
// - Prikaz kalkulacije: mesecna rata, ukupan iznos, efektivna kamatna stopa
// - Submit: creditService.apply(data)
// - Spec: "Zahtev za kredit" iz Celine 2

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText } from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { creditService } from '@/services/creditService';
import type { Account, Currency } from '@/types/celina2';
import {
  REPAYMENT_PERIODS,
  loanApplicationSchema,
  type LoanApplicationFormData,
} from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function LoanApplicationPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoanApplicationFormData>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      loanType: 'GOTOVINSKI',
      interestRateType: 'FIKSNI',
      amount: 0,
      currency: 'RSD',
      loanPurpose: '',
      repaymentPeriod: 12,
      accountNumber: '',
      phoneNumber: '',
      employmentStatus: '',
      monthlyIncome: undefined,
      permanentEmployment: false,
      employmentPeriod: undefined,
    },
  });

  useEffect(() => {
    let mounted = true;
    const loadAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const myAccounts = await accountService.getMyAccounts();
        if (!mounted) return;
        const safeAccounts = asArray<Account>(myAccounts);
        setAccounts(safeAccounts);
        if (safeAccounts.length > 0) {
          setValue('accountNumber', safeAccounts[0].accountNumber);
          setValue('currency', safeAccounts[0].currency);
        }
      } catch {
        if (!mounted) return;
        toast.error('Neuspesno ucitavanje racuna.');
        setAccounts([]);
      } finally {
        if (mounted) setIsLoadingAccounts(false);
      }
    };

    loadAccounts();
    return () => {
      mounted = false;
    };
  }, [setValue]);

  const selectedLoanType = watch('loanType');
  const selectedCurrency = watch('currency') as Currency;
  const amount = watch('amount') || 0;
  const repaymentPeriod = watch('repaymentPeriod') || 0;
  const safeAccounts = useMemo(() => asArray<Account>(accounts), [accounts]);

  const repaymentOptions = useMemo(() => {
    return REPAYMENT_PERIODS[selectedLoanType] ?? [];
  }, [selectedLoanType]);

  useEffect(() => {
    if (!repaymentOptions.includes(repaymentPeriod as never) && repaymentOptions.length > 0) {
      setValue('repaymentPeriod', repaymentOptions[0]);
    }
  }, [repaymentOptions, repaymentPeriod, setValue]);

  const filteredAccounts = useMemo(
    () => safeAccounts.filter((account) => account.currency === selectedCurrency),
    [safeAccounts, selectedCurrency]
  );

  useEffect(() => {
    if (!filteredAccounts.some((a) => a.accountNumber === watch('accountNumber'))) {
      setValue('accountNumber', filteredAccounts[0]?.accountNumber || '');
    }
  }, [filteredAccounts, setValue, watch]);

  const annualRate = useMemo(() => {
    // Base rate by amount (per spec)
    let baseRate: number;
    if (amount <= 500000) baseRate = 6.25;
    else if (amount <= 1000000) baseRate = 6.0;
    else if (amount <= 2000000) baseRate = 5.75;
    else if (amount <= 5000000) baseRate = 5.5;
    else if (amount <= 10000000) baseRate = 5.25;
    else if (amount <= 20000000) baseRate = 5.0;
    else baseRate = 4.75;

    // Margin by loan type (per spec)
    const marginMap: Record<string, number> = {
      GOTOVINSKI: 1.75,
      STAMBENI: 1.50,
      AUTO: 1.25,
      REFINANSIRAJUCI: 1.00,
      STUDENTSKI: 0.75,
    };
    const margin = marginMap[selectedLoanType] ?? 1.75;
    return baseRate + margin;
  }, [amount, selectedLoanType]);

  const monthlyPayment = useMemo(() => {
    if (!amount || !repaymentPeriod || repaymentPeriod <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return amount / repaymentPeriod;

    const numerator = amount * monthlyRate * Math.pow(1 + monthlyRate, repaymentPeriod);
    const denominator = Math.pow(1 + monthlyRate, repaymentPeriod) - 1;
    return denominator === 0 ? 0 : numerator / denominator;
  }, [amount, annualRate, repaymentPeriod]);

  const totalRepayment = useMemo(() => monthlyPayment * (repaymentPeriod || 0), [monthlyPayment, repaymentPeriod]);

  const onSubmit = async (data: LoanApplicationFormData) => {
    setIsSubmitting(true);
    try {
      await creditService.apply({
        loanType: data.loanType,
        interestRateType: data.interestRateType,
        amount: data.amount,
        currency: data.currency as Currency,
        loanPurpose: data.loanPurpose,
        repaymentPeriod: data.repaymentPeriod,
        accountNumber: data.accountNumber,
        phoneNumber: data.phoneNumber,
        employmentStatus: data.employmentStatus || undefined,
        monthlyIncome: data.monthlyIncome,
        permanentEmployment: data.permanentEmployment,
        employmentPeriod: data.employmentPeriod,
      });
      toast.success('Zahtev za kredit je uspesno poslat.');
      navigate('/loans');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Slanje zahteva nije uspelo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zahtev za kredit</h1>
          <p className="text-sm text-muted-foreground">Popunite formular za podnoscenje zahteva za kredit.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Podaci zahteva</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loanType">Tip kredita</Label>
                <select
                  id="loanType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('loanType')}
                >
                  <option value="GOTOVINSKI">Gotovinski</option>
                  <option value="STAMBENI">Stambeni</option>
                  <option value="AUTO">Auto</option>
                  <option value="STUDENTSKI">Studentski</option>
                  <option value="REFINANSIRAJUCI">Refinansirajuci</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRateType">Tip kamate</Label>
                <select
                  id="interestRateType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('interestRateType')}
                >
                  <option value="FIKSNI">Fiksni</option>
                  <option value="VARIJABILNI">Varijabilni</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Iznos</Label>
                <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Valuta</Label>
                <select
                  id="currency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('currency')}
                >
                  <option value="RSD">RSD</option>
                  <option value="EUR">EUR</option>
                  <option value="CHF">CHF</option>
                  <option value="USD">USD</option>
                </select>
                {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loanPurpose">Svrha kredita</Label>
              <textarea
                id="loanPurpose"
                className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('loanPurpose')}
              />
              {errors.loanPurpose && <p className="text-sm text-destructive">{errors.loanPurpose.message}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repaymentPeriod">Period otplate (meseci)</Label>
                <select
                  id="repaymentPeriod"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('repaymentPeriod', { valueAsNumber: true })}
                >
                  {repaymentOptions.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
                {errors.repaymentPeriod && <p className="text-sm text-destructive">{errors.repaymentPeriod.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Racun za isplatu</Label>
                <select
                  id="accountNumber"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('accountNumber')}
                  disabled={isLoadingAccounts}
                >
                  <option value="">Izaberite racun</option>
                  {filteredAccounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} | {account.currency}
                    </option>
                  ))}
                </select>
                {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Kontakt telefon</Label>
                <Input id="phoneNumber" {...register('phoneNumber')} placeholder="+3816xxxxxxx" />
                {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="employmentStatus">Status zaposlenja</Label>
                <Input id="employmentStatus" {...register('employmentStatus')} placeholder="stalno/privremeno" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Mesecni prihod</Label>
                <Input
                  id="monthlyIncome"
                  type="number"
                  step="0.01"
                  {...register('monthlyIncome', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employmentPeriod">Period zaposlenja (meseci)</Label>
                <Input
                  id="employmentPeriod"
                  type="number"
                  {...register('employmentPeriod', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('permanentEmployment')} />
              Stalni radni odnos
            </label>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <p className="font-semibold text-sm">Kalkulacija kredita</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white dark:bg-background border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Kamatna stopa</p>
                  <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{annualRate.toFixed(2)}%</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-background border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Mesecna rata</p>
                  <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{monthlyPayment.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{selectedCurrency}</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-background border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Ukupno</p>
                  <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{totalRepayment.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{selectedCurrency}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">
                {isSubmitting ? 'Slanje...' : 'Posalji zahtev'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
