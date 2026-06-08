// SVG kartica u Banka 2 stilu (indigo/violet poledjina, bele lice sa simbolima boje).
// Skroz custom, nema textura — vector-only.
import { type Suit, type Rank, isRed } from './engine';

const RANK_LABEL: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠', H: '♥', D: '♦', C: '♣',
};

// "court" karte (J/Q/K) — koristi se kao decoration u sredini
const COURT_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K' };

export const CARD_W = 88;
export const CARD_H = 124;

interface Props {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  highlighted?: boolean;
  /** Hint glow — emerald puls (razlikuje se od amber selekcije). */
  hinted?: boolean;
  dragging?: boolean;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export function CardSvg({ suit, rank, faceUp, highlighted, hinted, dragging, style, onClick, onPointerDown }: Props) {
  const isRedSuit = isRed(suit);
  const color = isRedSuit ? '#dc2626' : '#1e293b';
  const colorMuted = isRedSuit ? '#fecaca' : '#cbd5e1';
  const ringClass = highlighted
    ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent shadow-amber-400/40 shadow-xl scale-[1.04]'
    : hinted
    ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent shadow-emerald-400/50 shadow-xl animate-pulse'
    : 'ring-1 ring-black/15 dark:ring-white/10';
  // Jedinstveni ID per card za SVG defs (gradient/pattern)
  const uid = `${suit}${rank}`;
  return (
    <div
      className={`relative rounded-xl shadow-md select-none transition-transform ${ringClass} ${dragging ? 'opacity-90 scale-105 z-50' : ''}`}
      style={{ width: CARD_W, height: CARD_H, ...style }}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {faceUp ? (
        <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width={CARD_W} height={CARD_H} className="rounded-xl">
          <defs>
            <linearGradient id={`face-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f8fafc" />
            </linearGradient>
            <linearGradient id={`court-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isRedSuit ? '#fee2e2' : '#e2e8f0'} />
              <stop offset="100%" stopColor={isRedSuit ? '#fecaca' : '#cbd5e1'} />
            </linearGradient>
          </defs>
          {/* Pozadina */}
          <rect width={CARD_W} height={CARD_H} rx="10" fill={`url(#face-${uid})`} />
          {/* Suptilni inner border */}
          <rect x="2" y="2" width={CARD_W - 4} height={CARD_H - 4} rx="8" fill="none" stroke={colorMuted} strokeWidth="0.6" />

          {/* Gornji-levi rank + suit (vertikalno) */}
          <text x="8" y="22" fontSize="18" fontWeight="700" fill={color} fontFamily="ui-serif, Georgia, serif">{RANK_LABEL[rank]}</text>
          <text x="9" y="40" fontSize="16" fill={color}>{SUIT_SYMBOL[suit]}</text>

          {/* Centralni dekor — Court za J/Q/K, mali pip-ovi za number kartice, A za asa */}
          {renderCenter(rank, suit, color, uid)}

          {/* Donji-desni (rotirano 180) */}
          <g transform={`rotate(180 ${CARD_W / 2} ${CARD_H / 2})`}>
            <text x="8" y="22" fontSize="18" fontWeight="700" fill={color} fontFamily="ui-serif, Georgia, serif">{RANK_LABEL[rank]}</text>
            <text x="9" y="40" fontSize="16" fill={color}>{SUIT_SYMBOL[suit]}</text>
          </g>
        </svg>
      ) : (
        <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width={CARD_W} height={CARD_H} className="rounded-xl">
          <defs>
            <linearGradient id={`back-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4338ca" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
            <pattern id={`pat-${uid}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 0 5 L 5 0 L 10 5 L 5 10 Z" fill="rgba(255,255,255,0.08)" />
              <circle cx="5" cy="5" r="1.5" fill="rgba(255,255,255,0.22)" />
            </pattern>
          </defs>
          <rect width={CARD_W} height={CARD_H} rx="10" fill={`url(#back-${uid})`} />
          <rect width={CARD_W} height={CARD_H} rx="10" fill={`url(#pat-${uid})`} />
          {/* Inner frame */}
          <rect x="4" y="4" width={CARD_W - 8} height={CARD_H - 8} rx="6" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          {/* B2 logo */}
          <text x={CARD_W / 2} y={CARD_H / 2 - 2} fontSize="26" fontWeight="800" fill="white" textAnchor="middle" opacity="0.95" fontFamily="ui-serif, Georgia, serif">B2</text>
          <text x={CARD_W / 2} y={CARD_H / 2 + 16} fontSize="9" fill="rgba(255,255,255,0.7)" textAnchor="middle" letterSpacing="2">BANKA 2</text>
        </svg>
      )}
    </div>
  );
}

/**
 * Centralni dekor faze karte. Razlikuje:
 * - As: jedan veliki suit u sredini
 * - 2-10: pip layout (mreza simbola, broj odgovara ranku)
 * - J/Q/K: court karta (placeholder okvir sa slovom + suit u uglovima)
 */
function renderCenter(rank: Rank, suit: Suit, color: string, uid: string) {
  if (rank === 1) {
    // As — veliki suit
    return (
      <text
        x={CARD_W / 2}
        y={CARD_H / 2 + 14}
        fontSize="44"
        fill={color}
        textAnchor="middle"
        opacity="0.95"
      >
        {SUIT_SYMBOL[suit]}
      </text>
    );
  }
  if (rank >= 11) {
    // Court — okvir sa slovom + 4 pip-a u uglovima
    return (
      <g>
        <rect
          x={CARD_W * 0.18}
          y={CARD_H * 0.22}
          width={CARD_W * 0.64}
          height={CARD_H * 0.56}
          rx="4"
          fill={`url(#court-${uid})`}
          stroke={color}
          strokeWidth="0.8"
          opacity="0.8"
        />
        <text
          x={CARD_W / 2}
          y={CARD_H / 2 + 12}
          fontSize="38"
          fontWeight="700"
          fill={color}
          textAnchor="middle"
          fontFamily="ui-serif, Georgia, serif"
        >
          {COURT_LABEL[rank]}
        </text>
        {/* Mali suit ispod slova */}
        <text
          x={CARD_W / 2}
          y={CARD_H * 0.75}
          fontSize="14"
          fill={color}
          textAnchor="middle"
        >
          {SUIT_SYMBOL[suit]}
        </text>
      </g>
    );
  }
  // 2-10: pip layout
  return <g>{renderPips(rank, suit, color)}</g>;
}

/**
 * Vraca pip-ove (suit simbole) rasporedjene po klasicnom layout-u za 2-10.
 * Koordinate u procentima CARD_W/H, sa central column + paired side columns.
 */
function renderPips(rank: Rank, suit: Suit, color: string) {
  const positions = PIP_LAYOUTS[rank] ?? [];
  const symbol = SUIT_SYMBOL[suit];
  return positions.map(([px, py], i) => {
    const flip = py > 0.5; // donja polovina kartice — rotirano 180 (kao na pravim kartama)
    return (
      <text
        key={i}
        x={CARD_W * px}
        y={CARD_H * py + 5}
        fontSize="14"
        fill={color}
        textAnchor="middle"
        transform={flip ? `rotate(180 ${CARD_W * px} ${CARD_H * py})` : undefined}
      >
        {symbol}
      </text>
    );
  });
}

// Layout pip-ova za rank 2-10 (procenti od CARD_W i CARD_H)
const PIP_LAYOUTS: Partial<Record<number, Array<[number, number]>>> = {
  2: [[0.5, 0.25], [0.5, 0.75]],
  3: [[0.5, 0.25], [0.5, 0.5], [0.5, 0.75]],
  4: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.75], [0.7, 0.75]],
  5: [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]],
  6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
  7: [[0.3, 0.22], [0.7, 0.22], [0.5, 0.37], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]],
  8: [[0.3, 0.22], [0.7, 0.22], [0.5, 0.37], [0.3, 0.5], [0.7, 0.5], [0.5, 0.63], [0.3, 0.78], [0.7, 0.78]],
  9: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.38], [0.7, 0.38], [0.5, 0.5], [0.3, 0.62], [0.7, 0.62], [0.3, 0.8], [0.7, 0.8]],
  10: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.35], [0.7, 0.35], [0.5, 0.28], [0.5, 0.72], [0.3, 0.65], [0.7, 0.65], [0.3, 0.8], [0.7, 0.8]],
};

export function CardPlaceholder({ label, hinted, style }: { label?: string; hinted?: boolean; style?: React.CSSProperties }) {
  const cls = hinted
    ? 'border-emerald-400 text-emerald-500 ring-2 ring-emerald-400/60 animate-pulse'
    : 'border-slate-300 dark:border-slate-700 text-slate-400';
  return (
    <div
      className={`rounded-lg border-2 border-dashed flex items-center justify-center text-xs font-semibold ${cls}`}
      style={{ width: CARD_W, height: CARD_H, ...style }}
    >
      {label}
    </div>
  );
}
