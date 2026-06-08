// Klondike Solitaire — Banka 2. Click-to-move (klik izvor → klik destinacija);
// dvoklik/auto promote do foundation-a. Plus: tezine (Lako/Srednje/Tesko), undo,
// hint, auto-complete i Windows XP "win cascade" animacija.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCw, Trophy, Clock, Move as MoveIcon, Undo2, Lightbulb, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  newGame,
  newWinnableGame,
  drawFromStock,
  moveCard,
  isWon,
  isAutoCompletable,
  autoCompleteStep,
  findHint,
  computeScore,
  type GameState,
  type PileRef,
  type Move,
  type Difficulty,
  type DrawMode,
  FOUNDATION_ORDER,
} from './engine';
import { CardSvg, CardPlaceholder, CARD_W, CARD_H } from './CardSvg';
import { WinCascade } from './WinCascade';
import { useAuth } from '@/context/AuthContext';
import { gameScoreService } from '@/services/gameScoreService';
import { toast } from '@/lib/notify';

interface Selection {
  pile: PileRef;
  cardIndex: number;
}

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Lako', hint: 'Izvlaci 1 kartu · garantovano resiva partija' },
  { id: 'medium', label: 'Srednje', hint: 'Izvlaci 1 kartu · nasumicna partija' },
  { id: 'hard', label: 'Tesko', hint: 'Izvlaci 3 karte · nasumicna partija' },
];

const HISTORY_CAP = 400;

function drawModeFor(d: Difficulty): DrawMode {
  return d === 'hard' ? 3 : 1;
}

