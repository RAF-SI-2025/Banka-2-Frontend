// FE2-09a/09b: Kursna lista i kalkulator konverzije

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Inbox, ArrowRightLeft, TrendingUp } from 'lucide-react';
import { toast } from '@/lib/notify';
import { currencyService } from '@/services/currencyService';
import { Currency, type ExchangeRate } from '@/types/celina2';
import { exchangeSchema, type ExchangeFormData } from '@/utils/validationSchemas.celina2';
import { asArray, formatAmount, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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

const currencyBorders: Record<string, string> = {
  RSD: 'border-l-blue-500',
  EUR: 'border-l-indigo-500',
  USD: 'border-l-green-500',
  CHF: 'border-l-red-500',
  GBP: 'border-l-purple-500',
  JPY: 'border-l-orange-500',
  CAD: 'border-l-rose-500',
  AUD: 'border-l-teal-500',
};

// 2-slovni ISO codes za prikaz u krugu (npr. "RS"). HomePage u kursnoj listi
// koristi pravi emoji flag (`CURRENCY_FLAGS` iz utils/currencyMaps), ovde nam
// trebaju samo cifre/slova jer dizajn ima monohromni krug-badge.
const currencyCodes: Record<string, string> = {
  RSD: 'RS', EUR: 'EU', USD: 'US', CHF: 'CH', GBP: 'GB', JPY: 'JP', CAD: 'CA', AUD: 'AU',
};

const currencyNames: Record<string, string> = {
  RSD: 'Srpski dinar',
  EUR: 'Evro',
  USD: 'Americki dolar',
  CHF: 'Svajcarski franak',
  GBP: 'Britanska funta',
  JPY: 'Japanski jen',
  CAD: 'Kanadski dolar',
  AUD: 'Australijski dolar',
};

const SUPPORTED_CURRENCIES = Object.values(Currency);



function normalizeExchangeRates(rates: ExchangeRate[]): ExchangeRate[] {
  const safeRates = asArray<ExchangeRate>(rates);

  const filteredRates = safeRates.filter((rate) =>
    (SUPPORTED_CURRENCIES as readonly string[]).includes(rate.currency),
  );

  // R1-553: ne odbacuj tiho nepoznate valute — surface schema drift. Ako BE
  // pocne da vraca valutu koju FE Currency enum ne poznaje, korisnik bi je
  // inace samo "nestao" iz tabele bez ikakvog traga. Logujemo upozorenje da
  // drift bude vidljiv (i da se Currency enum azurira).
  if (filteredRates.length !== safeRates.length) {
    const dropped = Array.from(
      new Set(
        safeRates
          .filter((rate) => !(SUPPORTED_CURRENCIES as readonly string[]).includes(rate.currency))
          .map((rate) => rate.currency),
      ),
    );
    if (dropped.length > 0) {
      console.warn(
        `[ExchangePage] Odbacene nepodrzane valute iz kursne liste (azuriraj Currency enum): ${dropped.join(', ')}`,
      );
    }
  }

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
        toast.error('Neuspesno ucitavanje kursne liste.');
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
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <RefreshCw className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menjacnica</h1>
          <p className="text-sm text-muted-foreground">Pregledajte kursnu listu i izvrsiti konverziju valuta.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: Exchange rate cards */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <h2 className="text-lg font-semibold">Kursna lista</h2>
            {rates.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                Azurirano: {formatDate(rates[0]?.date)}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : rates.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Inbox className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">Nema dostupnih kurseva</p>
                  <p className="text-sm text-muted-foreground mt-1">Pokusajte ponovo kasnije.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rates.map((rate) => (
                  <Card
                    key={rate.currency}
                    className={`rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${currencyBorders[rate.currency] || 'border-l-gray-500'}`}
                  >
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        {/* Currency icon */}
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted font-bold text-sm ${currencyColors[rate.currency] || ''}`}>
                          {currencyCodes[rate.currency] || rate.currency.slice(0, 2)}
                        </div>

                        {/* Currency info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-lg ${currencyColors[rate.currency] || ''}`}>{rate.currency}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">{currencyNames[rate.currency]}</span>
                          </div>
                          {/*
                            NAPOMENA: prethodno je ovde prikazivan "MiniSparkline" graf
                            generisan iz hash-a oznake valute (`generateSparkline`).
                            Tehnicki je to bila lazna kriva bez veze sa stvarnim
                            istorijskim kursevima — pa je uklonjeno po Luka direktivi
                            "Ne stavljaj lazne podatke". Kad BE doda /exchange/history
                            endpoint, vraticemo realnu sparkline iz pravih podataka.
                          */}
                        </div>

                        {/* Rates */}
                        <div className="grid grid-cols-3 gap-4 text-right shrink-0">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kupovni</p>
                            <p className="font-mono tabular-nums text-sm">{formatAmount(rate.buyRate, 4)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Srednji</p>
                            <p className="font-mono tabular-nums text-sm font-bold">{formatAmount(rate.middleRate, 4)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Prodajni</p>
                            <p className="font-mono tabular-nums text-sm">{formatAmount(rate.sellRate, 4)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>

        {/* Right: Conversion calculator */}
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border shadow-sm sticky top-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                  <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <CardTitle className="text-base">Kalkulator konverzije</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Amount input - large */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-xs text-muted-foreground uppercase tracking-wider">Iznos</Label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    className="w-full text-2xl font-bold font-mono text-center bg-transparent border-0 border-b-2 border-input focus:border-indigo-500 focus:outline-none transition-colors py-3"
                    {...register('amount', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.amount && <p className="text-sm text-destructive text-center">{errors.amount.message}</p>}
                </div>

                {/* From currency */}
                <div className="space-y-2">
                  <Label htmlFor="fromCurrency" className="text-xs text-muted-foreground uppercase tracking-wider">Iz valute</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <label
                        key={`from-${currency}`}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          fromCurrency === currency
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-sm'
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          value={currency}
                          {...register('fromCurrency')}
                          className="sr-only"
                        />
                        <span className={`text-xs font-bold ${fromCurrency === currency ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                          {currency}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Arrow separator */}
                <div className="flex items-center justify-center py-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                </div>

                {/* To currency */}
                <div className="space-y-2">
                  <Label htmlFor="toCurrency" className="text-xs text-muted-foreground uppercase tracking-wider">U valutu</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <label
                        key={`to-${currency}`}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          toCurrency === currency
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm'
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        } ${fromCurrency === currency ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        <input
                          type="radio"
                          value={currency}
                          {...register('toCurrency')}
                          className="sr-only"
                          disabled={fromCurrency === currency}
                        />
                        <span className={`text-xs font-bold ${toCurrency === currency ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                          {currency}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.toCurrency && (
                    <p className="text-sm text-destructive">{errors.toCurrency.message}</p>
                  )}
                  {fromCurrency === toCurrency && (
                    <p className="text-sm text-destructive text-center">
                      Izvorna i ciljna valuta ne mogu biti iste.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={fromCurrency === toCurrency}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.01] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:scale-100"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Konvertuj
                </Button>
              </form>

              {/* Result */}
              {result && (
                <div className="mt-6 rounded-2xl border-0 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white p-6 shadow-lg overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-600/10" />
                  <div className="relative space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Rezultat konverzije</p>
                    </div>
                    <p className="text-3xl font-bold font-mono tabular-nums">
                      {formatAmount(result.convertedAmount)}
                      <span className="text-lg text-slate-400 ml-2">{watch('toCurrency')}</span>
                    </p>
                    <div className="pt-2 border-t border-slate-700">
                      <p className="text-xs text-slate-400">
                        <span className="font-mono">{watch('amount')}</span> {watch('fromCurrency')} po kursu <span className="font-mono">{formatAmount(result.rate, 4)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
