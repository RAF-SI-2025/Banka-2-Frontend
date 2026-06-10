import { Fragment, useEffect, useMemo, useState } from 'react';
import { ScrollText, Zap } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import otcService from '@/services/otcService';
import { accountService } from '@/services/accountService';
import type { OtcContract, OtcContractStatus } from '@/types/celina3';
import type { Account } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { asArray, formatAmount, getErrorMessage, getPreferredAccount } from '@/utils/formatters';
import { OTC_CONTRACT_STATUS_LABELS as CONTRACT_STATUS_LABEL } from '@/utils/otcLabels';
import OtcSourceFilterChip, { type OtcSource } from '@/components/otc/OtcSourceFilterChip';
import OtcSubHero from '@/components/otc/OtcSubHero';
import OtcInterBankContractsTab from './OtcInterBankContractsTab';
import { createIsMeMatcher } from './otcUtils';

// T4A-020 fix: ujednacavanje naziva izmedju filter dropdown-a i statusnih badge-ova.
// Pre fix-a filter je koristio engleske enum vrednosti, dok su badge-ovi prikazivali
// srpske labele iz OTC_CONTRACT_STATUS_LABELS. Sad oba koriste isti map.
const STATUS_LABELS = CONTRACT_STATUS_LABEL;

const STATUS_OPTIONS: Array<{ value: OtcContractStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Svi' },
  { value: 'ACTIVE', label: STATUS_LABELS.ACTIVE },
  { value: 'EXERCISED', label: STATUS_LABELS.EXERCISED },
  { value: 'EXPIRED', label: STATUS_LABELS.EXPIRED },
];

const statusBadgeVariant = (status: string): 'success' | 'secondary' | 'destructive' | 'warning' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ACCEPTED' || status === 'EXERCISED') return 'secondary';
  if (status === 'EXPIRED') return 'warning';
  return 'destructive';
};

/**
 * R1 481: intra "Iskoristi" mora postovati `settlementDate >= today` (paritet sa
 * inter-bank tabom). Opcija se moze iskoristiti na dan dospeca ili pre — ne posle.
 * Prazan/nevalidan datum tretiramo kao nedostizan (fail-closed). Bez ove provere
 * BE vraca 409 (settlement prosao) tek posle klika.
 */
