// FE2-09a/09b: Kursna lista i kalkulator konverzije

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Inbox, ArrowRightLeft } from 'lucide-react';
import { toast } from '@/lib/notify';
import { currencyService } from '@/services/currencyService';
import type { ExchangeRate } from '@/types/celina2';
import { exchangeSchema, type ExchangeFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const currencyColors: Record<string, string> = {
  RSD: 'text-blue-600 dark:text-blue-400',
  EUR: 'text-indigo-600 dark:text-indigo-400',
  USD: 'text-green-600 dark:text-green-400',
  CHF: 'text-red-600 dark:text-red-400',
  GBP: 'text-purple-600 dark:text-purple-400',
  JPY: 'text-orange-600 dark:text-orange-400',
  CAD: 'text-rose-600 dark:text-rose-400',
  AUD: 'text-teal-600 dark:text-teal-400',
};

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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menjacnica</h1>
          <p className="text-sm text-muted-foreground">Pregledajte kursnu listu i izvrsiti konverziju valuta.</p>
        </div>
      </div>

      <section>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <CardTitle>Kursna lista</CardTitle>
            </div>
          </CardHeader>
        {loading ? (
          <CardContent className="space-y-3">
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
        ) : rates.length === 0 ? (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Nema dostupnih kurseva</p>
              <p className="text-sm text-muted-foreground mt-1">Pokusajte ponovo kasnije.</p>
            </div>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valuta</TableHead>
                <TableHead className="text-right">Kupovni kurs</TableHead>
                <TableHead className="text-right">Prodajni kurs</TableHead>
                <TableHead className="text-right">Srednji kurs</TableHead>
                <TableHead className="text-right">Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.currency} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-muted font-bold text-xs ${currencyColors[rate.currency] || ''}`}>
                        {rate.currency.slice(0, 2)}
                      </div>
                      <span className={`font-semibold ${currencyColors[rate.currency] || ''}`}>{rate.currency}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(rate.buyRate, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(rate.sellRate, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatAmount(rate.middleRate, 4)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(rate.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </Card>
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>

              {/* Polje za racun uklonjeno - menjacnica je samo informativna */}

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Konvertuj
                </Button>
              </div>
            </form>

            {result && (
              <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                    <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="font-semibold text-sm">Rezultat konverzije</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatAmount(result.convertedAmount)} {watch('toCurrency')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {watch('amount')} {watch('fromCurrency')} po kursu {formatAmount(result.rate, 4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
