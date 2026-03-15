import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';

const features = [
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Upravljanje zaposlenima',
    description:
      'Kreiranje, pregled i upravljanje nalozima zaposlenih sa kompletnim sistemom permisija.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Sigurna autentifikacija',
    description:
      'JWT autentifikacija sa access/refresh tokenima, aktivacija naloga putem email-a.',
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: 'Bankarsko poslovanje',
    description:
      'Upravljanje računima, plaćanja, transferi, menjačnica, kartice i krediti.',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Trgovina hartijama',
    description:
      'Kupovina i prodaja akcija, terminskih ugovora, valutnih parova i opcija na berzi.',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Sistem permisija',
    description:
      'Granularna kontrola pristupa - od osnovnih bankarskih operacija do administratorskih funkcija.',
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: 'Više valuta',
    description:
      'Podrška za RSD, EUR, CHF, USD, GBP, JPY, CAD i AUD sa automatskom konverzijom.',
  },
];

const currencies = [
  { code: 'RSD', symbol: 'дин' },
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'CHF', symbol: '₣' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'AUD', symbol: 'A$' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

function useBackendStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/v3/api-docs`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(4000),
        });
        if (!cancelled) setStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return status;
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const backendStatus = useBackendStatus();
  const featuresAnim = useInView();
  const ctaAnim = useInView();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const statusLabel = backendStatus === 'checking' ? 'Provera servera...'
    : backendStatus === 'online' ? 'Server aktivan'
    : 'Server nedostupan';

  const statusDotColor = backendStatus === 'online' ? 'bg-emerald-500'
    : backendStatus === 'offline' ? 'bg-red-500'
    : 'bg-yellow-500';

  const statusPingColor = backendStatus === 'online' ? 'bg-emerald-400'
    : backendStatus === 'offline' ? 'bg-red-400'
    : 'bg-yellow-400';

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white dark:from-[#070b24] dark:via-[#0a0f2e] dark:to-[#070b24] transition-colors">
      {/* --- Animated background layer --- */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-indigo-300/50 dark:bg-indigo-600/20 blur-[120px] animate-blob" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-violet-300/40 dark:bg-violet-600/15 blur-[100px] animate-blob-slow" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-blue-300/40 dark:bg-blue-600/15 blur-[100px] animate-blob" style={{ animationDelay: '4s' }} />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(100,100,120,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(100,100,120,.15) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* --- Navbar --- */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-[#070b24]/70 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="BANKA 2025 • TIM 2"
              className="h-11 w-11 transition-transform duration-100"
              style={{ transform: `rotateY(${scrollY * 0.5}deg)` }}
            />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              BANKA 2025 <span className="text-indigo-500 dark:text-indigo-400">•</span> TIM 2
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              onClick={() => {
                const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                setTheme(next);
              }}
              title={`Tema: ${theme === 'light' ? 'Svetla' : theme === 'dark' ? 'Tamna' : 'Sistemska'}`}
            >
              {theme === 'light' && <Sun className="h-4 w-4" />}
              {theme === 'dark' && <Moon className="h-4 w-4" />}
              {theme === 'system' && <Monitor className="h-4 w-4" />}
            </Button>
            <Button
              className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02]"
              onClick={() => navigate('/login')}
            >
              Prijavi se
            </Button>
          </div>
        </div>
      </nav>

      {/* --- Hero --- */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem-3.5rem)] max-w-6xl flex-col items-center justify-center px-6 text-center">
        {/* Dotted world map */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[10%] bg-[url('/landing_page_bg.png')] bg-center bg-no-repeat bg-contain opacity-[0.25] dark:opacity-[0.12]"
        />
        {/* Radial glow behind heading */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-indigo-200/40 dark:bg-indigo-500/10 blur-[80px] animate-pulse-glow"
        />

        <div className="relative mx-auto max-w-3xl space-y-8">
          {/* Backend status badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-4 py-1.5 text-sm text-slate-600 dark:text-indigo-300 backdrop-blur-sm shadow-sm dark:shadow-none">
            <span className="relative flex h-2 w-2">
              {backendStatus !== 'offline' && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusPingColor} opacity-75`} />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${statusDotColor}`} />
            </span>
            {statusLabel}
          </div>

          {/* Heading */}
          <h1
            className="animate-fade-up text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.15s' }}
          >
            Moderno bankarstvo
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
              na dohvat ruke
            </span>
          </h1>

          {/* Sub */}
          <p
            className="animate-fade-up mx-auto max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400"
            style={{ animationDelay: '0.3s' }}
          >
            Platforma za upravljanje bankarskim poslovanjem — od korisničkih
            naloga i transakcija do trgovine hartijama od vrednosti.
          </p>

          {/* CTA buttons */}
          <div
            className="animate-fade-up flex items-center justify-center gap-4 pt-2"
            style={{ animationDelay: '0.45s' }}
          >
            <Button
              size="lg"
              className="group relative bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-xl shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.03]"
              onClick={() => navigate('/login')}
            >
              Prijavi se
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white transition-all"
              onClick={() => {
                document
                  .getElementById('features')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Saznaj više
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scroll indicator - positioned at bottom of hero */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-float">
          <div className="flex h-8 w-5 items-start justify-center rounded-full border border-slate-300 dark:border-white/20 p-1">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-white/60" />
          </div>
        </div>
      </section>

      {/* --- Currency ticker --- */}
      <div className="relative z-10 -mt-8 border-y border-slate-200/80 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] py-5 backdrop-blur-sm">
        <div className="overflow-hidden">
          <div className="animate-slide-left flex w-max items-center gap-6">
            {[...currencies, ...currencies, ...currencies, ...currencies].map((c, i) => (
              <span
                key={`${c.code}-${i}`}
                className="flex items-center gap-6 select-none"
              >
                <span className="text-lg font-bold tracking-widest text-slate-500 dark:text-slate-400">
                  {c.code}
                </span>
                <span className="text-xl text-indigo-400/60 dark:text-indigo-500/50">
                  {c.symbol}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* --- Features --- */}
      <section
        id="features"
        ref={featuresAnim.ref}
        className="relative z-10 mx-auto max-w-6xl px-6 py-24"
      >
        <div className="mb-16 text-center space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Mogućnosti
          </p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Sve što vam je potrebno
          </h2>
          <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
            Kompletna platforma za upravljanje bankarskim sistemom sa fokusom na
            sigurnost, efikasnost i jednostavnost korišćenja.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`group relative rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-500 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/[0.04] hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 ${
                featuresAnim.visible ? 'animate-fade-up' : 'opacity-0'
              }`}
              style={{ animationDelay: featuresAnim.visible ? `${i * 0.1}s` : undefined }}
            >
              {/* Gradient hover glow */}
              <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-b from-indigo-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 dark:bg-gradient-to-br dark:from-indigo-500/20 dark:to-violet-500/20 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-white/[0.06] transition-colors group-hover:bg-indigo-200 dark:group-hover:from-indigo-500/30 dark:group-hover:to-violet-500/30 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- CTA --- */}
      <section
        ref={ctaAnim.ref}
        className={`relative z-10 mx-auto max-w-6xl px-6 py-16 ${
          ctaAnim.visible ? 'animate-fade-up' : 'opacity-0'
        }`}
      >
        <div className="group relative">
          {/* Animated border gradient */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 opacity-60 blur-sm transition-all duration-700 group-hover:opacity-100 group-hover:blur-md" />
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 opacity-40" />

          <div className="relative overflow-hidden rounded-2xl">
            {/* CTA background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 dark:from-[#0a0e2a] dark:via-[#0d1240] dark:to-[#110e35]" />

            {/* Animated orbs inside CTA */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-white/20 dark:bg-indigo-500/20 blur-[60px] animate-blob"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-white/15 dark:bg-violet-500/20 blur-[60px] animate-blob-slow"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-80 rounded-full bg-white/10 dark:bg-indigo-400/5 blur-[50px] animate-pulse-glow"
            />

            <div className="relative flex flex-col items-center gap-6 px-8 py-16 text-center sm:py-20">
              <img src="/logo.svg" alt="Banka 2025" className="h-[72px] w-[72px]" />
              <h3 className="text-2xl font-bold text-white sm:text-4xl">
                Spremni da počnete?
              </h3>
              <p className="max-w-lg text-indigo-100 dark:text-slate-400">
                Prijavite se na portal za upravljanje bankarskim sistemom i započnite rad.
              </p>
              <Button
                size="lg"
                className="group/btn bg-white text-indigo-700 dark:text-[#070b24] font-semibold shadow-xl shadow-black/10 transition-all hover:bg-indigo-50 hover:scale-[1.03] hover:shadow-2xl"
                onClick={() => navigate('/login')}
              >
                Prijavi se na portal
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="relative z-10 border-t border-slate-200/80 dark:border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="Banka 2025" className="h-9 w-9" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                BANKA 2025 <span className="text-indigo-500/60">•</span> TIM 2
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-600">
              Softversko inženjerstvo — Računarski fakultet, 2025/26
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
