//
// Ova stranica sadrzi formu za podnoscenje zahteva za kredit.
// - react-hook-form + zodResolver(loanApplicationSchema)
// - Polja: tip kredita, tip kamate (fiksni/varijabilni), iznos, valuta, svrha kredita,
//   period otplate (dropdown sa dozvoljenim vrednostima iz REPAYMENT_PERIODS), racun, telefon
// - Opciona polja: status zaposlenja, mesecni prihod, stalni radni odnos, period zaposlenja
// - Prikaz kalkulacije: mesecna rata, ukupan iznos, efektivna kamatna stopa
// - Submit: creditService.apply(data)
// - Spec: "Zahtev za kredit" iz Celine 2

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, CheckCircle2, CircleDot, Coins, Calendar, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { creditService } from '@/services/creditService';
import type { Account, Currency } from '@/types/celina2';
import {
  REPAYMENT_PERIODS,
  loanApplicationSchema,
  type LoanApplicationFormData,
} from '@/utils/validationSchemas.celina2';
import { asArray } from '@/utils/formatters';
import { LOAN_AMOUNT_MIN, LOAN_AMOUNT_MAX, LOAN_AMOUNT_STEP } from '@/utils/accountConstants';
import { estimateLoanEffectiveRate } from '@/utils/loanLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

