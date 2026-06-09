import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Handshake, Search, ScrollText, Upload, Activity, Clock, TrendingUp,
  TrendingDown, AlertTriangle, ChevronRight, Sparkles, Wallet,
  ArrowDownRight, ArrowUpRight, Flame, Timer, Building2, FileSignature,
} from 'lucide-react';
import otcService from '@/services/otcService';
import interbankOtcService from '@/services/interbankOtcService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import OtcHubCard from '@/components/otc/OtcHubCard';
import { useAuth } from '@/context/AuthContext';
import { formatAmount, formatDate } from '@/utils/formatters';
import { createIsMeMatcher } from '@/pages/Otc/otcUtils';
import type { OtcContract, OtcListing, OtcOffer } from '@/types/celina3';

interface InterContract {
  foreignId?: string;
  status: string;
  settlementDate?: string;
  strikePrice?: number;
  premium?: number;
  quantity?: number;
  buyerId?: number;
  sellerId?: number;
  // Inter-bank contract polja koja BE vraca i koja koristimo za KPI agregaciju.
  // Inter-bank user-i nemaju nas numericki id, pa isMe matcher radi i preko
  // imena (buyerName/sellerName).
  listingCurrency?: string;
  buyerName?: string;
  sellerName?: string;
  currentPrice?: number;
  listingTicker?: string;
}
interface InterOffer { foreignId?: string; status: string; myTurn?: boolean; lastModifiedAt?: string; listingTicker?: string; }

interface HubData {
  loading: boolean;
  // Discovery
  listingsAll: OtcListing[];
  interListings: OtcListing[];
  // Offers
  localOffers: OtcOffer[];
  interOffers: InterOffer[];
  // Contracts
  localContracts: OtcContract[];
  interContracts: InterContract[];
  // My public
  myPublic: OtcListing[];
}

const INITIAL: HubData = {
  loading: true,
  listingsAll: [],
  interListings: [],
  localOffers: [],
  interOffers: [],
  localContracts: [],
  interContracts: [],
  myPublic: [],
};