export function SolitaireGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [state, setState] = useState<GameState>(() => newGame());
  const [history, setHistory] = useState<GameState[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [dealing, setDealing] = useState(true);
  const [autoRunning, setAutoRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showCascade, setShowCascade] = useState(false);
  const { user } = useAuth();

  const drawMode = drawModeFor(difficulty);
  const won = useMemo(() => isWon(state), [state]);
  const finalScore = useMemo(() => (won ? computeScore(state, Date.now()) : 0), [state, won]);
  const canAuto = useMemo(() => isAutoCompletable(state) && !won && !autoRunning, [state, won, autoRunning]);

  // ── (re)deal ──────────────────────────────────────────────────────────────
  const regenerate = useCallback((diff: Difficulty) => {
    setSelection(null);
    setHint(null);
    setHistory([]);
    setSubmitted(false);
    setShowCascade(false);
    setAutoRunning(false);
    setElapsed(0);
    if (diff === 'easy') {
      setDealing(true);
      // async da se "Deljenje..." overlay render-uje pre nego sto solver blokira thread
      setTimeout(() => {
        setState(newWinnableGame());
        setDealing(false);
      }, 20);
    } else {
      setState(newGame());
      setDealing(false);
    }
  }, []);

  // Prvi deal na mount = Lako (garantovano resiva).
  useEffect(() => {
    regenerate('easy');
  }, [regenerate]);

  function changeDifficulty(diff: Difficulty) {
    if (diff === difficulty && !dealing) {
      regenerate(diff);
      return;
    }
    setDifficulty(diff);
    regenerate(diff);
  }

  // ── timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (won || dealing) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - state.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state.startedAt, won, dealing]);

  // ── score submit + cascade na pobedi ──────────────────────────────────────
  useEffect(() => {
    if (!won) return;
    setShowCascade(true);
    if (!submitted && user) {
      gameScoreService
        .submit({ gameType: 'SOLITAIRE', score: finalScore })
        .then(() => toast.success(`Pobeda! Score ${finalScore} sacuvan u leaderboard.`))
        .catch(() => toast.error('Greska pri cuvanju score-a.'));
      setSubmitted(true);
    }
  }, [won, submitted, user, finalScore]);

  // ── auto-complete runner ──────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRunning) return;
    const id = setInterval(() => {
      setState((prev) => {
        const next = autoCompleteStep(prev);
        if (!next) {
          setAutoRunning(false);
          return prev;
        }
        return next;
      });
    }, 110);
    return () => clearInterval(id);
  }, [autoRunning]);

  // ── hint auto-clear ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(null), 4000);
    return () => clearTimeout(id);
  }, [hint]);

  // ── state mutacije sa undo istorijom ──────────────────────────────────────
  const commit = useCallback((next: GameState) => {
    setHistory((h) => {
      const nh = [...h, state];
      return nh.length > HISTORY_CAP ? nh.slice(nh.length - HISTORY_CAP) : nh;
    });
    setState(next);
    setHint(null);
  }, [state]);

  function undo() {
    if (!history.length || autoRunning || won) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setSelection(null);
    setHint(null);
  }

  function tryMoveTo(dest: PileRef) {
    if (!selection) return;
    const next = moveCard(state, selection.pile, selection.cardIndex, dest);
    if (next) {
      commit(next);
    } else {
      toast.error('Nedozvoljen potez.');
    }
    setSelection(null);
  }

  function autoToFoundation(from: PileRef, fromCardIndex: number): boolean {
    for (let i = 0; i < 4; i++) {
      const next = moveCard(state, from, fromCardIndex, { type: 'foundation', index: i });
      if (next) {
        commit(next);
        setSelection(null);
        return true;
      }
    }
    return false;
  }

  function clickCard(pile: PileRef, cardIndex: number, isTop: boolean) {
    if (autoRunning || won) return;
    if (selection) {
      if (selection.pile.type === pile.type && selection.pile.index === pile.index && selection.cardIndex === cardIndex) {
        setSelection(null);
        return;
      }
      tryMoveTo(pile);
      return;
    }
    const sourcePile =
      pile.type === 'tableau' ? state.tableau[pile.index] :
      pile.type === 'foundation' ? state.foundations[pile.index] :
      pile.type === 'waste' ? state.waste : state.stock;
    const card = sourcePile[cardIndex];
    if (!card || !card.faceUp) return;
    if (isTop && autoToFoundation(pile, cardIndex)) return;
    setSelection({ pile, cardIndex });
  }

  function handleStockClick() {
    if (autoRunning || won) return;
    setSelection(null);
    commit(drawFromStock(state, drawMode));
  }

  function showHint() {
    if (autoRunning || won) return;
    const h = findHint(state);
    if (!h) {
      toast.error('Nema dostupnih poteza — probaj da vuces iz stock-a ili nova partija.');
      return;
    }
    if (h.from.type === 'stock') {
      toast.info('Vuci kartu iz stock-a (gore levo).');
    }
    setHint(h);
  }

  // ── hint highlight helpers ────────────────────────────────────────────────
  const isSelected = (pile: PileRef, idx: number): boolean =>
    !!selection && selection.pile.type === pile.type && selection.pile.index === pile.index && selection.cardIndex === idx;

  const isHintSrc = (pile: PileRef, idx: number): boolean =>
    !!hint && hint.from.type !== 'stock' && hint.from.type === pile.type && hint.from.index === pile.index && hint.fromCardIndex === idx;

  const isHintDestPile = (pile: PileRef): boolean =>
    !!hint && hint.to.type === pile.type && hint.to.index === pile.index;

  const hintStock = !!hint && hint.from.type === 'stock';

  // waste fan: zadnjih do drawMode (3 za tesko, 1 inace) — samo vrh klikabilan
  const wasteFan = state.waste.slice(-(drawMode === 3 ? 3 : 1));
  const wasteFanBase = state.waste.length - wasteFan.length;

  return (
    <div className="w-full relative">
      {showCascade && <WinCascade cards={state.foundations.flat()} />}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatTime(elapsed)}</span>
          <span className="flex items-center gap-1.5"><MoveIcon className="h-4 w-4" /> {state.moves} poteza</span>
          {won && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <Trophy className="h-4 w-4" /> Score: {finalScore}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty segmented */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Tezina">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.hint}
                onClick={() => changeDifficulty(d.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  difficulty === d.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={undo} disabled={!history.length || autoRunning || won} title="Vrati potez">
            <Undo2 className="mr-1.5 h-4 w-4" /> Undo
          </Button>
          <Button variant="outline" size="sm" onClick={showHint} disabled={autoRunning || won || dealing} title="Predlozi potez">
            <Lightbulb className="mr-1.5 h-4 w-4" /> Hint
          </Button>
          {canAuto && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelection(null); setAutoRunning(true); }}
              className="text-emerald-600 border-emerald-400/50"
              title="Automatski zavrsi"
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> Auto-zavrsi
            </Button>
          )}
          <Button size="sm" onClick={() => regenerate(difficulty)} title="Nova partija">
            <RotateCw className="mr-1.5 h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {/* Dealing overlay */}
      {dealing && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Deljenje resive partije...
        </div>
      )}

      {!dealing && (
        <>
          {/* Top row: stock + waste + 4 foundations */}
          <div className="flex flex-wrap gap-3 mb-6 justify-center">
            <div
              onClick={handleStockClick}
              className={`cursor-pointer relative rounded-xl ${hintStock ? 'ring-2 ring-emerald-400 ring-offset-2 animate-pulse' : ''}`}
              style={{ width: CARD_W, height: CARD_H }}
            >
              {state.stock.length > 0 ? (
                <CardSvg suit="S" rank={1} faceUp={false} />
              ) : (
                <CardPlaceholder label="⟲" />
              )}
            </div>

            {/* Waste (fan za draw-3) */}
            <div className="relative" style={{ width: CARD_W + (wasteFan.length - 1) * 20, height: CARD_H }}>
              {state.waste.length === 0 ? (
                <CardPlaceholder label="Waste" />
              ) : (
                wasteFan.map((card, i) => {
                  const absIdx = wasteFanBase + i;
                  const isTopWaste = absIdx === state.waste.length - 1;
                  return (
                    <CardSvg
                      key={card.id}
                      suit={card.suit}
                      rank={card.rank}
                      faceUp
                      highlighted={isTopWaste && isSelected({ type: 'waste', index: 0 }, absIdx)}
                      hinted={isTopWaste && isHintSrc({ type: 'waste', index: 0 }, absIdx)}
                      style={{ position: 'absolute', left: i * 20, top: 0 }}
                      onClick={isTopWaste ? () => clickCard({ type: 'waste', index: 0 }, absIdx, true) : undefined}
                    />
                  );
                })
              )}
            </div>

            <div className="w-6" /> {/* spacer */}

            {FOUNDATION_ORDER.map((suit, i) => {
              const pile = state.foundations[i];
              const top = pile[pile.length - 1];
              const isEmpty = pile.length === 0;
              const destHint = isHintDestPile({ type: 'foundation', index: i });
              return (
                <div
                  key={suit}
                  className="relative cursor-pointer"
                  style={{ width: CARD_W, height: CARD_H }}
                  onClick={() => { if (selection) tryMoveTo({ type: 'foundation', index: i }); }}
                >
                  {isEmpty ? (
                    <CardPlaceholder label={suit} hinted={destHint} />
                  ) : top && (
                    <CardSvg
                      suit={top.suit}
                      rank={top.rank}
                      faceUp
                      hinted={destHint}
                      onClick={(e?: React.MouseEvent) => {
                        e?.stopPropagation();
                        clickCard({ type: 'foundation', index: i }, pile.length - 1, true);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tableau: 7 kolona, karte sa preklapanjem */}
          <div className="flex gap-3 justify-center">
            {state.tableau.map((col, colIdx) => {
              const destHint = isHintDestPile({ type: 'tableau', index: colIdx });
              return (
                <div
                  key={colIdx}
                  className="relative cursor-pointer"
                  style={{ width: CARD_W, minHeight: CARD_H + 28 * Math.max(col.length - 1, 0) }}
                  onClick={() => { if (col.length === 0 && selection) tryMoveTo({ type: 'tableau', index: colIdx }); }}
                >
                  {col.length === 0 ? (
                    <CardPlaceholder label="K" hinted={destHint} />
                  ) : (
                    col.map((card, rowIdx) => {
                      const isTop = rowIdx === col.length - 1;
                      return (
                        <CardSvg
                          key={card.id}
                          suit={card.suit}
                          rank={card.rank}
                          faceUp={card.faceUp}
                          highlighted={isSelected({ type: 'tableau', index: colIdx }, rowIdx)}
                          hinted={isHintSrc({ type: 'tableau', index: colIdx }, rowIdx) || (isTop && destHint)}
                          style={{ position: 'absolute', top: rowIdx * 28, left: 0 }}
                          onClick={(e?: React.MouseEvent) => {
                            e?.stopPropagation();
                            clickCard({ type: 'tableau', index: colIdx }, rowIdx, isTop);
                          }}
                        />
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Klik karta → klik ciljna gomila. Stock klik = vuci ({drawMode === 3 ? '3 karte' : '1 karta'}). Vrh karte (auto) ide u
            foundation. <span className="text-emerald-600">Hint</span> predlaze potez · <span className="text-amber-600">Undo</span> vraca.
          </p>
        </>
      )}

      {won && (
        <div className="mt-4 rounded-2xl border bg-emerald-500/10 p-4 text-center relative z-[60]">
          <p className="font-bold text-lg">🎉 Pobeda! Score: {finalScore}</p>
          <p className="text-sm text-muted-foreground">Vreme {formatTime(elapsed)} · {state.moves} poteza · {DIFFICULTIES.find((d) => d.id === difficulty)?.label}</p>
          <Button className="mt-3" onClick={() => regenerate(difficulty)}>
            <RotateCw className="mr-2 h-4 w-4" /> Nova partija
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
