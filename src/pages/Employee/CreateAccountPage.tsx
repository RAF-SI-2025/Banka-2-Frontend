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
import { Plus } from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { clientService } from '@/services/clientService';
import type { Client } from '@/types';
import type { AccountSubtype, Currency } from '@/types/celina2';
import {
  createAccountSchema,
  type CreateAccountFormData,
} from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        const clients = await clientService.search(query);
        setClientSuggestions(clients.slice(0, 5));
      } catch {
        setClientSuggestions([]);
      } finally {
        setIsSearchingClient(false);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [ownerEmail]);

  const onSubmit = async (data: CreateAccountFormData) => {
    setIsSubmitting(true);
    try {
      await accountService.create({
        ownerEmail: data.ownerEmail,
        accountType: data.accountType,
        accountSubtype: data.accountSubtype as AccountSubtype,
        currency: data.currency as Currency,
        initialDeposit: data.initialDeposit,
        createCard: data.createCard,
        companyName: data.accountType === 'POSLOVNI' ? data.companyName : undefined,
        registrationNumber: data.accountType === 'POSLOVNI' ? data.registrationNumber : undefined,
        taxId: data.accountType === 'POSLOVNI' ? data.taxId : undefined,
        activityCode: data.accountType === 'POSLOVNI' ? data.activityCode : undefined,
        firmAddress: data.accountType === 'POSLOVNI' ? data.firmAddress : undefined,
        firmCity: data.accountType === 'POSLOVNI' ? data.firmCity : undefined,
        firmCountry: data.accountType === 'POSLOVNI' ? data.firmCountry : undefined,
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
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Plus className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Kreiranje racuna</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Kreirajte novi bankovni racun za klijenta.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Novi racun</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email vlasnika</Label>
              <Input id="ownerEmail" {...register('ownerEmail')} placeholder="ime.prezime@email.com" />
              {errors.ownerEmail && <p className="text-sm text-destructive">{errors.ownerEmail.message}</p>}
              {isSearchingClient && <p className="text-xs text-muted-foreground">Pretraga klijenata...</p>}
              {clientSuggestions.length > 0 && (
                <div className="border rounded-md p-2 space-y-1 bg-background">
                  {clientSuggestions.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted"
                      onClick={() => {
                        setValue('ownerEmail', client.email, { shouldValidate: true, shouldDirty: true });
                        setClientSuggestions([]);
                      }}
                    >
                      {client.firstName} {client.lastName} | {client.email}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountType">Tip racuna</Label>
                <select
                  id="accountType"
                  title="Tip racuna"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('accountType')}
                >
                  <option value="TEKUCI">Tekuci</option>
                  <option value="DEVIZNI">Devizni</option>
                  <option value="POSLOVNI">Poslovni</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountSubtype">Podvrsta racuna</Label>
                <select
                  id="accountSubtype"
                  title="Podvrsta racuna"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('accountSubtype')}
                >
                  {subtypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.accountSubtype && <p className="text-sm text-destructive">{errors.accountSubtype.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Valuta</Label>
                <select
                  id="currency"
                  title="Valuta"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('currency')}
                  disabled={accountType === 'TEKUCI'}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialDeposit">Inicijalni depozit</Label>
                <Input
                  id="initialDeposit"
                  type="number"
                  step="0.01"
                  {...register('initialDeposit', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                />
                {errors.initialDeposit && <p className="text-sm text-destructive">{errors.initialDeposit.message}</p>}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('createCard')} />
              Napravi karticu uz racun
            </label>

            {accountType === 'POSLOVNI' && (
              <div className="space-y-4 border rounded-md p-4">
                <h3 className="font-semibold">Podaci firme</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Naziv firme</Label>
                    <Input id="companyName" {...register('companyName')} />
                    {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Maticni broj</Label>
                    <Input id="registrationNumber" {...register('registrationNumber')} />
                    {errors.registrationNumber && <p className="text-sm text-destructive">{errors.registrationNumber.message}</p>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="taxId">PIB</Label>
                    <Input id="taxId" {...register('taxId')} />
                    {errors.taxId && <p className="text-sm text-destructive">{errors.taxId.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activityCode">Sifra delatnosti</Label>
                    <Input id="activityCode" {...register('activityCode')} placeholder="62.01" />
                    {errors.activityCode && <p className="text-sm text-destructive">{errors.activityCode.message}</p>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="firmAddress">Adresa firme</Label>
                    <Input id="firmAddress" {...register('firmAddress')} />
                    {errors.firmAddress && <p className="text-sm text-destructive">{errors.firmAddress.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmCity">Grad</Label>
                    <Input id="firmCity" {...register('firmCity')} />
                    {errors.firmCity && <p className="text-sm text-destructive">{errors.firmCity.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmCountry">Drzava</Label>
                    <Input id="firmCountry" {...register('firmCountry')} />
                    {errors.firmCountry && <p className="text-sm text-destructive">{errors.firmCountry.message}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">
                {isSubmitting ? 'Kreiranje...' : 'Kreiraj racun'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