interface ActivityItem {
  id: string;
  kind: 'offer' | 'contract' | 'exercise';
  title: string;
  subtitle: string;
  amount: string;
  timestamp: string;
  badgeVariant: 'success' | 'warning' | 'info' | 'destructive' | 'secondary';
  badgeLabel: string;
  onClick: () => void;
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function OtcHubPage() {
  const navigate = useNavigate();
  const { user, isSupervisor } = useAuth();
  const [data, setData] = useState<HubData>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    const safe = async <T,>(fn: () => Promise<T>, fb: T): Promise<T> => {
      try { return await fn(); } catch { return fb; }
    };
    (async () => {
      const [
        listings, interListings, localOffers, interOffers,
        localContracts, interContracts, myPublic,
      ] = await Promise.all([
        safe(() => otcService.listDiscovery(), [] as OtcListing[]),
        safe(() => interbankOtcService.listRemoteListings() as unknown as Promise<OtcListing[]>, [] as OtcListing[]),
        safe(() => otcService.listMyActiveOffers(), [] as OtcOffer[]),
        safe(() => interbankOtcService.listMyOffers() as Promise<InterOffer[]>, [] as InterOffer[]),
        safe(() => otcService.listMyContracts('ALL'), [] as OtcContract[]),
        safe(() => interbankOtcService.listMyContracts() as Promise<InterContract[]>, [] as InterContract[]),
        safe(() => otcService.listMyPublicListings(), [] as OtcListing[]),
      ]);
      if (cancelled) return;
      setData({
        loading: false,
        listingsAll: listings,
        interListings,
        localOffers,
        interOffers,
        localContracts,
        interContracts,
        myPublic,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // KPI calculations
  const kpi = useMemo(() => {
    // R1 568: identitet razresavamo preko deljenog fail-closed matchera
    // (userId>0 && userId===partyId) umesto sirovog `buyerId === myId`.
    const isMe = createIsMeMatcher(user);

    // FIX: brojaci ugovora moraju ukljuciti I lokalne I inter-bank ugovore.
    // Pravi aktivni inter-bank ugovor je ranije bio ignorisan ("AKTIVNIH UGOVORA"=0).
    const localActive = data.localContracts.filter(c => c.status === 'ACTIVE');
    const localExercised = data.localContracts.filter(c => c.status === 'EXERCISED');
    const localExpired = data.localContracts.filter(c => c.status === 'EXPIRED');
    const interActive = data.interContracts.filter(c => c.status === 'ACTIVE');
    const interExercised = data.interContracts.filter(c => c.status === 'EXERCISED');
    const interExpired = data.interContracts.filter(c => c.status === 'EXPIRED');

    const activeContracts = localActive; // intra-only — koristi se za ITM/expiring (potrebna lokalna polja)

    const currencyOf = (c: OtcContract): string => c.listingCurrency || 'RSD';

    // R1 567: premija i notional se NE smeju sabirati preko razlicitih valuta
    // bez konverzije. Grupisemo po valuti (Record<valuta, iznos>); UI prikazuje
    // dominantnu valutu kao glavni broj + breakdown ako ima vise valuta.
    const premiumPaidByCcy: Record<string, number> = {};
    const premiumReceivedByCcy: Record<string, number> = {};
    data.localContracts.forEach(c => {
      const ccy = currencyOf(c);
      if (isMe(c.buyerId, c.buyerName)) {
        premiumPaidByCcy[ccy] = (premiumPaidByCcy[ccy] ?? 0) + (c.premium ?? 0);
      }
      if (isMe(c.sellerId, c.sellerName)) {
        premiumReceivedByCcy[ccy] = (premiumReceivedByCcy[ccy] ?? 0) + (c.premium ?? 0);
      }
    });
    // Inter-bank doprinos premiji — samo gde polja stvarno postoje (fail-safe na 'RSD'/0).
    // Inter-bank user-i nemaju nas numericki id, pa isMe radi preko imena (fallback id -1
    // nikad ne matchuje pozitivan userId).
    data.interContracts.forEach(c => {
      if (c.premium == null) return;
      const ccy = c.listingCurrency || 'RSD';
      if (isMe(c.buyerId ?? -1, c.buyerName)) {
        premiumPaidByCcy[ccy] = (premiumPaidByCcy[ccy] ?? 0) + c.premium;
      }
      if (isMe(c.sellerId ?? -1, c.sellerName)) {
        premiumReceivedByCcy[ccy] = (premiumReceivedByCcy[ccy] ?? 0) + c.premium;
      }
    });

    // ITM (current > strike, sa buyer perspektive) na ACTIVE kao kupac
    const itmCount = activeContracts.filter(c =>
      isMe(c.buyerId, c.buyerName) && (c.currentPrice ?? 0) > (c.strikePrice ?? 0)
    ).length;

    // Settlement do 7 dana
    const expiringSoon = activeContracts.filter(c => {
      const d = daysUntil(c.settlementDate);
      return d !== null && d >= 0 && d <= 7;
    }).length;

    // Pregovori - moj red
    const myTurnLocal = data.localOffers.filter(o => o.status === 'ACTIVE' && o.myTurn).length;
    const myTurnInter = data.interOffers.filter(o => o.status === 'ACTIVE' && o.myTurn).length;
    const myTurnTotal = myTurnLocal + myTurnInter;

    // Notional vrednost aktivnih (strike * qty), grupisano po valuti (R1 567).
    const notionalByCcy: Record<string, number> = {};
    activeContracts.forEach(c => {
      const ccy = currencyOf(c);
      notionalByCcy[ccy] = (notionalByCcy[ccy] ?? 0) + (c.strikePrice ?? 0) * (c.quantity ?? 0);
    });
    // Inter-bank aktivni ugovori doprinose notional-u samo gde polja postoje.
    interActive.forEach(c => {
      if (c.strikePrice == null || c.quantity == null) return;
      const ccy = c.listingCurrency || 'RSD';
      notionalByCcy[ccy] = (notionalByCcy[ccy] ?? 0) + c.strikePrice * c.quantity;
    });

    // Dominantna valuta = valuta sa najvecim notional-om (za glavni KPI broj).
    const notionalEntries = Object.entries(notionalByCcy).sort((a, b) => b[1] - a[1]);
    const primaryCurrency = notionalEntries[0]?.[0] ?? 'RSD';
    const multiCurrency =
      new Set([
        ...Object.keys(notionalByCcy),
        ...Object.keys(premiumPaidByCcy),
        ...Object.keys(premiumReceivedByCcy),
      ]).size > 1;

    const premiumPaid = premiumPaidByCcy[primaryCurrency] ?? 0;
    const premiumReceived = premiumReceivedByCcy[primaryCurrency] ?? 0;
    const notional = notionalByCcy[primaryCurrency] ?? 0;

    // R1 855: "iz X banaka" mora brojati BANKE, ne prodavce. Lokalni listinzi
    // imaju `sellerName` = ime OSOBE (klijent/supervizor nase banke), pa njihovo
    // brojanje kao razlicitih banaka je bilo pogresno. Sve lokalne hartije pripadaju
    // nasoj banci → doprinose tacno 1. Inter-bank listinzi nose ime partnerske
    // banke u `sellerName` → broji distinktne partnere.
    const bankSet = new Set<string>();
    if (data.listingsAll.length > 0) bankSet.add('Banka 2');
    data.interListings.forEach(l => bankSet.add(l.sellerName ?? 'partner'));

    // Total discovery
    const discoveryAll = data.listingsAll.length + data.interListings.length;

    return {
      // FIX: brojaci sabiraju lokalne + inter-bank ugovore po statusu.
      activeContractsCount: localActive.length + interActive.length,
      exercisedCount: localExercised.length + interExercised.length,
      expiredCount: localExpired.length + interExpired.length,
      itmCount,
      expiringSoon,
      myTurnTotal,
      premiumPaid,
      premiumReceived,
      premiumNet: premiumReceived - premiumPaid,
      notional,
      primaryCurrency,
      multiCurrency,
      premiumPaidByCcy,
      premiumReceivedByCcy,
      notionalByCcy,
      bankCount: bankSet.size,
      discoveryAll,
      activeOffersCount: data.localOffers.filter(o => o.status === 'ACTIVE').length + data.interOffers.filter(o => o.status === 'ACTIVE').length,
      myPublicCount: data.myPublic.length,
    };
  }, [data, user]);

  // Activity feed - last 6 events combined
  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    data.localOffers.forEach(o => {
      if (!o.lastModifiedAt) return;
      items.push({
        id: `offer-${o.id}`,
        kind: 'offer',
        title: `${o.listingTicker} · ${o.quantity} × ${formatAmount(o.pricePerStock, 2)} ${o.listingCurrency}`,
        subtitle: o.myTurn ? `Tvoj red · ${o.lastModifiedByName ?? ''}`.trim() : `Cekas: ${o.lastModifiedByName ?? ''}`.trim(),
        amount: `Premija ${formatAmount(o.premium, 2)} ${o.listingCurrency}`,
        timestamp: o.lastModifiedAt,
        badgeVariant: o.myTurn ? 'warning' : 'info',
        badgeLabel: o.myTurn ? 'Tvoj red' : 'Pregovor',
        onClick: () => navigate('/otc/pregovori'),
      });
    });
    data.localContracts.forEach(c => {
      const isExercised = c.status === 'EXERCISED';
      const isExpired = c.status === 'EXPIRED';
      const days = daysUntil(c.settlementDate);
      items.push({
        id: `contract-${c.id}`,
        kind: isExercised ? 'exercise' : 'contract',
        title: `${c.listingTicker} · ${c.quantity} × ${formatAmount(c.strikePrice, 2)} ${c.listingCurrency}`,
        subtitle: isExercised && c.exercisedAt
          ? `Iskoriscen ${formatDate(c.exercisedAt)}`
          : isExpired
          ? 'Ugovor je istekao'
          : days !== null
          ? days <= 0 ? 'Settlement danas' : `Settlement za ${days} d.`
          : c.createdAt,
        amount: `${formatAmount((c.strikePrice ?? 0) * (c.quantity ?? 0), 0)} ${c.listingCurrency}`,
        timestamp: c.exercisedAt || c.createdAt,
        badgeVariant: isExercised ? 'success' : isExpired ? 'secondary' : days !== null && days <= 7 ? 'warning' : 'info',
        badgeLabel: isExercised ? 'EXERCISED' : isExpired ? 'EXPIRED' : 'ACTIVE',
        onClick: () => navigate('/otc/ugovori'),
      });
    });
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 6);
  }, [data, navigate]);

  // Top listings — sorted by `availablePublicQuantity * currentPrice` desc
  const trending = useMemo(() => {
    const combined = [
      ...data.listingsAll.map(l => ({ ...l, source: 'Banka 2' as const })),
      ...data.interListings.map(l => ({ ...l, source: 'Partner' as const })),
    ];
    return combined
      .filter(l => (l.availablePublicQuantity ?? 0) > 0)
      .sort((a, b) =>
        ((b.availablePublicQuantity ?? 0) * (b.currentPrice ?? 0)) -
        ((a.availablePublicQuantity ?? 0) * (a.currentPrice ?? 0))
      )
      .slice(0, 4);
  }, [data]);

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 sm:p-10 text-white shadow-2xl shadow-indigo-500/25">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-20 h-52 w-52 rounded-full bg-violet-300/10 blur-3xl" />
        <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-purple-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-200">OTC trgovinski centar</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Handshake className="h-6 w-6" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">OTC trgovina</h1>
            </div>
            <p className="max-w-lg text-sm text-indigo-100">
              Direktna kupoprodaja akcija unutar i izmedju banaka, sa kontraponudama, opcionim ugovorima i SAGA exercise mehanizmom.
            </p>
          </div>

          {/* Hero KPIs */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3 border border-white/10">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Aktivnih ugovora</div>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
                {data.loading ? '—' : kpi.activeContractsCount}
              </div>
              <div className="text-[10px] text-indigo-200">
                {kpi.exercisedCount > 0 ? `+ ${kpi.exercisedCount} EXERCISED` : 'bez exercisa'}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3 border border-white/10">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Otvoreno trziste</div>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
                {data.loading ? '—' : kpi.discoveryAll}
              </div>
              <div className="text-[10px] text-indigo-200">
                {kpi.bankCount > 0 ? `iz ${kpi.bankCount} banaka` : 'javnih akcija'}
              </div>
            </div>
            <div className={`rounded-2xl backdrop-blur-sm px-4 py-3 border ${kpi.myTurnTotal > 0 ? 'bg-amber-400/20 border-amber-300/30' : 'bg-white/10 border-white/10'}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Tvoj red</div>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums flex items-center gap-1">
                {data.loading ? '—' : kpi.myTurnTotal}
                {kpi.myTurnTotal > 0 && <AlertTriangle className="h-4 w-4 text-amber-300" />}
              </div>
              <div className="text-[10px] text-indigo-200">
                {kpi.myTurnTotal > 0 ? 'ceka tvoj odgovor' : 'sve sinhronizovano'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI STRIP — finance metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/5" />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Premija primljeno</span>
              <ArrowDownRight className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              +{formatAmount(kpi.premiumReceived, 2)} {kpi.primaryCurrency}
            </div>
            <div className="text-[10px] text-muted-foreground">
              kao prodavac{kpi.multiCurrency ? ' · vise valuta' : ''}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-red-500 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-rose-500/5" />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Premija placeno</span>
              <ArrowUpRight className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400">
              -{formatAmount(kpi.premiumPaid, 2)} {kpi.primaryCurrency}
            </div>
            <div className="text-[10px] text-muted-foreground">
              kao kupac{kpi.multiCurrency ? ' · vise valuta' : ''}
            </div>
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden border-l-4 rounded-2xl ${kpi.itmCount > 0 ? 'border-l-amber-500' : 'border-l-slate-300'}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${kpi.itmCount > 0 ? 'from-amber-500/10 to-orange-500/5' : 'from-slate-500/5 to-slate-500/5'}`} />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">ITM ugovori</span>
              <Flame className={`h-4 w-4 ${kpi.itmCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums">
              {kpi.itmCount}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {kpi.itmCount > 0 ? 'isplativi za exercise' : 'cekaj povoljan trenutak'}
            </div>
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden border-l-4 rounded-2xl ${kpi.expiringSoon > 0 ? 'border-l-rose-500' : 'border-l-slate-300'}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${kpi.expiringSoon > 0 ? 'from-rose-500/10 to-pink-500/5' : 'from-slate-500/5 to-slate-500/5'}`} />
          <CardContent className="relative p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Istice &lt; 7 dana</span>
              <Timer className={`h-4 w-4 ${kpi.expiringSoon > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            </div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums">
              {kpi.expiringSoon}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {kpi.expiringSoon > 0 ? 'razmisli o exercise' : 'sve u redu'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding info — alleen kad jos nemas aktivnosti */}
      {!data.loading && data.localContracts.length === 0 && data.localOffers.length === 0 && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Tek pocinjes sa OTC?</strong> Krećes od <em>Pretrazi</em> da vidis sta drugi nude, ili <em>Moje javne akcije</em> da objavis svoje za druge.
            Pregovori se vode izmedju kupca i prodavca; kad obe strane potvrde, sklapa se opcioni ugovor koji kupac moze da iskoristi do settlement datuma.
          </AlertDescription>
        </Alert>
      )}

      {/* 4 MAIN HUB CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OtcHubCard
          icon={Search}
          title="Pretrazi"
          gradientFrom="from-indigo-500"
          gradientTo="to-violet-600"
          primaryStat={String(kpi.discoveryAll)}
          primaryStatLabel="javnih akcija"
          secondaryStat={
            kpi.bankCount > 0
              ? `iz ${kpi.bankCount} ${kpi.bankCount === 1 ? 'banke' : 'banaka'}`
              : 'iz nase + partnerskih banaka'
          }
          loading={data.loading}
          onClick={() => navigate('/otc/discovery')}
          dataTestId="hub-discovery"
        />
        <OtcHubCard
          icon={Handshake}
          title="Moji pregovori"
          gradientFrom="from-emerald-500"
          gradientTo="to-teal-600"
          primaryStat={String(kpi.activeOffersCount)}
          primaryStatLabel="aktivna pregovora"
          warningBadge={kpi.myTurnTotal > 0}
          warningBadgeText={`${kpi.myTurnTotal} ceka tebe`}
          loading={data.loading}
          onClick={() => navigate('/otc/pregovori')}
          dataTestId="hub-negotiations"
        />
        <OtcHubCard
          icon={ScrollText}
          title="Sklopljeni ugovori"
          gradientFrom="from-amber-500"
          gradientTo="to-orange-600"
          primaryStat={String(kpi.activeContractsCount)}
          primaryStatLabel="ACTIVE"
          secondaryStat={
            kpi.exercisedCount > 0
              ? `${kpi.exercisedCount} EXERCISED · ${kpi.expiredCount} EXPIRED`
              : kpi.expiredCount > 0 ? `${kpi.expiredCount} EXPIRED` : 'Nista exercisovano'
          }
          loading={data.loading}
          onClick={() => navigate('/otc/ugovori')}
          dataTestId="hub-contracts"
        />
        <OtcHubCard
          icon={Upload}
          title="Moje javne akcije"
          gradientFrom="from-pink-500"
          gradientTo="to-rose-600"
          primaryStat={String(kpi.myPublicCount)}
          primaryStatLabel={kpi.myPublicCount === 1 ? 'javna' : 'javnih'}
          secondaryStat="Iz Portfolio-a"
          loading={data.loading}
          onClick={() => navigate('/otc/moje')}
          dataTestId="hub-my-public"
        />
        {/* FE4 (7.3) — ulaz u istoriju OTC pregovora; samo admin/supervizor */}
        {isSupervisor && (
          <OtcHubCard
            icon={Clock}
            title="Istorija pregovora"
            gradientFrom="from-slate-500"
            gradientTo="to-gray-600"
            primaryStat="Arhiva"
            primaryStatLabel="pregovora i kontraponuda"
            secondaryStat="Admin / supervizor pregled"
            loading={data.loading}
            onClick={() => navigate('/otc/negotiation-history')}
            dataTestId="hub-negotiation-history"
          />
        )}
      </div>

      {/* Two columns: Activity + Trending */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Activity feed */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Skorasnja aktivnost
            </h2>
            {!data.loading && activity.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {data.localOffers.length + data.localContracts.length} ukupno
              </Badge>
            )}
          </div>
          <Card className="rounded-2xl">
            <CardContent className="p-0 divide-y divide-border">
              {data.loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <div className="h-9 w-9 rounded-full animate-pulse bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-44 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))
              ) : activity.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-2">
                    <Clock className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-sm">Jos nema OTC aktivnosti</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">Kreni od <strong>Pretrazi</strong> ili objavi svoju hartiju u <strong>Moje javne akcije</strong>.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/otc/discovery')}>
                    <Search className="mr-2 h-4 w-4" /> Otvori discovery
                  </Button>
                </div>
              ) : (
                activity.map(item => {
                  const Icon = item.kind === 'offer' ? Handshake : item.kind === 'exercise' ? Sparkles : FileSignature;
                  const iconBg =
                    item.kind === 'offer' ? 'bg-indigo-500/10 text-indigo-500'
                    : item.kind === 'exercise' ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-mono tabular-nums text-muted-foreground">{item.amount}</p>
                        <Badge variant={item.badgeVariant} className="text-[9px] mt-0.5">
                          {item.badgeLabel}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>

        {/* Trending listings */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Trending
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('/otc/discovery')}>
              Vidi sve <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <Card className="rounded-2xl">
            <CardContent className="p-0 divide-y divide-border">
              {data.loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <div className="h-9 w-9 rounded-xl animate-pulse bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                  </div>
                ))
              ) : trending.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-2">
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Trziste je trenutno mirno</p>
                  <p className="text-xs text-muted-foreground mt-1">Nema dostupnih javnih akcija</p>
                </div>
              ) : (
                trending.map(l => {
                  const notional = (l.availablePublicQuantity ?? 0) * (l.currentPrice ?? 0);
                  const isInter = l.source === 'Partner';
                  return (
                    <button
                      key={`${l.source}-${l.listingId}-${l.sellerId}`}
                      type="button"
                      onClick={() => navigate('/otc/discovery')}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${isInter ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                        {(l.listingTicker || '?').slice(0, 3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">{l.listingTicker}</p>
                          {isInter && <Badge variant="secondary" className="text-[8px] py-0 px-1"><Building2 className="h-2.5 w-2.5 mr-0.5" />partner</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {l.availablePublicQuantity} kom · {formatAmount(l.currentPrice, 2)} {l.listingCurrency}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold font-mono tabular-nums">
                          {formatAmount(notional, 0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{l.listingCurrency}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Notional value mini card */}
          {!data.loading && kpi.notional > 0 && (
            <Card className="rounded-2xl mt-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5" />
              <CardContent className="relative p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    {kpi.premiumNet >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Notional aktivnih ugovora{kpi.multiCurrency ? ` (${kpi.primaryCurrency})` : ''}
                    </p>
                    <p className="text-lg font-bold font-mono tabular-nums">
                      {formatAmount(kpi.notional, 0)} {kpi.primaryCurrency}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Neto premija: <span className={kpi.premiumNet >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                        {kpi.premiumNet >= 0 ? '+' : ''}{formatAmount(kpi.premiumNet, 2)} {kpi.primaryCurrency}
                      </span>
                    </p>
                    {kpi.multiCurrency && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        * Postoje ugovori u vise valuta — iznosi se ne sabiraju preko valuta.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
