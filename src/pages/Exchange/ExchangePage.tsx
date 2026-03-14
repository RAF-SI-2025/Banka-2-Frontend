
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import type { Account, ExchangeRate } from '@/types/celina2';
import { exchangeSchema, type ExchangeFormData } from '@/utils/validationSchemas.celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('sr-RS');
}

export default function ExchangePage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ convertedAmount: number; rate: number } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeSchema),
    defaultValues: {
      fromCurrency: 'EUR',
      toCurrency: 'RSD',
      amount: 0,
      accountNumber: '',
    },
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [exchangeRates, myAccounts] = await Promise.all([
          currencyService.getExchangeRates(),
          accountService.getMyAccounts(),
        ]);
        const safeRates = asArray<ExchangeRate>(exchangeRates);
        const safeAccounts = asArray<Account>(myAccounts);
        setRates(safeRates);
        setAccounts(safeAccounts);
        if (safeAccounts.length > 0) {
          setValue('accountNumber', safeAccounts[0].accountNumber);
        }
      } catch {
        toast.error('Neuspešno učitavanje kursne liste.');
        setRates([]);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setValue]);

  const fromCurrency = watch('fromCurrency');
  const toCurrency = watch('toCurrency');
  const amount = watch('amount');
  const accountNumber = watch('accountNumber');

  const safeAccounts = useMemo(() => asArray<Account>(accounts), [accounts]);
  const eligibleAccounts = useMemo(
    () => safeAccounts.filter((account) => account.currency === fromCurrency),
    [safeAccounts, fromCurrency]
  );

  useEffect(() => {
    if (eligibleAccounts.length > 0) {
      setValue('accountNumber', eligibleAccounts[0].accountNumber);
    } else {
      setValue('accountNumber', '');
    }
  }, [eligibleAccounts, setValue]);

  useEffect(() => {
    setResult(null);
  }, [fromCurrency, toCurrency, amount, accountNumber]);

  const onSubmit = async (data: ExchangeFormData) => {
    if (data.fromCurrency === data.toCurrency) {
      toast.error('Izaberite različite valute za konverziju.');
      setResult(null);
      return;
    }

    try {
      const conversion = await currencyService.convert({
        fromCurrency: data.fromCurrency as never,
        toCurrency: data.toCurrency as never,
        amount: data.amount,
        accountNumber: data.accountNumber,
      });
      setResult(conversion);
    } catch {
      toast.error('Konverzija nije uspela.');
      setResult(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Menjačnica</h1>

      <section>
        <h2 className="text-xl font-semibold mb-4">Kursna lista</h2>
        {loading ? (
          <p className="text-muted-foreground">Učitavanje kursne liste...</p>
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
                  {asArray<ExchangeRate>(rates).map((rate) => (
                    <tr key={rate.currency} className="border-b">
                      <td className="py-2">{rate.currency}</td>
                      <td className="py-2">{formatAmount(rate.buyRate, 4)}</td>
                      <td className="py-2">{formatAmount(rate.sellRate, 4)}</td>
                      <td className="py-2">{formatAmount(rate.middleRate, 4)}</td>
                      <td className="py-2">{formatDate(rate.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Konverzija</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="fromCurrency">Iz valute</Label>
                <select id="fromCurrency" title="Iz valute" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('fromCurrency')}>
                  {['RSD', 'EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'].map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="toCurrency">U valutu</Label>
                <select id="toCurrency" title="U valutu" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('toCurrency')}>
                  {['RSD', 'EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'].map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
                {errors.toCurrency && <p className="text-sm text-destructive">{errors.toCurrency.message}</p>}
                {fromCurrency === toCurrency && (
                  <p className="text-sm text-destructive">
                    Izvorna i ciljna valuta ne mogu biti iste.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Iznos</Label>
                <input id="amount" type="number" step="0.01" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Račun</Label>
                <select id="accountNumber" title="Račun" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('accountNumber')}>
                  <option value="">Izaberite račun</option>
                  {eligibleAccounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>{account.accountNumber} ({account.currency})</option>
                  ))}
                </select>
                {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Konvertuj</Button>
              </div>
            </form>

            {result && (
              <div className="mt-4 rounded-md border p-3 text-sm">
                <p>
                  {watch('amount')} {watch('fromCurrency')} = {formatAmount(result.convertedAmount)} {watch('toCurrency')} po kursu {formatAmount(result.rate, 4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
