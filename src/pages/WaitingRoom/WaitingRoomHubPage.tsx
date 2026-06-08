import { Gamepad2, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdsCarousel } from '@/components/waiting-room/AdsCarousel';
import { Leaderboard } from '@/components/waiting-room/Leaderboard';
import type { GameType } from '@/types/games';

interface GameCard {
  id: GameType;
  title: string;
  description: string;
  path: string;
  gradient: string;
  status: 'ready' | 'coming-soon';
  icon: React.ReactNode;
}

const GAME_CARDS: GameCard[] = [
  {
    id: 'DINO',
    title: 'Bankar Dino',
    description: 'Klasicni endless jumper sa banker karakterom. Preskoci ERROR znake!',
    path: '/soba-za-cekanje/dino',
    gradient: 'from-indigo-500 to-violet-600',
    status: 'ready',
    icon: (
      <svg viewBox="0 0 100 80" className="h-16 w-16">
        {/* Tlo */}
        <line x1="0" y1="70" x2="100" y2="70" stroke="white" strokeWidth="2" opacity="0.6" />
        {/* Banker (telo) */}
        <rect x="35" y="35" width="20" height="30" fill="white" />
        <circle cx="45" cy="25" r="9" fill="#fbbf24" />
        {/* Kufer */}
        <rect x="55" y="50" width="15" height="10" fill="#f59e0b" />
        {/* ERROR znak */}
        <polygon points="80,55 92,75 68,75" fill="#dc2626" />
        <text x="80" y="71" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">!</text>
      </svg>
    ),
  },
  {
    id: 'SOLITAIRE',
    title: 'Solitaire',
    description: 'Klondike sa tezinama, undo, hint i XP win-kaskadom. Slozi sve 4 boje A→K.',
    path: '/soba-za-cekanje/solitaire',
    gradient: 'from-emerald-500 to-teal-600',
    status: 'ready',
    icon: (
      <svg viewBox="0 0 100 80" className="h-16 w-16">
        <rect x="20" y="15" width="32" height="50" rx="4" fill="white" stroke="white" strokeWidth="1" />
        <rect x="35" y="20" width="32" height="50" rx="4" fill="white" stroke="white" strokeWidth="1" opacity="0.8" />
        <rect x="50" y="25" width="32" height="50" rx="4" fill="white" stroke="white" strokeWidth="1" opacity="0.6" />
        <text x="60" y="55" fontSize="20" fill="#dc2626" fontWeight="bold">♥</text>
      </svg>
    ),
  },
  {
    id: 'CHESS',
    title: 'Šah',
    description: 'Klasicni šah sa AI protivnikom ili sa prijateljem 1v1.',
    path: '/soba-za-cekanje/sah',
    gradient: 'from-slate-500 to-zinc-700',
    status: 'ready',
    icon: (
      <svg viewBox="0 0 100 80" className="h-16 w-16">
        {/* Sahovska tabla mini */}
        {Array.from({ length: 16 }).map((_, i) => {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const isLight = (r + c) % 2 === 0;
          return <rect key={i} x={20 + c * 15} y={15 + r * 15} width="15" height="15" fill={isLight ? 'white' : '#1e293b'} />;
        })}
        {/* Kralj */}
        <circle cx="50" cy="36" r="6" fill="#fbbf24" />
        <rect x="48" y="40" width="4" height="6" fill="#fbbf24" />
      </svg>
    ),
  },
  {
    id: 'BANKA2_RUSH',
    title: 'Banka2Rush',
    description: 'Subway Surfers stil endless runner kroz lobby banke. SKORO!',
    path: '/soba-za-cekanje/banka-rush',
    gradient: 'from-violet-600 to-purple-800',
    status: 'ready',
    icon: (
      <svg viewBox="0 0 100 80" className="h-16 w-16">
        {/* 3 lane road */}
        <polygon points="20,70 80,70 70,20 30,20" fill="white" opacity="0.3" />
        <line x1="40" y1="70" x2="44" y2="20" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="60" y1="70" x2="56" y2="20" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
        {/* Banker u sredini */}
        <rect x="45" y="35" width="10" height="15" fill="white" />
        <circle cx="50" cy="30" r="5" fill="#fbbf24" />
        {/* Vrece sa novcem */}
        <circle cx="32" cy="48" r="4" fill="#fbbf24" stroke="#92400e" />
        <text x="32" y="51" fontSize="6" fill="#92400e" textAnchor="middle" fontWeight="bold">$</text>
      </svg>
    ),
  },
];

export default function WaitingRoomHubPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <Gamepad2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Soba za čekanje</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dok cekas da transakcija prodje — odigraj igricu, pogledaj reklame ili stigni do vrha leaderboard-a.
          </p>
        </div>
        <Sparkles className="h-6 w-6 text-amber-500 hidden md:block" />
      </div>

      {/* Reklame */}
      <AdsCarousel />

      {/* Grid igara + leaderboard sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Games grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAME_CARDS.map((card) => (
            <GameCardItem key={card.id} card={card} />
          ))}
        </div>

        {/* Leaderboard sidebar */}
        <div>
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}

function GameCardItem({ card }: { card: GameCard }) {
  const isReady = card.status === 'ready';
  const className = `group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${card.gradient} p-5 text-white shadow-lg transition-all duration-300 ${isReady ? 'hover:scale-[1.02] hover:shadow-2xl cursor-pointer' : 'opacity-75 cursor-not-allowed'}`;
  const inner = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-shrink-0 rounded-xl bg-white/10 p-2 backdrop-blur">{card.icon}</div>
        {!isReady && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/30 text-amber-100 px-2 py-1 rounded-full">
            Uskoro
          </span>
        )}
      </div>
      <h3 className="font-bold text-xl mb-1">{card.title}</h3>
      <p className="text-sm text-white/90 leading-snug">{card.description}</p>
      {isReady && (
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold opacity-90 group-hover:opacity-100 group-hover:gap-3 transition-all">
          Igraj <ArrowRight className="h-4 w-4" />
        </div>
      )}
    </>
  );
  if (isReady) {
    return <Link to={card.path} className={className}>{inner}</Link>;
  }
  return <div className={className}>{inner}</div>;
}