function canExerciseBySettlement(settlementDate?: string | null): boolean {
  if (!settlementDate) return false;
  const date = new Date(`${settlementDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

export default function OtcContractsPage() {
  const { user, isAdmin, isAgent, isSupervisor } = useAuth();
  const isEmployee = isAdmin || isAgent || isSupervisor;
  // FIX FE-OTC-03: shared helper (createIsMeMatcher) izmestamo u otcUtils.ts
  // da OtcNegotiationsPage moze da koristi isti pattern. Klijent JWT cesto
  // nema pouzdan id pa se uz id-poredjenje radi i normalizovano ime.
  const isMe = useMemo(() => createIsMeMatcher(user), [user]);
  const [source, setSource] = useState<OtcSource>('all');
  const [statusFilter, setStatusFilter] = useState<OtcContractStatus | 'ALL'>('ALL');
  const [contracts, setContracts] = useState<OtcContract[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyContractId, setBusyContractId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await otcService.listMyContracts(statusFilter);
        if (!cancelled) setContracts(data ?? []);
      } catch {
        if (!cancelled) setContracts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const list = isEmployee
          ? asArray<Account>(await accountService.getBankAccounts())
          : asArray<Account>(await accountService.getMyAccounts());
        if (!cancelled) setAccounts(list.filter((a) => a.status === 'ACTIVE'));
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [statusFilter, isEmployee]);

  // FE-OTC-06 fix: identity useMemo `useMemo(() => contracts, [contracts])` uklonjen kao dead code.

  const handleExercise = async (contract: OtcContract) => {
    // R1 481: ne dozvoli exercise kad je settlement prosao (BE bi vratio 409).
    if (!canExerciseBySettlement(contract.settlementDate)) {
      toast.error('Datum poravnanja je prosao — ugovor se vise ne moze iskoristiti.');
      return;
    }
    if (!window.confirm(`Iskoristiti ugovor za ${contract.quantity} x ${contract.listingTicker}?`)) return;
    const buyerAccount = getPreferredAccount(accounts, contract.listingCurrency);
    if (!buyerAccount) { toast.error('Nemate aktivan racun za placanje strike cene.'); return; }
    setBusyContractId(contract.id);
    try {
      // P0-F1/N1 fix: exercise ide kroz Model-B SAGA orkestrator koji vraca HTTP 200
      // I za uspeh (COMPLETED/EXERCISED) I za rollback (COMPENSATED/ACTIVE). Ranije smo
      // bezuslovno prikazivali success toast na 200 -> lazni uspeh: korisnik je mislio
      // da je opcija iskoriscena dok je SAGA u stvari rollback-ovala. Sad citamo
      // terminalni ishod (`sagaStatus`/`status` iz OtcExerciseResultDto) PRE poruke.
      const result = await otcService.exerciseContract(contract.id, buyerAccount.id);
      const sagaStatus = (result?.sagaStatus ?? '').toUpperCase();
      const contractStatus = (result?.status ?? '').toUpperCase();
      const exerciseSucceeded =
        sagaStatus === 'COMPLETED' && contractStatus === 'EXERCISED';

      // T4A-002 fix: posle exercise strike cena je skinuta sa kupcevog racuna,
      // akcije prebacene u portfolio. Refresh oba (contracts + accounts) da UI prikaze novo stanje.
      // Refresh radimo u svakom slucaju — i na rollback se status ugovora moze promeniti
      // (npr. ostaje ACTIVE), a stanje racuna treba da odrazi stvarnost iz baze.
      const [data, refreshedAccounts] = await Promise.all([
        otcService.listMyContracts(statusFilter),
        isEmployee
          ? accountService.getBankAccounts()
          : accountService.getMyAccounts(),
      ]);
      setContracts(data ?? []);
      setAccounts(asArray<Account>(refreshedAccounts).filter((a) => a.status === 'ACTIVE'));

      if (exerciseSucceeded) {
        toast.success('Opcioni ugovor je iskoriscen — akcije su prebacene, strike cena skinuta sa racuna.');
      } else {
        // SAGA je rollback-ovala (COMPENSATED) ili ugovor nije presao u EXERCISED.
        // Novac/akcije su vraceni na pocetno stanje — NE prikazuj success.
        toast.error(
          'Iskoriscavanje nije uspelo — transakcija je ponistena (rollback). ' +
          'Sredstva i akcije su vraceni na pocetno stanje. Pokusajte ponovo.',
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Iskoriscavanje nije uspelo.'));
    } finally {
      setBusyContractId(null);
    }
  };

  /**
   * Odustajanje od opcije — kupac priznaje da nece iskoristiti ugovor.
   * Premija je vec placena pri accept-u i NE VRACA SE (to je cena opcije po spec-u
   * Celina 4 — kupljeno je PRAVO ne obaveza). Ugovor → EXPIRED, prodavcev
   * publicQuantity se automatski oslobadja.
   */
  const handleAbandon = async (contract: OtcContract) => {
    const premiumLabel = `${contract.premium ?? 0} ${contract.listingCurrency}`;
    if (
      !window.confirm(
        `Odustani od ugovora za ${contract.quantity} x ${contract.listingTicker}?\n\n` +
        `VAZNO: premija koju ste platili prodavcu (${premiumLabel}) se NE VRACA — ` +
        `to je cena opcionog ugovora. Nazad dobijate samo slobodu da ne kupite akcije.`,
      )
    ) return;
    setBusyContractId(contract.id);
    try {
      await otcService.abandonContract(contract.id);
      toast.success('Odustali ste od ugovora. Premija ostaje kod prodavca.');
      const data = await otcService.listMyContracts(statusFilter);
      setContracts(data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Odustajanje nije uspelo.'));
    } finally {
      setBusyContractId(null);
    }
  };

  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const exercisedCount = contracts.filter((c) => c.status === 'EXERCISED').length;
  const expiredCount = contracts.filter((c) => c.status === 'EXPIRED').length;
  const itmCount = contracts.filter(
    (c) => c.status === 'ACTIVE' && isMe(c.buyerId, c.buyerName) && c.currentPrice != null && c.currentPrice > c.strikePrice,
  ).length;

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      <OtcSubHero
        icon={ScrollText}
        title="Sklopljeni ugovori"
        description="Opcioni ugovori iz prihvacenih ponuda. Kupac moze iskoristiti pre settlement datuma."
        gradientFrom="from-amber-500"
        gradientTo="to-orange-600"
        kpis={source === 'inter' ? undefined : [
          { label: STATUS_LABELS.ACTIVE, value: String(activeCount), tone: activeCount > 0 ? 'success' : 'default' },
          { label: 'ITM kao kupac', value: String(itmCount), tone: itmCount > 0 ? 'warning' : 'default' },
          { label: STATUS_LABELS.EXERCISED, value: String(exercisedCount) },
          { label: STATUS_LABELS.EXPIRED, value: String(expiredCount) },
        ]}
      />

      <div className="space-y-2">
        <OtcSourceFilterChip value={source} onChange={setSource} />
        <div className="flex flex-wrap gap-2">
          {/* Filter chip pattern (kao OtcSourceFilterChip/BranchFilters): toggle
              Button + aria-pressed. NE role="tab" — izolovan tab bez tablist
              roditelja je ARIA violation, a chip filtrira sadrzaj, ne menja panel. */}
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              aria-pressed={statusFilter === opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={
                statusFilter === opt.value
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                  : ''
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {source === 'inter' ? (
        // FIX 3/4: gornji jedinstveni status bar upravlja i inter tabom (kontrolisan
        // prop). Inter tab vise nema sopstveni interni filter bar (uklonjen duplikat).
        <OtcInterBankContractsTab statusFilter={statusFilter} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Moji ugovori (intra-bank)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Kako rade opcioni ugovori:</strong> kad prihvati pregovor, kupac <em>placa premiju</em>{' '}
              prodavcu odmah — to je cena <strong>prava da kupi</strong>. Klikom na <strong>Iskoristi</strong>{' '}
              kupac placa strike × kolicina i dobija akcije. Ako <strong>odustane</strong> ili pusti settlement
              da prodje, premija ostaje kod prodavca (vec je placena) — to je standardna option mehanika.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : contracts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nemate sklopljene OTC ugovore.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hartija</TableHead>
                    <TableHead>Kupac / Prodavac</TableHead>
                    <TableHead>Kolicina</TableHead>
                    <TableHead>Strike</TableHead>
                    <TableHead>Premija</TableHead>
                    <TableHead>Trenutna cena</TableHead>
                    <TableHead>Dospece</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcija</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => {
                    const inTheMoney =
                      c.currentPrice != null && c.strikePrice != null && c.currentPrice > c.strikePrice;
                    return (
                      <Fragment key={c.id}>
                        <TableRow>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold">{c.listingTicker}</span>
                              <span className="text-xs text-muted-foreground">{c.listingName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span>Kupac: {c.buyerName}</span>
                                {isMe(c.buyerId, c.buyerName) && (
                                  <Badge variant="info" className="text-[10px] px-1 py-0 h-4">VI</Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground flex items-center gap-1.5">
                                <span>Prodavac: {c.sellerName}</span>
                                {isMe(c.sellerId, c.sellerName) && (
                                  <Badge variant="info" className="text-[10px] px-1 py-0 h-4">VI</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{c.quantity}</TableCell>
                          <TableCell className="font-mono">{formatAmount(c.strikePrice)} {c.listingCurrency}</TableCell>
                          <TableCell className="font-mono">{formatAmount(c.premium)} {c.listingCurrency}</TableCell>
                          <TableCell className="font-mono">
                            {c.currentPrice != null ? (
                              <span className={inTheMoney ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                {formatAmount(c.currentPrice)} {c.listingCurrency}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{c.settlementDate}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(c.status)}>
                              {CONTRACT_STATUS_LABEL[c.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.status === 'ACTIVE' && isMe(c.buyerId, c.buyerName) ? (
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  disabled={busyContractId === c.id || !canExerciseBySettlement(c.settlementDate)}
                                  onClick={() => handleExercise(c)}
                                  title={
                                    canExerciseBySettlement(c.settlementDate)
                                      ? undefined
                                      : 'Datum poravnanja je prosao — ugovor se vise ne moze iskoristiti.'
                                  }
                                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                                >
                                  <Zap className="h-3.5 w-3.5 mr-1" />
                                  {busyContractId === c.id ? '...' : 'Iskoristi'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyContractId === c.id}
                                  onClick={() => handleAbandon(c)}
                                  title="Premija se NE vraca. Samo zatvara ugovor pre settlementa."
                                  data-testid={`otc-abandon-${c.id}`}
                                >
                                  Odustani
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
