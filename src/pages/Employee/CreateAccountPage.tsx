//
// Ova stranica je dostupna samo zaposlenima (employee/admin).
// Omogucava kreiranje novog bankovnog racuna za klijenta.
//
// Spec Celina 2 §41-42 + Bug T2-001/T2-002/T2-003 (prijavljen 12.05.2026):
// Tip vlasnistva (Licni/Poslovni) i Tip racuna (Tekuci/Devizni) su DVA
// ORTOGONALNA KONCEPTA — moraju biti odvojeni dropdown-i. Plus mora postojati
// polje za Dnevni/Mesecni limit (Celina 2 §454-455).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Loader2, User, Building2, CreditCard, Wallet, Eye, Gauge } from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { clientService } from '@/services/clientService';
import { getErrorMessage } from '@/utils/formatters';
import { DEFAULT_DAILY_LIMIT, DEFAULT_MONTHLY_LIMIT } from '@/utils/accountConstants';
import type { Client } from '@/types';
import type { AccountType, AccountSubtype, Currency } from '@/types/celina2';
import {
  createAccountSchema,
  type CreateAccountFormData,
} from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ownershipTypeLabels: Record<string, string> = {
  LICNI: 'Licni racun',
  POSLOVNI: 'Poslovni racun',
};

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci racun',
  DEVIZNI: 'Devizni racun',
};

