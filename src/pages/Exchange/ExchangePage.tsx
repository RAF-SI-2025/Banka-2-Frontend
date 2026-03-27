// FE2-09a/09b: Kursna lista i kalkulator konverzije

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Inbox } from 'lucide-react';
import { toast } from '@/lib/notify';
import { currencyService } from '@/services/currencyService';
import type { ExchangeRate } from '@/types/celina2';
import { exchangeSchema, type ExchangeFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const SUPPORTED_CURRENCIES = ['RSD', 'EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'] as const;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatAmount(value: number | null | undefined, decimals = 2): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('sr-RS');
}

function normalizeExchangeRates(rates: ExchangeRate[]): ExchangeRate[] {
  const safeRates = asArray<ExchangeRate>(rates);

  const filteredRates = safeRates.filter((rate) =>
    SUPPORTED_CURRENCIES.includes(rate.currency as (typeof SUPPORTED_CURRENCIES)[number])
  );

  const hasRsd = filteredRates.some((rate) => rate.currency === 'RSD');
  const fallbackDate = filteredRates[0]?.date ?? new Date().toISOString();

  const ratesWithBase = hasRsd
    ? filteredRates
    : [
        {
          currency: 'RSD',
          buyRate: 1,
          sellRate: 1,
          middleRate: 1,
          date: fallbackDate,
        } as ExchangeRate,
        ...filteredRates,
      ];

  return SUPPORTED_CURRENCIES.map((currency) =>
    ratesWithBase.find((rate) => rate.currency === currency)
  ).filter((rate): rate is ExchangeRate => Boolean(rate));
}

export default function ExchangePage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ convertedAmount: number; rate: number } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeSchema),
    defaultValues: {
      fromCurrency: 'EUR',
      toCurrency: 'RSD',
      amount: 0,
    },
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const exchangeRates = await currencyService.getExchangeRates();
        const safeRates = normalizeExchangeRates(asArray<ExchangeRate>(exchangeRates));
        setRates(safeRates);
      } catch {
        toast.error('Neuspešno učitavanje kursne liste.');
        setRates([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const fromCurrency = watch('fromCurrency');
  const toCurrency = watch('toCurrency');
  const amount = watch('amount');

  useEffect(() => {
    setResult(null);
  }, [fromCurrency, toCurrency, amount]);

  const onSubmit = async (data: ExchangeFormData) => {
    if (data.fromCurrency === data.toCurrency) {
      toast.error('Valute moraju biti razlicite.');
      setResult(null);
      return;
    }

    try {
      const conversion = await currencyService.convert({
        fromCurrency: data.fromCurrency as never,
        toCurrency: data.toCurrency as never,
        amount: data.amount,
      });
      setResult({ convertedAmount: conversion.convertedAmount, rate: conversion.exchangeRate });
    } catch {
      toast.error('Konverzija nije uspela.');
      setResult(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Menjacnica</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Pregledajte kursnu listu i izvrsiti konverziju valuta.</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Kursna lista</h2>
        {loading ? (
          <Card>
            <CardContent className="pt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Valuta</th>
                    <th className="text-left py-2">Kupovni kurs</th>
                    <th className="text-left py-2">Prodajni kurs</th>
                    <th className="text-left py-2">Srednji kurs</th>
                    <th className="text-left py-2">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length > 0 ? (
                    rates.map((rate) => (
                      <tr key={rate.currency} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2">{rate.currency}</td>
                        <td className="py-2">{formatAmount(rate.buyRate, 4)}</td>
                        <td className="py-2">{formatAmount(rate.sellRate, 4)}</td>
                        <td className="py-2">{formatAmount(rate.middleRate, 4)}</td>
                        <td className="py-2">{formatDate(rate.date)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="rounded-full bg-muted p-3 mb-3">
                            <Inbox className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="font-medium text-muted-foreground">Nema dostupnih kurseva</p>
                          <p className="text-sm text-muted-foreground mt-1">Pokusajte ponovo kasnije.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Konverzija</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="fromCurrency">Iz valute</Label>
                <select
                  id="fromCurrency"
                  title="Iz valute"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('fromCurrency')}
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toCurrency">U valutu</Label>
                <select
                  id="toCurrency"
                  title="U valutu"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('toCurrency')}
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                {errors.toCurrency && (
                  <p className="text-sm text-destructive">{errors.toCurrency.message}</p>
                )}
                {fromCurrency === toCurrency && (
                  <p className="text-sm text-destructive">
                    Izvorna i ciljna valuta ne mogu biti iste.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Iznos</Label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>

              {/* Polje za racun uklonjeno - menjacnica je samo informativna */}

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">Konvertuj</Button>
              </div>
            </form>

            {result && (
              <div className="mt-4 rounded-md border p-3 text-sm">
                <p>
                  {watch('amount')} {watch('fromCurrency')} = {formatAmount(result.convertedAmount)}{' '}
                  {watch('toCurrency')} po kursu {formatAmount(result.rate, 4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
