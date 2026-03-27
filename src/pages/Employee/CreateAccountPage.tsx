//
// Ova stranica je dostupna samo zaposlenima (employee/admin).
// Omogucava kreiranje novog bankovnog racuna za klijenta.
// - react-hook-form + zodResolver(createAccountSchema)
// - Polja: email vlasnika (ili pretraga postojeceg klijenta sa clientService.search),
//   tip racuna, podvrsta racuna (AccountSubtype), valuta, inicijalni depozit, checkbox "Napravi karticu"
// - Za TEKUCI/DEVIZNI podvrste: Standardni/Stedni/Penzionerski/Za mlade/Studentski/Za nezaposlene
// - Za POSLOVNI podvrste: DOO/AD/Fondacija + polja firme (naziv, maticni, PIB, sifra delatnosti, adresa, grad, drzava)
// - Valuta: za TEKUCI samo RSD; za DEVIZNI dropdown (EUR/CHF/USD/GBP/JPY/CAD/AUD)
// - accountService.create(data)
// - Spec: "Kreiranje racuna" iz Celine 2 (employee section)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Loader2, User, Building2, CreditCard, Wallet } from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { clientService } from '@/services/clientService';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      accountType: 'TEKUCI',
      accountSubtype: 'STANDARDNI',
      currency: 'RSD',
      initialDeposit: undefined,
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

  const accountType = watch('accountType');
  const ownerEmail = watch('ownerEmail');
  const createCard = watch('createCard');

  const subtypeOptions = useMemo(() => {
    if (accountType === 'POSLOVNI') {
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
  }, [accountType]);

  const currencyOptions = useMemo(() => {
    if (accountType === 'TEKUCI') return ['RSD'];
    if (accountType === 'DEVIZNI') return ['EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'];
    return ['RSD', 'EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'];
  }, [accountType]);

  useEffect(() => {
    if (accountType === 'TEKUCI') {
      setValue('currency', 'RSD');
      setValue('accountSubtype', 'STANDARDNI');
      return;
    }
    if (accountType === 'DEVIZNI') {
      setValue('currency', 'EUR');
      setValue('accountSubtype', 'STANDARDNI');
      return;
    }

    setValue('currency', 'RSD');
    setValue('accountSubtype', 'DOO');
  }, [accountType, setValue]);

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

  const mapAccountType = (feType: string): string => {
    const map: Record<string, string> = { TEKUCI: 'CHECKING', DEVIZNI: 'FOREIGN', POSLOVNI: 'BUSINESS' };
    return map[feType] || feType;
  };

  const mapAccountSubtype = (feSub: string): string => {
    const map: Record<string, string> = {
      STANDARDNI: 'STANDARD', STEDNI: 'SAVINGS', PENZIONERSKI: 'PENSION',
      ZA_MLADE: 'YOUTH', STUDENTSKI: 'STUDENT', ZA_NEZAPOSLENE: 'UNEMPLOYED',
      DOO: 'STANDARD', LICNI: 'PERSONAL',
    };
    return map[feSub] || feSub;
  };

  const onSubmit = async (data: CreateAccountFormData) => {
    setIsSubmitting(true);
    try {
      const isBusiness = data.accountType === 'POSLOVNI';
      await accountService.create({
        ownerEmail: data.ownerEmail,
        accountType: mapAccountType(data.accountType) as AccountType,
        accountSubtype: mapAccountSubtype(data.accountSubtype || 'STANDARDNI') as AccountSubtype,
        currency: data.currency as Currency,
        initialDeposit: data.initialDeposit,
        createCard: data.createCard,
        companyName: isBusiness ? data.companyName : undefined,
        registrationNumber: isBusiness ? data.registrationNumber : undefined,
        taxId: isBusiness ? data.taxId : undefined,
        activityCode: isBusiness ? data.activityCode : undefined,
        firmAddress: isBusiness ? [data.firmAddress, data.firmCity, data.firmCountry].filter(Boolean).join(', ') : undefined,
      });

      toast.success('Racun uspesno kreiran.');
      navigate('/employee/accounts');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Kreiranje racuna nije uspelo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 max-w-3xl">
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

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Client section */}
        <Card>
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
              <Input id="ownerEmail" {...register('ownerEmail')} placeholder="ime.prezime@email.com" />
              {errors.ownerEmail && <p className="text-sm font-medium text-destructive">{errors.ownerEmail.message}</p>}
              {isSearchingClient && <p className="text-xs text-muted-foreground">Pretraga klijenata...</p>}
              {clientSuggestions.length > 0 && (
                <div className="border rounded-md divide-y bg-background shadow-sm">
                  {clientSuggestions.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="w-full text-left text-sm px-3 py-2 hover:bg-primary/5 transition-colors flex items-center justify-between"
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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <Wallet className="h-4 w-4 text-indigo-500" />
              <CardTitle>Tip racuna</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tip racuna *</Label>
                <Select
                  value={accountType}
                  onValueChange={(val) => setValue('accountType', val as 'TEKUCI' | 'DEVIZNI' | 'POSLOVNI', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite tip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEKUCI">Tekuci</SelectItem>
                    <SelectItem value="DEVIZNI">Devizni</SelectItem>
                    <SelectItem value="POSLOVNI">Poslovni</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Podvrsta racuna *</Label>
                <Select
                  value={watch('accountSubtype') || subtypeOptions[0]?.value}
                  onValueChange={(val) => setValue('accountSubtype', val, { shouldValidate: true })}
                >
                  <SelectTrigger>
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Valuta *</Label>
                <Select
                  value={watch('currency') || currencyOptions[0]}
                  onValueChange={(val) => setValue('currency', val, { shouldValidate: true })}
                  disabled={accountType === 'TEKUCI'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite valutu" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.currency && <p className="text-sm font-medium text-destructive">{errors.currency.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialDeposit">Inicijalni depozit</Label>
                <Input
                  id="initialDeposit"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('initialDeposit', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
                {errors.initialDeposit && <p className="text-sm font-medium text-destructive">{errors.initialDeposit.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border p-4">
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

        {/* Business fields */}
        {accountType === 'POSLOVNI' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                <Building2 className="h-4 w-4 text-indigo-500" />
                <CardTitle>Podaci firme</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Naziv firme *</Label>
                  <Input id="companyName" {...register('companyName')} />
                  {errors.companyName && <p className="text-sm font-medium text-destructive">{errors.companyName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Maticni broj *</Label>
                  <Input id="registrationNumber" {...register('registrationNumber')} />
                  {errors.registrationNumber && <p className="text-sm font-medium text-destructive">{errors.registrationNumber.message}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxId">PIB *</Label>
                  <Input id="taxId" {...register('taxId')} />
                  {errors.taxId && <p className="text-sm font-medium text-destructive">{errors.taxId.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activityCode">Sifra delatnosti</Label>
                  <Input id="activityCode" {...register('activityCode')} placeholder="62.01" />
                  {errors.activityCode && <p className="text-sm font-medium text-destructive">{errors.activityCode.message}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="firmAddress">Adresa firme</Label>
                  <Input id="firmAddress" {...register('firmAddress')} />
                  {errors.firmAddress && <p className="text-sm font-medium text-destructive">{errors.firmAddress.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firmCity">Grad</Label>
                  <Input id="firmCity" {...register('firmCity')} />
                  {errors.firmCity && <p className="text-sm font-medium text-destructive">{errors.firmCity.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firmCountry">Drzava</Label>
                  <Input id="firmCountry" {...register('firmCountry')} />
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
  );
}