/* Step indicator */
const steps = [
  { id: 1, label: 'Tip kredita', icon: ClipboardList },
  { id: 2, label: 'Iznos i period', icon: Coins },
  { id: 3, label: 'Licni podaci', icon: CircleDot },
  { id: 4, label: 'Potvrda', icon: CheckCircle2 },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto mb-8">
      {steps.map((step, index) => {
        const isActive = currentStep >= step.id;
        const isComplete = currentStep > step.id;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`
                flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300
                ${isComplete
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : isActive
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-muted text-muted-foreground'
                }
              `}>
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-3 mt-[-18px] rounded-full transition-colors duration-300 ${isComplete ? 'bg-emerald-400' : isActive ? 'bg-indigo-400/30' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Donut chart */
function DonutChart({ principal, interest, size = 160 }: { principal: number; interest: number; size?: number }) {
  const total = principal + interest;
  if (total <= 0) return null;
  const principalPct = (principal / total) * 100;
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const principalArc = (principalPct / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="16" className="stroke-violet-500/80" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="16" strokeLinecap="round"
          className="stroke-indigo-500 transition-all duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - principalArc}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground font-medium">Ukupno</span>
        <span className="text-lg font-bold tabular-nums">{total > 0 ? total.toLocaleString('sr-RS', { maximumFractionDigits: 0 }) : '0'}</span>
      </div>
    </div>
  );
}

export default function LoanApplicationPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visibleStep, setVisibleStep] = useState(1);

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

  // Track which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) setVisibleStep(idx + 1);
          }
        }
      },
      { threshold: 0.5 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

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

  // R1-657/R1-658: efektivna (base + marža) stopa preko centralizovanog helper-a
  // (mirror BE getBaseRate + LoanType.getMargin); pre su tranše/marže bile inline magic.
  const annualRate = useMemo(
    () => estimateLoanEffectiveRate(amount, selectedLoanType),
    [amount, selectedLoanType]
  );

  const monthlyPayment = useMemo(() => {
    if (!amount || !repaymentPeriod || repaymentPeriod <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return amount / repaymentPeriod;

    const numerator = amount * monthlyRate * Math.pow(1 + monthlyRate, repaymentPeriod);
    const denominator = Math.pow(1 + monthlyRate, repaymentPeriod) - 1;
    return denominator === 0 ? 0 : numerator / denominator;
  }, [amount, annualRate, repaymentPeriod]);

  const totalRepayment = useMemo(() => monthlyPayment * (repaymentPeriod || 0), [monthlyPayment, repaymentPeriod]);
  const totalInterest = useMemo(() => Math.max(0, totalRepayment - amount), [totalRepayment, amount]);

  // ACCEPTED-DEVIATION (user-directed 03.06): zahtev za kredit se podnosi direktno,
  // bez OTP verifikacije. OTP ostaje SAMO na placanju i transferu (money-out).
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
    } catch {
      toast.error('Podnosenje zahteva za kredit nije uspelo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all";

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zahtev za kredit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Popunite formular za podnosenje zahteva za kredit</p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={visibleStep} />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Step 1: Loan type */}
        <div ref={el => { sectionRefs.current[0] = el; }}>
          <Card className="rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-bold">Tip kredita</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="loanType">Tip kredita</Label>
                  <select id="loanType" className={selectClass} {...register('loanType')}>
                    <option value="GOTOVINSKI">Gotovinski</option>
                    <option value="STAMBENI">Stambeni</option>
                    <option value="AUTO">Auto</option>
                    <option value="STUDENTSKI">Studentski</option>
                    <option value="REFINANSIRAJUCI">Refinansirajuci</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestRateType">Tip kamate</Label>
                  <select id="interestRateType" className={selectClass} {...register('interestRateType')}>
                    <option value="FIKSNI">Fiksni</option>
                    <option value="VARIJABILNI">Varijabilni</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Amount & Period */}
        <div ref={el => { sectionRefs.current[1] = el; }}>
          <Card className="rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-5 w-5 text-violet-500" />
                <h2 className="text-lg font-bold">Iznos i period otplate</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Iznos</Label>
                  <Input id="amount" type="number" step="0.01" className="text-lg font-semibold" {...register('amount', { valueAsNumber: true })} />
                  {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                  {/* Slider */}
                  <input
                    type="range"
                    min={LOAN_AMOUNT_MIN}
                    max={LOAN_AMOUNT_MAX}
                    step={LOAN_AMOUNT_STEP}
                    value={amount}
                    onChange={(e) => setValue('amount', Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    aria-label="Iznos kredita"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{LOAN_AMOUNT_MIN.toLocaleString('sr-RS')}</span>
                    <span>{LOAN_AMOUNT_MAX.toLocaleString('sr-RS')}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Valuta</Label>
                  <select id="currency" className={selectClass} {...register('currency')}>
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
                  className="flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                  {...register('loanPurpose')}
                />
                {errors.loanPurpose && <p className="text-sm text-destructive">{errors.loanPurpose.message}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="repaymentPeriod">Period otplate (meseci)</Label>
                  <select id="repaymentPeriod" className={selectClass} {...register('repaymentPeriod', { valueAsNumber: true })}>
                    {repaymentOptions.map((period) => (
                      <option key={period} value={period}>{period} meseci</option>
                    ))}
                  </select>
                  {errors.repaymentPeriod && <p className="text-sm text-destructive">{errors.repaymentPeriod.message}</p>}
                  {/* Period slider */}
                  {repaymentOptions.length > 1 && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={repaymentOptions.length - 1}
                        step={1}
                        value={repaymentOptions.indexOf(repaymentPeriod as never)}
                        onChange={(e) => setValue('repaymentPeriod', repaymentOptions[Number(e.target.value)])}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-violet-500"
                        aria-label="Period otplate"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{repaymentOptions[0]} mes.</span>
                        <span>{repaymentOptions[repaymentOptions.length - 1]} mes.</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Racun za isplatu</Label>
                  <select id="accountNumber" className={selectClass} {...register('accountNumber')} disabled={isLoadingAccounts}>
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

              {/* Calculator - premium display */}
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 dark:from-indigo-950/30 dark:via-background dark:to-violet-950/30 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                  <p className="font-bold text-sm">Kalkulacija kredita</p>
                </div>
                {/* R1-254: stope/anuitet su ORIJENTACIONA procena (FE kalkulator),
                    a NE obavezujuca ponuda — konacne uslove utvrdjuje banka pri
                    odobravanju. Bez disclaimer-a bi izmisljeni brojevi izgledali
                    kao stvarni uslovi (krsi "ne lazni podaci"). */}
                <p className="text-xs text-muted-foreground mb-6">
                  Prikazana kamatna stopa i rata su orijentaciona procena. Konacne uslove
                  kredita utvrdjuje banka prilikom obrade zahteva.
                </p>

                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Donut chart */}
                  <div className="flex flex-col items-center gap-3">
                    <DonutChart principal={amount} interest={totalInterest} size={150} />
                    <div className="flex gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        <span className="text-muted-foreground">Glavnica</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                        <span className="text-muted-foreground">Kamata</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex-1 grid gap-4 sm:grid-cols-3 w-full">
                    <div className="rounded-xl bg-white dark:bg-background border p-4 text-center hover:shadow-md transition-shadow">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Efektivna kamatna stopa</p>
                      <p className="text-2xl font-bold mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{annualRate.toFixed(2)}%</p>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-background border p-4 text-center hover:shadow-md transition-shadow">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Mesecna rata</p>
                      <p className="text-2xl font-bold mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{monthlyPayment.toLocaleString('sr-RS', { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-muted-foreground mt-1">{selectedCurrency}</p>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-background border p-4 text-center hover:shadow-md transition-shadow">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Ukupno</p>
                      <p className="text-2xl font-bold mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{totalRepayment.toLocaleString('sr-RS', { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-muted-foreground mt-1">{selectedCurrency}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 3: Personal info */}
        <div ref={el => { sectionRefs.current[2] = el; }}>
          <Card className="rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CircleDot className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-bold">Licni podaci</h2>
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

              <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer group">
                <input type="checkbox" {...register('permanentEmployment')} className="h-4 w-4 rounded border-input accent-indigo-500" />
                <span className="group-hover:text-foreground transition-colors">Stalni radni odnos</span>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Step 4: Confirm */}
        <div ref={el => { sectionRefs.current[3] = el; }}>
          <Card className="rounded-2xl overflow-hidden border-indigo-500/20">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-bold">Potvrda i slanje</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Proverite unete podatke pre slanja zahteva. Nakon slanja, vas zahtev ce biti pregledan od strane zaposlenog banke.
              </p>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200 px-8 py-5 text-base rounded-xl"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Slanje...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-5 w-5" />
                      Posalji zahtev
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
