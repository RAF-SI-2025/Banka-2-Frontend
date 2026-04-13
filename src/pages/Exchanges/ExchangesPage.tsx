import { useState, useEffect, Suspense, lazy } from 'react';
import { Globe, Building2, Table as TableIcon, Orbit } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import exchangeManagementService from '@/services/exchangeManagementService';
import type { Exchange } from '@/types/celina3';

// Lazy-load the 3D globe so Three.js (~500KB) is only pulled when user clicks the tab
const GlobeView = lazy(() => import('./GlobeView'));

export default function ExchangesPage() {
  const { isAdmin, isSupervisor } = useAuth();
  const canManage = isAdmin || isSupervisor;
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingAcronym, setTogglingAcronym] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'globe'>('table');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await exchangeManagementService.getAll();
        setExchanges(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setExchanges([]);
        } else {
          setError(true);
          toast.error('Neuspesno ucitavanje berzi.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleTestModeToggle = async (acronym: string, currentValue: boolean) => {
    setTogglingAcronym(acronym);
    try {
      await exchangeManagementService.setTestMode(acronym, !currentValue);
      // Re-fetch exchange data to get updated isOpen status from backend
      try {
        const updatedExchange = await exchangeManagementService.getByAcronym(acronym);
        setExchanges((prev) =>
          prev.map((e) =>
            e.acronym === acronym ? { ...e, ...updatedExchange, testMode: !currentValue } : e
          )
        );
      } catch {
        // Fallback: just update testMode and set open when test mode is on
        setExchanges((prev) =>
          prev.map((e) =>
            e.acronym === acronym
              ? {
                  ...e,
                  testMode: !currentValue,
                  currentlyOpen: !currentValue ? true : e.currentlyOpen,
                  isCurrentlyOpen: !currentValue ? true : e.isCurrentlyOpen,
                  isOpen: !currentValue ? true : e.isOpen,
                }
              : e
          )
        );
      }
      toast.success(`Test mod ${!currentValue ? 'ukljucen' : 'iskljucen'} za ${acronym}`);
    } catch {
      toast.error('Neuspesna promena test moda.');
    } finally {
      setTogglingAcronym(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with tab switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Berze</h1>
            <p className="text-sm text-muted-foreground">
              Pregled svetskih berzi i radnog vremena
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 p-1">
          <Button
            variant={activeTab === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('table')}
            className={activeTab === 'table' ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md hover:shadow-lg' : ''}
          >
            <TableIcon className="h-4 w-4 mr-2" />
            Tabela
          </Button>
          <Button
            variant={activeTab === 'globe' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('globe')}
            className={activeTab === 'globe' ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md hover:shadow-lg' : ''}
          >
            <Orbit className="h-4 w-4 mr-2" />
            3D Globus
          </Button>
        </div>
      </div>

      {/* 3D Globe tab */}
      {activeTab === 'globe' && exchanges.length > 0 && (
        <Suspense fallback={
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="relative mb-4">
                  <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                </div>
                <p className="font-semibold">Ucitavanje 3D globusa...</p>
                <p className="text-sm text-muted-foreground mt-1">Priprema Three.js biblioteke</p>
              </div>
            </CardContent>
          </Card>
        }>
          <GlobeView exchanges={exchanges} />
        </Suspense>
      )}

      {/* Table tab */}
      {activeTab === 'table' && (error || exchanges.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h2 className="text-lg font-semibold">Nema dostupnih berzi</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Podaci o berzama trenutno nisu dostupni
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              Svetske berze ({exchanges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naziv berze</TableHead>
                  <TableHead>Acronym</TableHead>
                  <TableHead>MIC Code</TableHead>
                  <TableHead>Drzava</TableHead>
                  <TableHead>Valuta</TableHead>
                  <TableHead>Radno vreme</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead>Test Mode</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchanges.map((exchange) => (
                  <TableRow key={exchange.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">{exchange.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {exchange.acronym}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {exchange.micCode}
                    </TableCell>
                    <TableCell>{exchange.country}</TableCell>
                    <TableCell>
                      <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-mono text-xs">
                        {exchange.currency}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {exchange.openTime} - {exchange.closeTime}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(exchange.currentlyOpen ?? exchange.isCurrentlyOpen ?? exchange.isOpen) ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Otvorena
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                            Zatvorena
                          </Badge>
                        )}
                        {exchange.testMode && (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                            TEST
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Switch
                          checked={exchange.testMode ?? false}
                          onCheckedChange={() =>
                            handleTestModeToggle(exchange.acronym, exchange.testMode ?? false)
                          }
                          disabled={togglingAcronym === exchange.acronym}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
