// Windows XP-stil "win cascade" — karte iz foundation-a skacu preko ekrana sa
// gravitacijom + odbijanjem od dna i ostavljaju trag (canvas se ne cisti).
// Cisto vizuelno, pointer-events: none (klik prolazi do dugmadi ispod).
import { useEffect, useRef } from 'react';
import { type Suit, type Rank, isRed } from './engine';

export interface CascadeCard {
  suit: Suit;
  rank: Rank;
}

const RANK_LABEL: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};
const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

const CW = 56;
const CH = 78;
const GRAVITY = 0.45;
const RESTITUTION = 0.82;

interface Particle extends CascadeCard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  launched: boolean;
  resting: boolean;
}

interface Props {
  cards: CascadeCard[];
  /** Pozvano kad sve karte napuste ekran (animacija gotova; trag ostaje). */
  onDone?: () => void;
}

export function WinCascade({ cards, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.scale(dpr, dpr);

    // Lansir tacke — 4 "foundation" pozicije pri vrhu, centar-desno (kao realan layout).
    const launchXs = [W * 0.42, W * 0.48, W * 0.54, W * 0.6];
    const launchY = Math.min(150, H * 0.18);

    const particles: Particle[] = cards.map((c, i) => ({
      ...c,
      x: launchXs[i % 4] - CW / 2,
      y: launchY,
      vx: 0,
      vy: 0,
      launched: false,
      resting: false,
    }));

    let launchIdx = 0;
    let frame = 0;
    let raf = 0;
    let finished = false;

    const drawCard = (p: Particle) => {
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(p.x, p.y, CW, CH, 6);
      } else {
        ctx.rect(p.x, p.y, CW, CH);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.stroke();

      ctx.fillStyle = isRed(p.suit) ? '#dc2626' : '#1e293b';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px ui-serif, Georgia, serif';
      ctx.fillText(RANK_LABEL[p.rank], p.x + 5, p.y + 16);
      ctx.textAlign = 'center';
      ctx.font = '24px serif';
      ctx.fillText(SUIT_SYMBOL[p.suit], p.x + CW / 2, p.y + CH / 2 + 9);
      ctx.restore();
    };

    const tick = () => {
      frame++;
      // lansiraj sledecu kartu svakih ~5 frame-ova
      if (launchIdx < particles.length && frame % 5 === 0) {
        const p = particles[launchIdx++];
        p.launched = true;
        p.vx = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4.5);
        p.vy = -(3 + Math.random() * 3.5);
      }

      for (const p of particles) {
        if (!p.launched) continue;
        if (p.resting) {
          p.x += p.vx;
        } else {
          p.vy += GRAVITY;
          p.x += p.vx;
          p.y += p.vy;
          if (p.y + CH >= H) {
            p.y = H - CH;
            p.vy = -p.vy * RESTITUTION;
            if (Math.abs(p.vy) < 1.8) {
              p.vy = 0;
              p.resting = true;
            }
          }
        }
        drawCard(p);
      }

      const allGone =
        launchIdx >= particles.length &&
        particles.every((p) => p.x < -CW * 2 || p.x > W + CW * 2);

      if (!allGone && frame < 2200) {
        raf = requestAnimationFrame(tick);
      } else if (!finished) {
        finished = true;
        doneRef.current?.();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cards]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none w-screen h-screen"
      aria-hidden="true"
    />
  );
}
