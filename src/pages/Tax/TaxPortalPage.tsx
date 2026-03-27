import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Search, Wallet } from 'lucide-react';
import type { ExchangeRate } from '@/types/celina2';
import type { TaxRecord } from '@/types/celina3';
import taxService from '@/services/taxService';
import { currencyService } from '@/services/currencyService';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type UserTypeFilter = 'ALL' | 'CLIENT' | 'EMPLOYEE';

function formatAmount(value: number): string {
  return value.toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mapTypeLabel(userType: string): string {
  if (userType === 'CLIENT') {
    return 'Klijent';
  }

  if (userType === 'EMPLOYEE') {
    return 'Aktuar';
  }

  return userType;
}

export default function TaxPortalPage() {
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [userType, setUserType] = useState<UserTypeFilter>('ALL');
  const [runningCalculation, setRunningCalculation] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const loadRates = async () => {
      try {
        const rates = await currencyService.getExchangeRates();
        setExchangeRates(Array.isArray(rates) ? rates : []);
      } catch {
        setExchangeRates([]);
      }
    };

    void loadRates();
  }, []);

  const rateByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    map.set('RSD', 1);

    for (const rate of exchangeRates) {
      if (rate?.currency && Number.isFinite(rate.middleRate) && rate.middleRate > 0) {
        map.set(String(rate.currency), rate.middleRate);
      }
    }

    return map;
  }, [exchangeRates]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await taxService.getTaxRecords(
        userType === 'ALL' ? undefined : userType,
        search || undefined
      );
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setError('Greska pri ucitavanju poreskih podataka. Pokusajte ponovo.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [search, userType]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const mappedRecords = useMemo(() => {
    return records.map((record) => {
      const taxPaid = Number(record.taxPaid) || 0;
      const taxOwed = Number(record.taxOwed) || 0;
      const debtInOriginalCurrency = Math.max(taxOwed - taxPaid, 0);
      const currencyCode = String(record.currency || 'RSD');
      const conversionRate = rateByCurrency.get(currencyCode) ?? 1;
      const debtRsd = debtInOriginalCurrency * conversionRate;

      return {
        ...record,
        debtRsd,
      };
    });
  }, [rateByCurrency, records]);

  const handleTriggerCalculation = async () => {
    const confirmed = window.confirm(
      'Da li ste sigurni? Porez ce biti skinut sa racuna svih korisnika.'
    );

    if (!confirmed) {
      return;
    }

    setRunningCalculation(true);

    try {
      await taxService.triggerCalculation();
      toast.success('Obracun poreza je uspesno pokrenut.');
      await loadRecords();
    } catch {
      toast.error('Pokretanje obracuna nije uspelo.');
    } finally {
      setRunningCalculation(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pracenje poreza</h1>
            <p className="text-sm text-muted-foreground">
              Pregled poreskih obaveza klijenata i aktuara
            </p>
          </div>
        </div>
        <Button
          onClick={() => void handleTriggerCalculation()}
          disabled={runningCalculation || loading}
          className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20"
        >
          <Calculator className="mr-2 h-4 w-4" />
          Pokreni obracun
        </Button>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Filteri korisnika</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border p-1">
            <Button
              size="sm"
              variant={userType === 'ALL' ? 'default' : 'outline'}
              onClick={() => setUserType('ALL')}
            >
              Svi
            </Button>
            <Button
              size="sm"
              variant={userType === 'CLIENT' ? 'default' : 'outline'}
              onClick={() => setUserType('CLIENT')}
            >
              Klijenti
            </Button>
            <Button
              size="sm"
              variant={userType === 'EMPLOYEE' ? 'default' : 'outline'}
              onClick={() => setUserType('EMPLOYEE')}
            >
              Aktuari
            </Button>
          </div>

          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Pretraga po imenu"
              className="pl-9"
            />
          </div>

          <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>
            Osvezi
          </Button>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ime</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead className="text-right">Ukupan profit</TableHead>
              <TableHead className="text-right">Porez</TableHead>
              <TableHead className="text-right">Placeno</TableHead>
              <TableHead className="text-right">Dugovanje (RSD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`tax-skeleton-${index}`}>
                  {Array.from({ length: 6 }).map((__, colIndex) => (
                    <TableCell key={`tax-skeleton-col-${colIndex}`}>
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : mappedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-auto p-0">
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Wallet className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">Nema podataka za prikaz</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pokusajte da promenite filtere ili osvezite prikaz.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              mappedRecords.map((record) => (
                <TableRow key={record.userId}>
                  <TableCell className="font-medium">{record.userName}</TableCell>
                  <TableCell>
                    <Badge variant={record.userType === 'CLIENT' ? 'info' : 'warning'}>
                      {mapTypeLabel(record.userType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(Number(record.totalProfit) || 0)} {record.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(Number(record.taxOwed) || 0)} {record.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(Number(record.taxPaid) || 0)} {record.currency}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(record.debtRsd)} RSD
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