const ownershipColors: Record<string, string> = {
  LICNI: 'from-indigo-500 to-violet-700',
  POSLOVNI: 'from-amber-500 to-orange-700',
};

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      ownerEmail: '',
      ownershipType: 'LICNI',
      accountType: 'TEKUCI',
      accountSubtype: 'STANDARDNI',
      currency: 'RSD',
      initialDeposit: undefined,
      // Spec Celina 2 §454-455: defaultni limiti.
      dailyLimit: DEFAULT_DAILY_LIMIT,
      monthlyLimit: DEFAULT_MONTHLY_LIMIT,
      createCard: false,
      companyName: '',
      registrationNumber: '',
      taxId: '',
      activityCode: '',
      firmAddress: '',
      firmCity: '',
      firmCountry: '',
    },
  });

  const ownershipType = watch('ownershipType');
  const accountType = watch('accountType');
  const ownerEmail = watch('ownerEmail');
  const createCard = watch('createCard');
  const currency = watch('currency');
  const initialDeposit = watch('initialDeposit');
  const accountSubtype = watch('accountSubtype');
  const dailyLimit = watch('dailyLimit');
  const monthlyLimit = watch('monthlyLimit');
  const companyName = watch('companyName');

  const subtypeOptions = useMemo(() => {
    if (ownershipType === 'POSLOVNI') {
      return [
        { value: 'DOO', label: 'DOO' },
        { value: 'AD', label: 'AD' },
        { value: 'FONDACIJA', label: 'Fondacija' },
      ];
    }

    return [
      { value: 'STANDARDNI', label: 'Standardni' },
      { value: 'STEDNI', label: 'Stedni' },
      { value: 'PENZIONERSKI', label: 'Penzionerski' },
      { value: 'ZA_MLADE', label: 'Za mlade' },
      { value: 'STUDENTSKI', label: 'Studentski' },
      { value: 'ZA_NEZAPOSLENE', label: 'Za nezaposlene' },
    ];
  }, [ownershipType]);

  const currencyOptions = useMemo(() => {
    // Tekuci moze biti samo RSD (spec Celina 2 §43).
    if (accountType === 'TEKUCI') return ['RSD'];
    // Devizni — samo strane valute (spec §47).
    return ['EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'];
  }, [accountType]);

  // Kad se promeni ownershipType, resetuj subtype na prvu validnu opciju.
  useEffect(() => {
    if (ownershipType === 'POSLOVNI') {
      if (!['DOO', 'AD', 'FONDACIJA'].includes(accountSubtype || '')) {
        setValue('accountSubtype', 'DOO');
      }
    } else {
      if (['DOO', 'AD', 'FONDACIJA'].includes(accountSubtype || '')) {
        setValue('accountSubtype', 'STANDARDNI');
      }
    }
  }, [ownershipType, accountSubtype, setValue]);

  // Kad se promeni accountType, resetuj currency na prvu validnu opciju.
  useEffect(() => {
    if (accountType === 'TEKUCI') {
      setValue('currency', 'RSD');
    } else if (accountType === 'DEVIZNI' && currency === 'RSD') {
      setValue('currency', 'EUR');
    }
  }, [accountType, currency, setValue]);

  useEffect(() => {
    const query = ownerEmail?.trim() || '';
    if (query.length < 3) {
      setClientSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingClient(true);
      try {
        const result = await clientService.getAll({ email: query, page: 0, limit: 5 });
        setClientSuggestions((result.content ?? []).slice(0, 5));
      } catch {
        setClientSuggestions([]);
      } finally {
        setIsSearchingClient(false);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [ownerEmail]);

  /**
   * BE accountType ima 3 vrednosti (CHECKING, FOREIGN, BUSINESS) — mapiramo
   * iz nase ortogonalne (ownershipType, accountType) kombinacije:
   *   LICNI + TEKUCI → CHECKING (RSD)
   *   LICNI + DEVIZNI → FOREIGN (foreign currency)
   *   POSLOVNI + bilo koji → BUSINESS (currency razlikuje tekuci vs devizni)
   * BE razlikuje poslovni tekuci od poslovnog deviznog kroz currency polje.
   */
  const resolveBeAccountType = (ownership: string, type: string): string => {
    if (ownership === 'POSLOVNI') return 'BUSINESS';
    return type === 'TEKUCI' ? 'CHECKING' : 'FOREIGN';
  };

  const mapAccountSubtype = (feSub: string): string => {
    // R1-302: BE AccountSubtype enum nema AD/FONDACIJA — sve poslovne forme
    // (DOO/AD/FONDACIJA) mapiraju na STANDARD (jedina poslovna podvrsta na BE).
    // Pre fix-a samo DOO je bio mapiran, pa su AD/FONDACIJA isli "as-is" → 400.
    const map: Record<string, string> = {
      STANDARDNI: 'STANDARD', STEDNI: 'SAVINGS', PENZIONERSKI: 'PENSION',
      ZA_MLADE: 'YOUTH', STUDENTSKI: 'STUDENT', ZA_NEZAPOSLENE: 'UNEMPLOYED',
      DOO: 'STANDARD', AD: 'STANDARD', FONDACIJA: 'STANDARD', LICNI: 'PERSONAL',
    };
    return map[feSub] || feSub;
  };

  const onSubmit = async (data: CreateAccountFormData) => {
    setIsSubmitting(true);
    try {
      const isBusiness = data.ownershipType === 'POSLOVNI';
      const beAccountType = resolveBeAccountType(data.ownershipType, data.accountType);
      await accountService.create({
        ownerEmail: data.ownerEmail,
        accountType: beAccountType as AccountType,
        accountSubtype: mapAccountSubtype(data.accountSubtype || 'STANDARDNI') as AccountSubtype,
        currency: data.currency as Currency,
        initialDeposit: data.initialDeposit,
        // BE prima dailyLimit/monthlyLimit i koristi ih kao initial values.
        // Ako su undefined, BE primenjuje default-e (250k / 1M).
        dailyLimit: data.dailyLimit,
        monthlyLimit: data.monthlyLimit,
        createCard: data.createCard,
        companyName: isBusiness ? data.companyName : undefined,
        registrationNumber: isBusiness ? data.registrationNumber : undefined,
        taxId: isBusiness ? data.taxId : undefined,
        activityCode: isBusiness ? data.activityCode : undefined,
        firmAddress: isBusiness ? [data.firmAddress, data.firmCity, data.firmCountry].filter(Boolean).join(', ') : undefined,
      } as Parameters<typeof accountService.create>[0]);

      toast.success('Racun uspesno kreiran.');
      navigate('/employee/accounts');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Kreiranje racuna nije uspelo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/employee/accounts')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Nazad na portal racuna
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <Plus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kreiranje racuna</h1>
          <p className="text-sm text-muted-foreground">
            Kreirajte novi bankovni racun za klijenta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Form - left side */}
        <div className="xl:col-span-2">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Client section */}
            <Card className="rounded-2xl shadow-sm border-l-4 border-l-indigo-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                  <User className="h-4 w-4 text-indigo-500" />
                  <CardTitle>Vlasnik racuna</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="ownerEmail">Email vlasnika *</Label>
                  <Input id="ownerEmail" {...register('ownerEmail')} placeholder="ime.prezime@email.com" className="h-11" />
                  {errors.ownerEmail && <p className="text-sm font-medium text-destructive">{errors.ownerEmail.message}</p>}
                  {isSearchingClient && <p className="text-xs text-muted-foreground">Pretraga klijenata...</p>}
                  {clientSuggestions.length > 0 && (
                    <div className="border rounded-xl divide-y bg-background shadow-lg overflow-hidden">
                      {clientSuggestions.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left text-sm px-4 py-3 hover:bg-primary/5 transition-colors flex items-center justify-between"
                          onClick={() => {
                            setValue('ownerEmail', client.email, { shouldValidate: true, shouldDirty: true });
                            setClientSuggestions([]);
                          }}
                        >
                          <span className="font-medium">{client.firstName} {client.lastName}</span>
                          <span className="text-muted-foreground">{client.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account type section */}
            <Card className="rounded-2xl shadow-sm border-l-4 border-l-violet-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                  <Wallet className="h-4 w-4 text-indigo-500" />
                  <CardTitle>Tip racuna</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Spec §41-42: ortogonalna dva polja — vlasnistvo i tehnicki tip */}
                  <div className="space-y-2">
                    <Label>Tip vlasnistva *</Label>
                    <Select
                      value={ownershipType}
                      onValueChange={(val) => setValue('ownershipType', val as 'LICNI' | 'POSLOVNI', { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-11" data-testid="account-ownership-trigger">
                        <SelectValue placeholder="Izaberite tip vlasnistva" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LICNI" data-testid="account-ownership-licni">Licni</SelectItem>
                        <SelectItem value="POSLOVNI" data-testid="account-ownership-poslovni">Poslovni</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.ownershipType && <p className="text-sm font-medium text-destructive">{errors.ownershipType.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Tip racuna *</Label>
                    <Select
                      value={accountType}
                      onValueChange={(val) => setValue('accountType', val as 'TEKUCI' | 'DEVIZNI', { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-11" data-testid="account-type-trigger">
                        <SelectValue placeholder="Izaberite tip racuna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEKUCI" data-testid="account-type-tekuci">Tekuci (RSD)</SelectItem>
                        <SelectItem value="DEVIZNI" data-testid="account-type-devizni">Devizni</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.accountType && <p className="text-sm font-medium text-destructive">{errors.accountType.message}</p>}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Podvrsta racuna *</Label>
                    <Select
                      value={accountSubtype || subtypeOptions[0]?.value}
                      onValueChange={(val) => setValue('accountSubtype', val, { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Izaberite podvrstu" />
                      </SelectTrigger>
                      <SelectContent>
                        {subtypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.accountSubtype && <p className="text-sm font-medium text-destructive">{errors.accountSubtype.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Valuta *</Label>
                    <Select
                      value={currency || currencyOptions[0]}
                      onValueChange={(val) => setValue('currency', val, { shouldValidate: true })}
                      disabled={accountType === 'TEKUCI'}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Izaberite valutu" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyOptions.map((cur) => (
                          <SelectItem key={cur} value={cur}>
                            {cur}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.currency && <p className="text-sm font-medium text-destructive">{errors.currency.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialDeposit">Inicijalni depozit</Label>
                  <Input
                    id="initialDeposit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="h-11 font-mono"
                    {...register('initialDeposit', {
                      setValueAs: (value) => (value === '' ? undefined : Number(value)),
                    })}
                  />
                  {errors.initialDeposit && <p className="text-sm font-medium text-destructive">{errors.initialDeposit.message}</p>}
                </div>

                <div className="flex items-center gap-3 rounded-xl border p-4 bg-muted/30 transition-colors hover:bg-muted/50">
                  <Switch
                    checked={createCard}
                    onCheckedChange={(checked) => setValue('createCard', checked)}
                  />
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <Label className="cursor-pointer" onClick={() => setValue('createCard', !createCard)}>
                      Napravi karticu uz racun
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Limits section — Bug T2-003 (Plan_Manuelnog_Testiranja zahteva) */}
            <Card className="rounded-2xl shadow-sm border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600" />
                  <Gauge className="h-4 w-4 text-blue-500" />
                  <CardTitle>Limiti transakcija</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Maksimalni iznos transakcija po danu/mesecu. Default: 250.000 / 1.000.000 ({currency || 'RSD'}).
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dailyLimit">Dnevni limit</Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      step="0.01"
                      placeholder="250000"
                      className="h-11 font-mono"
                      data-testid="account-daily-limit"
                      {...register('dailyLimit', {
                        setValueAs: (value) => (value === '' ? undefined : Number(value)),
                      })}
                    />
                    {errors.dailyLimit && <p className="text-sm font-medium text-destructive">{errors.dailyLimit.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyLimit">Mesecni limit</Label>
                    <Input
                      id="monthlyLimit"
                      type="number"
                      step="0.01"
                      placeholder="1000000"
                      className="h-11 font-mono"
                      data-testid="account-monthly-limit"
                      {...register('monthlyLimit', {
                        setValueAs: (value) => (value === '' ? undefined : Number(value)),
                      })}
                    />
                    {errors.monthlyLimit && <p className="text-sm font-medium text-destructive">{errors.monthlyLimit.message}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business fields */}
            {ownershipType === 'POSLOVNI' && (
              <Card className="rounded-2xl shadow-sm border-l-4 border-l-amber-500">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-gradient-to-b from-amber-500 to-orange-600" />
                    <Building2 className="h-4 w-4 text-amber-500" />
                    <CardTitle>Podaci firme</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Naziv firme *</Label>
                      <Input id="companyName" {...register('companyName')} className="h-11" />
                      {errors.companyName && <p className="text-sm font-medium text-destructive">{errors.companyName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Maticni broj *</Label>
                      <Input id="registrationNumber" {...register('registrationNumber')} className="h-11 font-mono" />
                      {errors.registrationNumber && <p className="text-sm font-medium text-destructive">{errors.registrationNumber.message}</p>}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="taxId">PIB *</Label>
                      <Input id="taxId" {...register('taxId')} className="h-11 font-mono" />
                      {errors.taxId && <p className="text-sm font-medium text-destructive">{errors.taxId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="activityCode">Sifra delatnosti</Label>
                      <Input id="activityCode" {...register('activityCode')} placeholder="62.01" className="h-11 font-mono" />
                      {errors.activityCode && <p className="text-sm font-medium text-destructive">{errors.activityCode.message}</p>}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="firmAddress">Adresa firme</Label>
                      <Input id="firmAddress" {...register('firmAddress')} className="h-11" />
                      {errors.firmAddress && <p className="text-sm font-medium text-destructive">{errors.firmAddress.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firmCity">Grad</Label>
                      <Input id="firmCity" {...register('firmCity')} className="h-11" />
                      {errors.firmCity && <p className="text-sm font-medium text-destructive">{errors.firmCity.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firmCountry">Drzava</Label>
                      <Input id="firmCountry" {...register('firmCountry')} className="h-11" />
                      {errors.firmCountry && <p className="text-sm font-medium text-destructive">{errors.firmCountry.message}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <div className="sticky bottom-0 z-10 -mx-4 rounded-t-xl border-t bg-background/80 px-4 py-4 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] backdrop-blur-lg sm:-mx-6 sm:px-6">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/employee/accounts')}
                >
                  Otkazi
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? 'Kreiranje...' : 'Kreiraj racun'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Preview card - right side */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-4">
            <Card className="rounded-2xl shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pregled racuna</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mini card preview */}
                <div className={`relative rounded-2xl bg-gradient-to-br ${ownershipColors[ownershipType] || 'from-indigo-500 to-violet-700'} p-5 text-white shadow-lg overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20" />
                    <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
                  </div>
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/70">
                        {ownershipTypeLabels[ownershipType] || 'Racun'} · {accountTypeLabels[accountType]?.replace(' racun', '') || ''}
                      </p>
                      <Wallet className="h-5 w-5 text-white/50" />
                    </div>
                    <p className="text-2xl font-bold font-mono tabular-nums">
                      {initialDeposit ? Number(initialDeposit).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) : '0,00'}
                      <span className="ml-1.5 text-sm font-normal text-white/70">{currency || 'RSD'}</span>
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-white/60 truncate max-w-[150px]">{ownerEmail || 'email@primer.com'}</p>
                      {accountSubtype && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50 bg-white/10 rounded-full px-2 py-0.5">
                          {accountSubtype}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vlasnistvo</span>
                    <Badge variant="secondary" className="font-medium">{ownershipTypeLabels[ownershipType] || ownershipType}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tip</span>
                    <Badge variant="secondary" className="font-medium">{accountTypeLabels[accountType] || accountType}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Podvrsta</span>
                    <span className="font-medium">{subtypeOptions.find(s => s.value === accountSubtype)?.label || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valuta</span>
                    <span className="font-mono font-medium">{currency || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Depozit</span>
                    <span className="font-mono font-medium">
                      {initialDeposit ? Number(initialDeposit).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dnevni limit</span>
                    <span className="font-mono font-medium">
                      {dailyLimit != null ? Number(dailyLimit).toLocaleString('sr-RS') : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mesecni limit</span>
                    <span className="font-mono font-medium">
                      {monthlyLimit != null ? Number(monthlyLimit).toLocaleString('sr-RS') : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Kartica</span>
                    <div className={`flex items-center gap-1.5 ${createCard ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      <CreditCard className="h-3.5 w-3.5" />
                      <span className="font-medium">{createCard ? 'Da' : 'Ne'}</span>
                    </div>
                  </div>
                  {ownershipType === 'POSLOVNI' && companyName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Firma</span>
                      <span className="font-medium truncate max-w-[150px]">{companyName}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
