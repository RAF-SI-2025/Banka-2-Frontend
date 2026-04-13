import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Shield,
  Users,
  CreditCard,
  ArrowRight,
  BarChart3,
  Lock,
  Globe,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Landmark,
  LineChart,
  Wallet,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';

/* ─────────────── Data ─────────────── */

const features = [
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Upravljanje zaposlenima',
    desc: 'Kompletni CRUD nad nalozima, permisije, aktivacija putem email-a.',
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Sigurna autentifikacija',
    desc: 'JWT access/refresh tokeni, OTP verifikacija, password constraints.',
    gradient: 'from-violet-500 to-purple-400',
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: 'Bankarsko poslovanje',
    desc: 'Racuni, placanja, transferi, menjacnica, kartice i krediti.',
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Trgovina hartijama',
    desc: 'Akcije, futures, forex i opcije sa 4 tipa naloga na 6 berzi.',
    gradient: 'from-amber-500 to-orange-400',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Sistem permisija',
    desc: 'Granularna kontrola: Admin, Supervizor, Agent, Klijent.',
    gradient: 'from-rose-500 to-pink-400',
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: 'Vise valuta',
    desc: 'RSD, EUR, CHF, USD, GBP, JPY, CAD i AUD sa konverzijom.',
    gradient: 'from-indigo-500 to-blue-400',
  },
];

const stats = [
  { icon: <Globe className="h-5 w-5" />, value: 8, label: 'Valuta' },
  { icon: <Landmark className="h-5 w-5" />, value: 6, label: 'Berzi' },
  { icon: <LineChart className="h-5 w-5" />, value: 4, label: 'Tipa naloga' },
  { icon: <Wallet className="h-5 w-5" />, value: 5, label: 'Vrsta kredita' },
];

const tickerItems = [
  { code: 'EUR/RSD', price: '117,42', change: '+0,12%', up: true },
  { code: 'USD/RSD', price: '108,35', change: '-0,08%', up: false },
  { code: 'GBP/RSD', price: '137,21', change: '+0,34%', up: true },
  { code: 'CHF/RSD', price: '121,89', change: '+0,05%', up: true },
  { code: 'JPY/RSD', price: '0,72', change: '-0,15%', up: false },
  { code: 'CAD/RSD', price: '79,64', change: '+0,21%', up: true },
  { code: 'AUD/RSD', price: '71,38', change: '-0,03%', up: false },
  { code: 'AAPL', price: '$198,45', change: '+1,23%', up: true },
  { code: 'MSFT', price: '$421,30', change: '+0,87%', up: true },
  { code: 'TSLA', price: '$267,15', change: '-2,14%', up: false },
];

const mockTransactions = [
  { name: 'Stefan J.', amount: '-12.500,00 RSD', type: 'out' },
  { name: 'Milica N.', amount: '+45.000,00 RSD', type: 'in' },
  { name: 'AAPL x10', amount: '-$1.984,50', type: 'out' },
  { name: 'Lazar I.', amount: '+8.200,00 EUR', type: 'in' },
];

/* ─────────────── Hooks ─────────────── */

function useBackendStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api';
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/v3/api-docs`, {
          method: 'HEAD', signal: AbortSignal.timeout(4000),
        });
        if (!cancelled) setStatus(res.ok ? 'online' : 'offline');
      } catch { if (!cancelled) setStatus('offline'); }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);
  return status;
}

function useInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function useMouseGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, []);
  return { ref, pos };
}

function AnimatedCounter({ value, visible }: { value: number; visible: boolean }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const animate = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const dur = 1400;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  useEffect(() => { if (visible) animate(); }, [visible, animate]);
  return <span>{count}</span>;
}

/* ─────────────── Component ─────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const backendStatus = useBackendStatus();
  const [featRef, featVis] = useInView();
  const [statsRef, statsVis] = useInView();
  const [ctaRef, ctaVis] = useInView();
  const mouseGlow = useMouseGlow();

  const statusDot = backendStatus === 'online' ? 'bg-emerald-500' : backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500';
  const statusPing = backendStatus === 'online' ? 'bg-emerald-400' : backendStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400';
  const statusText = backendStatus === 'checking' ? 'Provera servera...' : backendStatus === 'online' ? 'Sistem aktivan' : 'Server nedostupan';

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50 dark:bg-[#050816] text-slate-900 dark:text-white selection:bg-indigo-500/30 transition-colors">

      {/* ══════ AURORA BACKGROUND ══════ */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] h-[700px] w-[700px] bg-gradient-to-br from-indigo-300/40 via-violet-300/30 to-transparent dark:from-indigo-600/40 dark:via-violet-600/30 dark:to-transparent rounded-full blur-[120px] animate-aurora-1" />
        <div className="absolute top-[10%] right-[-15%] h-[600px] w-[600px] bg-gradient-to-bl from-cyan-300/30 via-blue-300/20 to-transparent dark:from-cyan-500/30 dark:via-blue-600/20 dark:to-transparent rounded-full blur-[100px] animate-aurora-2" />
        <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] bg-gradient-to-tr from-violet-300/25 via-fuchsia-300/15 to-transparent dark:from-violet-600/25 dark:via-fuchsia-500/15 dark:to-transparent rounded-full blur-[100px] animate-aurora-1" style={{ animationDelay: '5s' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(100,100,120,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(100,100,120,.15) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
        {/* Noise */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* ══════ NAVBAR ══════ */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-[#050816]/60 backdrop-blur-2xl transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-10 w-10" />
            <span className="text-lg font-bold tracking-tight">
              BANKA <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">2025</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Status */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                {backendStatus !== 'offline' && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusPing} opacity-75`} />}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusDot}`} />
              </span>
              {statusText}
            </div>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}>
              {theme === 'light' ? <Sun className="h-4 w-4" /> : theme === 'dark' ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </Button>
            <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all" onClick={() => navigate('/login')}>
              Prijavi se
            </Button>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section ref={mouseGlow.ref} className="relative z-10 mx-auto flex min-h-[calc(100svh-7.5rem)] max-w-7xl flex-col items-center justify-center px-6 py-12 lg:py-0">
        {/* Mouse-following glow */}
        <div className="pointer-events-none absolute z-0 h-[400px] w-[400px] rounded-full bg-indigo-400/10 dark:bg-indigo-500/10 blur-[100px] transition-all duration-700 ease-out" style={{ left: mouseGlow.pos.x - 200, top: mouseGlow.pos.y - 200 }} />

        {/* World map background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/landing_page_bg.png')] bg-center bg-no-repeat bg-contain opacity-[0.12] dark:opacity-[0.07]" />

        {/* Hero content row */}
        <div className="relative flex flex-col lg:flex-row items-center justify-center gap-12 flex-1 w-full max-w-7xl">

        {/* Left: text */}
        <div className="relative flex-1 max-w-2xl space-y-8 text-center lg:text-left">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-4 py-1.5 text-sm text-indigo-600 dark:text-indigo-300 backdrop-blur-sm shadow-sm dark:shadow-none">
            <Zap className="h-3.5 w-3.5" />
            Softversko inzenjerstvo 2025/26
          </div>

          <h1 className="animate-fade-up text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]" style={{ animationDelay: '0.12s' }}>
            Moderno
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 dark:from-indigo-400 dark:via-violet-400 dark:to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
              bankarstvo
            </span>
            <br />
            <span className="text-slate-400 dark:text-slate-400">na dohvat ruke</span>
          </h1>

          <p className="animate-fade-up mx-auto lg:mx-0 max-w-lg text-lg text-slate-600 dark:text-slate-400 leading-relaxed" style={{ animationDelay: '0.24s' }}>
            Kompletna platforma za upravljanje racunima, transakcijama i trgovinu hartijama od vrednosti na svetskim berzama.
          </p>

          <div className="animate-fade-up flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2" style={{ animationDelay: '0.36s' }}>
            <Button size="lg" className="group relative overflow-hidden bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.03] transition-all" onClick={() => navigate('/login')}>
              <span className="relative z-10 flex items-center">
                Prijavi se na portal
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
            <Button size="lg" variant="ghost" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              Saznaj vise <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: floating glass card mockup */}
        <div className="relative flex-shrink-0 animate-fade-up hidden lg:block" style={{ animationDelay: '0.4s', perspective: '1000px' }}>
          <div className="animate-card-float" style={{ transformStyle: 'preserve-3d' }}>
            {/* Glow behind card */}
            <div className="absolute -inset-8 bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-cyan-500/10 dark:from-indigo-500/30 dark:via-violet-500/20 dark:to-cyan-500/10 rounded-3xl blur-2xl animate-morph" />

            {/* Glass card */}
            <div className="relative w-[340px] rounded-2xl border border-slate-200/60 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl p-6 shadow-2xl shadow-indigo-500/10 dark:shadow-black/20">
              {/* Card header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                    <Landmark className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tekuci racun</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">222-0001-*****-10</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  +2,4%
                </div>
              </div>

              {/* Balance */}
              <div className="mb-5">
                <p className="text-xs text-slate-500 mb-1">Raspolozivo stanje</p>
                <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  1.247.500<span className="text-lg text-slate-400">,00 RSD</span>
                </p>
              </div>

              {/* Mini chart line */}
              <div className="mb-5 h-12 relative">
                <svg viewBox="0 0 300 50" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,35 C20,32 40,28 60,30 C80,32 100,25 120,20 C140,15 160,22 180,18 C200,14 220,10 240,15 C260,20 280,8 300,5" fill="none" stroke="rgb(99, 102, 241)" strokeWidth="2" />
                  <path d="M0,35 C20,32 40,28 60,30 C80,32 100,25 120,20 C140,15 160,22 180,18 C200,14 220,10 240,15 C260,20 280,8 300,5 L300,50 L0,50 Z" fill="url(#chartGrad)" />
                </svg>
              </div>

              {/* Recent transactions */}
              <p className="text-xs text-slate-500 mb-2">Poslednje transakcije</p>
              <div className="space-y-2">
                {mockTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-200/50 dark:border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${tx.type === 'in' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'}`}>
                        {tx.name[0]}
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">{tx.name}</span>
                    </div>
                    <span className={`font-mono text-xs ${tx.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        </div>{/* end hero content row */}

        {/* Scroll indicator */}
        <div className="mt-auto mb-2 pt-4 animate-float hidden lg:block">
          <div className="flex h-8 w-5 items-start justify-center rounded-full border border-slate-300 dark:border-white/20 p-1">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-white/60" />
          </div>
        </div>
      </section>

      {/* ══════ LIVE TICKER (full width, bottom of viewport) ══════ */}
      <div className="relative z-10 border-y border-slate-200/80 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] py-3 backdrop-blur-sm -mt-2">
        <div className="overflow-hidden">
          <div className="animate-slide-left flex w-max items-center gap-8" style={{ animationDuration: '60s' }}>
            {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((c, i) => (
              <span key={i} className="flex items-center gap-3 select-none whitespace-nowrap">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{c.code}</span>
                <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{c.price}</span>
                <span className={`text-xs font-mono ${c.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {c.change}
                </span>
                <span className="text-slate-300 dark:text-white/10">|</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ UNIFIED FLOATING CARDS SECTION ══════ */}
      <section id="features" ref={featRef} className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-16 pb-20">
        {/* Aurora accents */}
        <div className="pointer-events-none absolute top-0 left-1/4 h-[400px] w-[500px] bg-gradient-to-br from-indigo-400/15 dark:from-indigo-500/10 to-transparent rounded-full blur-[100px]" />
        <div className="pointer-events-none absolute top-1/3 right-0 h-[400px] w-[400px] bg-gradient-to-l from-violet-300/15 dark:from-violet-500/10 to-transparent rounded-full blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[500px] bg-gradient-to-t from-cyan-300/10 dark:from-cyan-500/8 to-transparent rounded-full blur-[80px]" />

        <div ref={statsRef} className="mx-auto max-w-[1400px] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* ── Stat cards (small, top row) ── */}
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm p-5 transition-all duration-700 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/60 dark:hover:border-indigo-500/20 ${statsVis ? 'animate-slide-up' : 'opacity-0'}`}
              style={{
                animationDelay: statsVis ? `${i * 0.08}s` : undefined,
                animation: statsVis ? `slide-up 0.8s ease-out ${i * 0.08}s forwards, float ${6 + i * 0.8}s ease-in-out ${i * 0.5}s infinite` : undefined,
              }}
            >
              <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${features[i]?.gradient || 'from-indigo-500 to-violet-400'} opacity-40`} />
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${features[i]?.gradient || 'from-indigo-500 to-violet-400'} text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono tabular-nums bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                    <AnimatedCounter value={s.value} visible={statsVis} />
                  </div>
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}

          {/* ── CTA mini card (5th in top row on lg) ── */}
          <div
            className={`group relative overflow-hidden rounded-2xl border border-indigo-300/40 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 dark:from-indigo-500/10 dark:to-violet-500/5 backdrop-blur-sm p-5 transition-all duration-700 hover:shadow-xl hover:shadow-indigo-500/10 hidden lg:flex items-center justify-center ${statsVis ? 'animate-slide-up' : 'opacity-0'}`}
            style={{
              animationDelay: statsVis ? '0.35s' : undefined,
              animation: statsVis ? 'slide-up 0.8s ease-out 0.35s forwards, float 7s ease-in-out 2s infinite' : undefined,
            }}
          >
            <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:gap-3 transition-all">
              Prijavi se <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* ── Feature cards (larger, main grid) ── */}
          {features.map((f, i) => {
            // Vary spans: first and fourth are wide
            const isWide = i === 0 || i === 3;
            const floatDuration = 5.5 + i * 0.7;
            const floatDelay = i * 0.4;
            return (
              <div
                key={f.title}
                className={`group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm p-6 transition-all duration-700 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/20 ${isWide ? 'sm:col-span-2 lg:col-span-3' : 'sm:col-span-1 lg:col-span-2'} ${featVis ? 'animate-slide-up' : 'opacity-0'}`}
                style={{
                  animationDelay: featVis ? `${0.1 + i * 0.08}s` : undefined,
                  animation: featVis ? `slide-up 0.8s ease-out ${0.1 + i * 0.08}s forwards, float ${floatDuration}s ease-in-out ${floatDelay}s infinite` : undefined,
                }}
              >
                <div className={`pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b ${f.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-700`} />
                <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${f.gradient} scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left`} />
                <div className={`pointer-events-none absolute -top-16 -right-16 h-32 w-32 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-10 rounded-full blur-3xl transition-opacity duration-700`} />

                <div className="relative flex items-start gap-4">
                  <div className={`flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl group-hover:rotate-3`}>
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold mb-1">{f.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Step cards (bottom row, horizontal) ── */}
          {[
            { step: '01', title: 'Registracija', desc: 'Admin kreira nalog, zaposleni aktivira putem email-a.', icon: <Users className="h-4 w-4" />, gradient: 'from-emerald-500 to-teal-400' },
            { step: '02', title: 'Otvaranje racuna', desc: 'Tekuci ili devizni, licni ili poslovni, 8 valuta.', icon: <CreditCard className="h-4 w-4" />, gradient: 'from-teal-500 to-cyan-400' },
            { step: '03', title: 'Transakcije', desc: 'Placanja, transferi, menjacnica u realnom vremenu.', icon: <Zap className="h-4 w-4" />, gradient: 'from-cyan-500 to-blue-400' },
            { step: '04', title: 'Berza', desc: 'Akcije, futures, forex — 4 tipa naloga na 6 berzi.', icon: <TrendingUp className="h-4 w-4" />, gradient: 'from-blue-500 to-indigo-400' },
          ].map((item, i) => (
            <div
              key={item.step}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm p-4 transition-all duration-700 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-emerald-200 dark:hover:border-emerald-500/20 lg:col-span-1 ${featVis ? 'animate-slide-up' : 'opacity-0'}`}
              style={{
                animationDelay: featVis ? `${0.5 + i * 0.08}s` : undefined,
                animation: featVis ? `slide-up 0.8s ease-out ${0.5 + i * 0.08}s forwards, float ${6.5 + i * 0.6}s ease-in-out ${1 + i * 0.3}s infinite` : undefined,
              }}
            >
              <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${item.gradient} opacity-40`} />
              <div className="relative flex items-start gap-3">
                <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} text-white shadow-md transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold font-mono bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>{item.step}</span>
                    <h3 className="text-sm font-bold">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}

          {/* ── Last card: "Kako funkcionise" link ── */}
          <div
            className={`group relative overflow-hidden rounded-2xl border border-emerald-300/40 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 dark:from-emerald-500/10 dark:to-cyan-500/5 backdrop-blur-sm p-4 transition-all duration-700 hover:shadow-xl hover:shadow-emerald-500/10 flex items-center justify-center ${featVis ? 'animate-slide-up' : 'opacity-0'}`}
            style={{
              animationDelay: featVis ? '0.82s' : undefined,
              animation: featVis ? 'slide-up 0.8s ease-out 0.82s forwards, float 7.5s ease-in-out 2.5s infinite' : undefined,
            }}
          >
            <div className="text-center">
              <BarChart3 className="h-5 w-5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">4 koraka do cilja</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section ref={ctaRef} className={`relative z-10 mx-auto max-w-6xl px-6 py-20 ${ctaVis ? 'animate-slide-up' : 'opacity-0'}`}>
        <div className="relative overflow-hidden rounded-[2rem]">
          {/* Animated border */}
          <div className="absolute -inset-[1px] rounded-[2rem] bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 bg-[length:300%_auto] animate-gradient-shift" />

          <div className="relative rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 dark:from-[#080c25] dark:via-[#0c1038] dark:to-[#0e0c30] m-[1px] overflow-hidden">
            {/* Decorative aurora orbs */}
            <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 bg-white/15 dark:bg-indigo-500/20 rounded-full blur-[80px] animate-aurora-2" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 bg-white/10 dark:bg-violet-500/15 rounded-full blur-[80px] animate-aurora-1" />
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-96 bg-white/5 dark:bg-cyan-400/5 rounded-full blur-[60px] animate-pulse-glow" />

            {/* World map echo */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/landing_page_bg.png')] bg-center bg-no-repeat bg-contain opacity-[0.04]" />

            <div className="relative flex flex-col items-center gap-8 px-8 py-24 text-center">
              {/* Logo with glow */}
              <div className="relative">
                <div className="absolute -inset-4 bg-white/20 dark:bg-indigo-500/30 rounded-full blur-2xl animate-pulse-glow" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 dark:bg-white/[0.06] border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-sm">
                  <img src="/logo.svg" alt="" className="h-12 w-12" />
                </div>
              </div>

              <h3 className="text-4xl font-extrabold text-white sm:text-5xl leading-tight">
                Spremni da
                <br />
                <span className="bg-gradient-to-r from-indigo-200 via-violet-200 to-cyan-200 dark:from-indigo-400 dark:via-violet-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  pocnete?
                </span>
              </h3>
              <p className="max-w-lg text-lg text-indigo-100/80 dark:text-slate-400">
                Prijavite se na portal i zapocnite rad sa kompletnim bankarskim sistemom.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Button size="lg" className="group bg-white text-indigo-700 font-bold shadow-2xl shadow-black/20 hover:bg-indigo-50 hover:scale-[1.05] transition-all text-base px-8" onClick={() => navigate('/login')}>
                  Prijavi se na portal
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 pt-4">
                {['JWT Auth', 'SSL/TLS', 'OTP Verifikacija'].map(badge => (
                  <div key={badge} className="flex items-center gap-1.5 text-xs text-indigo-200/60 dark:text-slate-500">
                    <Shield className="h-3 w-3" />
                    {badge}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FOOTER — Premium ══════ */}
      <footer className="relative z-10 border-t border-slate-200/80 dark:border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center gap-8">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="" className="h-10 w-10" />
              <div>
                <span className="text-lg font-bold text-slate-700 dark:text-white">
                  BANKA <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">2025</span>
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-600">&bull; TIM 2</p>
              </div>
            </div>

            <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent" />

            <p className="text-sm text-slate-400 dark:text-slate-600 text-center">
              Softversko inzenjerstvo &mdash; Racunarski fakultet, 2025/26
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
