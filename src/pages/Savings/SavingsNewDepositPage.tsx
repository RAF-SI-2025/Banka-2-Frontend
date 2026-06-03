import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PiggyBank } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import PageHeader from '@/components/shared/PageHeader';
import VerificationModal from '@/components/shared/VerificationModal';
import { savingsService } from '@/services/savingsService';
import { accountService } from '@/services/accountService';
import { SavingsCalculator } from '@/components/savings/SavingsCalculator';
import type { SavingsRateDto } from '@/types/savings';
import { MIN_DEPOSIT_AMOUNT, TERM_OPTIONS } from '@/types/savings';
import type { Account } from '@/types/celina2';

const schema = z.object({
  sourceAccountId: z.number({ message: 'Izaberite izvorni racun' }),
  linkedAccountId: z.number({ message: 'Izaberite povezani racun' }),
  principalAmount: z.number().positive('Iznos mora biti pozitivan'),
  termMonths: z
    .number()
    .refine(v => [3, 6, 12, 24, 36].includes(v), 'Rok mora biti 3/6/12/24/36 meseci'),
  autoRenew: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function SavingsNewDepositPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<SavingsRateDto[]>([]);
  const [showOtp, setShowOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // FIX FE-FND-01: cuvamo validirane podatke iz onSubmit-a u ref-u tako da
  // handleOtpVerified ne zavisi od `watch()` (koji moze vratiti stale state
  // ako form remount-uje izmedju onSubmit i OTP verify). Closure-d data
  // pattern (paritet sa NewPaymentPage 2PC flow-om).
  const pendingDataRef = useRef<FormData | null>(null);

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      termMonths: 12,
      autoRenew: false,
      principalAmount: 0,
    },
  });

  const sourceAccountId = watch('sourceAccountId');
  const principal = watch('principalAmount');
  const termMonths = watch('termMonths');
  const autoRenew = watch('autoRenew');
  const linkedAccountId = watch('linkedAccountId');

  useEffect(() => {
    accountService
      .getMyAccounts()
      .then(all => {
        const active = all.filter(a => a.status === 'ACTIVE');
        setAccounts(active);
      })
      .catch(() => toast.error('Neuspeh ucitavanja racuna'));

    savingsService
      .getRates()
      .then(setRates)
      .catch(() => toast.error('Neuspeh ucitavanja stopa'));
  }, []);

  const sourceAccount = useMemo(
    () => accounts.find(a => a.id === sourceAccountId),
    [accounts, sourceAccountId]
  );
  // Account.currency je tipa Currency (string union "RSD"/"EUR"/...), nije objekat.
  // Fix 12.05.2026 vece: pre fix-a sourceAccount.currency.code je radjeno kao
  // da je objekat sto je TS error sa verbatimModuleSyntax.
  const currencyCode = sourceAccount?.currency ?? 'RSD';
  const minAmount = MIN_DEPOSIT_AMOUNT[currencyCode] ?? 100;

  const annualRate = useMemo(() => {
    const r = rates.find(rt => rt.currencyCode === currencyCode && rt.termMonths === termMonths);
    return r?.annualRate ?? 0;
  }, [rates, currencyCode, termMonths]);

  const onSubmit = (data: FormData) => {
    if (data.principalAmount < minAmount) {
      toast.error(`Minimalan iznos u ${currencyCode} je ${minAmount}`);
      return;
    }
    // R4-1796: balance-check PRE OTP-a. Glavnica se skida sa izvornog racuna pa
    // ako prelazi raspolozivo stanje, BE bi ionako odbio — ali tek posle potrosenog
    // OTP pokusaja. Proveravamo lokalno da korisnik ne gubi OTP na ocekivanu gresku.
    if (sourceAccount && data.principalAmount > Number(sourceAccount.availableBalance ?? 0)) {
      toast.error('Nedovoljno sredstava na izvornom racunu za zeljenu glavnicu.');
      return;
    }
    // FIX FE-FND-01: snapshot validated form data u ref pa otvori OTP.
    // Ref se cita u handleOtpVerified umesto `watch()` (anti-stale guard).
    pendingDataRef.current = data;
    setShowOtp(true);
  };

  const handleOtpVerified = async (otpCode: string) => {
    // FIX FE-FND-01: koristimo snapshot iz onSubmit-a, ne live form state.
    const data = pendingDataRef.current;
    if (!data) {
      toast.error('Podaci o depozitu nisu pripremljeni. Pokusajte ponovo.');
      setShowOtp(false);
      throw new Error('No pending deposit data');
    }
    setSubmitting(true);
    try {
      const result = await savingsService.openDeposit({
        sourceAccountId: data.sourceAccountId,
        linkedAccountId: data.linkedAccountId,
        principalAmount: data.principalAmount,
        termMonths: data.termMonths,
        autoRenew: data.autoRenew,
        otpCode,
      });
      toast.success('Depozit otvoren — Vasi novci ce raditi za vas');
      pendingDataRef.current = null;
      navigate(`/savings/${result.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Otvaranje depozita nije uspelo');
      // Re-throw so VerificationModal can handle the error state (show error, decrement attempts)
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const sameAccountOptions = useMemo(
    () => accounts.filter(a => a.currency === currencyCode),
    [accounts, currencyCode]
  );

  // R7-2035: kad se promeni valuta izvornog racuna, povezani racun (gde idu kamate)
  // mora biti u istoj valuti. Ako prethodno izabrani linkedAccountId vise nije u
  // dozvoljenom skupu (sameAccountOptions), resetuj ga na izvorni racun — inace
  // forma drzi stale id druge valute koji BE odbije. Dropdown bi vizuelno pokazao
  // "-- Izaberi --" ali bi form state i dalje slao staru vrednost.
  useEffect(() => {
    if (linkedAccountId == null) return;
    const stillValid = sameAccountOptions.some(a => a.id === linkedAccountId);
    if (!stillValid) {
      if (sourceAccountId != null && sameAccountOptions.some(a => a.id === sourceAccountId)) {
        setValue('linkedAccountId', sourceAccountId);
      } else {
        setValue('linkedAccountId', undefined as unknown as number);
      }
    }
  }, [sameAccountOptions, linkedAccountId, sourceAccountId, setValue]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <PageHeader
          icon={<PiggyBank className="h-5 w-5" />}
          title="Novi oroceni depozit"
          description="Glavnica zakljucana, mesecna kamata na povezani racun"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-4">
          {/* Source account */}
          <div>
            <Label htmlFor="sourceAccount">Izvorni racun (sa kog se uzima glavnica)</Label>
            <select
              id="sourceAccount"
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background text-sm"
              data-testid="source-account"
              value={sourceAccountId ?? ''}
              onChange={e => {
                const id = Number(e.target.value);
                setValue('sourceAccountId', id);
                // Default linked to same account if not yet chosen
                if (!linkedAccountId) setValue('linkedAccountId', id);
              }}
            >
              <option value="">-- Izaberi --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber} ({a.currency}) — {a.availableBalance.toFixed(2)}
                </option>
              ))}
            </select>
            {errors.sourceAccountId && (
              <p className="text-red-500 text-xs mt-1">{errors.sourceAccountId.message}</p>
            )}
          </div>

          {/* Principal amount */}
          <div>
            <Label htmlFor="principal">
              Iznos (min. {minAmount} {currencyCode})
            </Label>
            <Input
              id="principal"
              type="number"
              step="0.01"
              min={0}
              data-testid="principal-input"
              {...register('principalAmount', { valueAsNumber: true })}
            />
            {errors.principalAmount && (
              <p className="text-red-500 text-xs mt-1">{errors.principalAmount.message}</p>
            )}
          </div>

          {/* Term selector */}
          <div>
            <Label>Rok (meseci)</Label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {TERM_OPTIONS.map(t => {
                const r = rates.find(rt => rt.currencyCode === currencyCode && rt.termMonths === t);
                return (
                  <button
                    key={t}
                    type="button"
                    data-testid={`term-${t}`}
                    onClick={() => setValue('termMonths', t)}
                    className={`p-3 border rounded-md transition-colors text-sm ${
                      termMonths === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <div className="font-semibold">{t}m</div>
                    <div className="text-xs opacity-75">{r ? `${r.annualRate}%` : '-'}</div>
                  </button>
                );
              })}
            </div>
            {errors.termMonths && (
              <p className="text-red-500 text-xs mt-1">{errors.termMonths.message}</p>
            )}
          </div>

          {/* Linked account */}
          <div>
            <Label htmlFor="linkedAccount">Povezani racun (gde idu kamate)</Label>
            <select
              id="linkedAccount"
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background text-sm"
              data-testid="linked-account"
              value={linkedAccountId ?? ''}
              onChange={e => setValue('linkedAccountId', Number(e.target.value))}
            >
              <option value="">-- Izaberi --</option>
              {sameAccountOptions.map(a => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber}
                </option>
              ))}
            </select>
            {errors.linkedAccountId && (
              <p className="text-red-500 text-xs mt-1">{errors.linkedAccountId.message}</p>
            )}
          </div>

          {/* Auto-renew toggle */}
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label>Auto-obnova na dospece</Label>
              <p className="text-xs text-muted-foreground">
                Glavnica se automatski produzava po vazecoj stopi
              </p>
            </div>
            <Switch
              checked={autoRenew}
              onCheckedChange={v => setValue('autoRenew', v)}
              data-testid="auto-renew-toggle"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            data-testid="submit-deposit"
          >
            Otvori depozit
          </Button>
        </Card>

        {/* Calculator sidebar */}
        <SavingsCalculator
          principal={principal || 0}
          annualRate={annualRate}
          termMonths={termMonths}
          currencyCode={currencyCode}
        />
      </form>

      <VerificationModal
        isOpen={showOtp}
        onVerified={handleOtpVerified}
        onClose={() => {
          setShowOtp(false);
          pendingDataRef.current = null;
        }}
      />
    </div>
  );
}
