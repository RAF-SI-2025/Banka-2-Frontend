import { useEffect, useState, useMemo } from 'react';
import { Percent, Edit, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from '@/lib/notify';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import { savingsService } from '@/services/savingsService';
import { type SavingsRateDto, TERM_OPTIONS } from '@/types/savings';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface EditState {
  currencyCode: string;
  termMonths: number;
  annualRate: number;
}

export default function AdminSavingsRatesPage() {
  const [rates, setRates] = useState<SavingsRateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newRate, setNewRate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await savingsService.adminListAllRates();
      setRates(all);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Neuspeh ucitavanja stopa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeRates = useMemo(() => rates.filter(r => r.active), [rates]);
  const historyRates = useMemo(() => rates.filter(r => !r.active).sort((a, b) =>
    new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
  ), [rates]);

  const byCurrency = useMemo(() => {
    const map = new Map<string, Map<number, SavingsRateDto>>();
    for (const r of activeRates) {
      if (!map.has(r.currencyCode)) map.set(r.currencyCode, new Map());
      map.get(r.currencyCode)!.set(r.termMonths, r);
    }
    return map;
  }, [activeRates]);

  const handleSave = async () => {
    if (!editing) return;
    const rate = Number(newRate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 50) {
      toast.error('Stopa mora biti izmedju 0 i 50%');
      return;
    }
    setSaving(true);
    try {
      await savingsService.adminUpsertRate({
        currencyCode: editing.currencyCode,
        termMonths: editing.termMonths,
        annualRate: rate,
      });
      toast.success(`Stopa azurirana: ${editing.currencyCode} ${editing.termMonths}m → ${rate}%`);
      setEditing(null);
      setNewRate('');
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Azuriranje stope nije uspelo');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (currencyCode: string, termMonths: number, currentRate: number) => {
    setEditing({ currencyCode, termMonths, annualRate: currentRate });
    setNewRate(String(currentRate));
  };

  const closeDialog = () => {
    setEditing(null);
    setNewRate('');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        icon={<Percent />}
        title="Kamatne stope stednje"
        description="Upravljanje vazecim stopama za sve valute i rokove"
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Ucitavanje...</div>
      ) : (
        <>
          <Card className="p-4 mb-6 overflow-x-auto">
            <h3 className="text-lg font-semibold mb-4">Vazece stope</h3>
            {byCurrency.size === 0 ? (
              <p className="text-muted-foreground text-sm">Nema definisanih stopa.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valuta</TableHead>
                    {TERM_OPTIONS.map(t => (
                      <TableHead key={t} className="text-center">{t} meseci</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(byCurrency.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([code, termMap]) => (
                    <TableRow key={code}>
                      <TableCell className="font-medium">{code}</TableCell>
                      {TERM_OPTIONS.map(t => {
                        const r = termMap.get(t);
                        return (
                          <TableCell key={t} className="text-center" data-testid={`rate-${code}-${t}`}>
                            {r ? (
                              <button
                                onClick={() => openEdit(code, t, r.annualRate)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
                                data-testid={`edit-rate-${code}-${t}`}
                              >
                                <span className="tabular-nums">{r.annualRate}%</span>
                                <Edit className="w-3 h-3 opacity-50" />
                              </button>
                            ) : (
                              // R1-358: prazna celija je sada klikabilna — otvara isti
                              // upsert dijalog sa pocetnom stopom 0 da admin moze
                              // DEFINISATI stopu za (valuta, rok) kombinaciju koja jos
                              // ne postoji (pre fix-a "-" je bio mrtav, bez nacina dodavanja).
                              <button
                                type="button"
                                onClick={() => openEdit(code, t, 0)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                data-testid={`add-rate-${code}-${t}`}
                                title="Dodaj stopu"
                              >
                                <span>-</span>
                                <Edit className="w-3 h-3 opacity-50" />
                              </button>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Istorija promena</h3>
            {historyRates.length === 0 ? (
              <p className="text-muted-foreground text-sm">Jos nema deaktiviranih stopa.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valuta</TableHead>
                    <TableHead className="text-center">Rok</TableHead>
                    <TableHead className="text-center">Stopa</TableHead>
                    <TableHead>Vazila od</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRates.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.currencyCode}</TableCell>
                      <TableCell className="text-center">{r.termMonths}m</TableCell>
                      <TableCell className="text-center tabular-nums">{r.annualRate}%</TableCell>
                      <TableCell>{new Date(r.effectiveFrom).toLocaleDateString('sr-RS')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      <Dialog.Root open={!!editing} onOpenChange={open => !open && closeDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between p-6 pb-4">
              <Dialog.Title className="text-lg font-semibold">
                Azuriraj stopu: {editing?.currencyCode} {editing?.termMonths} meseci
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="px-6 pb-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                Trenutna stopa: <span className="font-medium">{editing?.annualRate}% p.a.</span>
              </p>
              <div>
                <Label htmlFor="new-rate">Nova godisnja stopa (%)</Label>
                <Input
                  id="new-rate"
                  type="number"
                  step="0.01"
                  value={newRate}
                  onChange={e => setNewRate(e.target.value)}
                  data-testid="new-rate-input"
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Stara stopa ce biti deaktivirana, postojeci depoziti zadrzavaju svoju originalnu stopu.
                Nova stopa vazi za nove depozite i auto-obnove.
              </p>
            </div>

            <div className="flex justify-end gap-2 p-6 pt-4">
              <Button variant="outline" onClick={closeDialog} disabled={saving}>
                Odustani
              </Button>
              <Button onClick={handleSave} data-testid="save-rate" disabled={saving}>
                {saving ? 'Cuvanje...' : 'Sacuvaj'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
