import { describe, it, expect } from 'vitest';
import {
  buildDeck,
  shuffle,
  newGame,
  drawFromStock,
  moveCard,
  isWon,
  computeScore,
  isRed,
  findHint,
  isAutoCompletable,
  autoCompleteStep,
  solve,
  type GameState,
  type Card,
  type Suit,
} from './engine';

// Helper: foundation gomila ranga 1..n za boju
function upto(s: Suit, n: number): Card[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${s}${i + 1}`, suit: s, rank: (i + 1) as Card['rank'], faceUp: true }));
}
// Helper: stanje gde su 4 kralja tableau-vrhovi, foundationi do Q — trivijalno auto-complete
function nearWonState(): GameState {
  return {
    tableau: [
      [{ id: 'S13', suit: 'S', rank: 13, faceUp: true }],
      [{ id: 'H13', suit: 'H', rank: 13, faceUp: true }],
      [{ id: 'D13', suit: 'D', rank: 13, faceUp: true }],
      [{ id: 'C13', suit: 'C', rank: 13, faceUp: true }],
      [], [], [],
    ],
    foundations: [upto('S', 12), upto('H', 12), upto('D', 12), upto('C', 12)],
    stock: [],
    waste: [],
    moves: 0,
    startedAt: Date.now(),
  };
}

describe('solitaire engine', () => {
  it('buildDeck() returns 52 unique cards', () => {
    const d = buildDeck();
    expect(d.length).toBe(52);
    const ids = new Set(d.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it('shuffle() preserves cards but changes order with seeded rng', () => {
    let i = 0;
    const rng = () => (i++ % 7) / 10; // deterministicki
    const a = shuffle([1, 2, 3, 4, 5], rng);
    expect(a.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('newGame() — tableau ima 1-7 karata po koloni, samo poslednja face-up', () => {
    const g = newGame(() => 0.5);
    for (let i = 0; i < 7; i++) {
      expect(g.tableau[i].length).toBe(i + 1);
      const top = g.tableau[i][g.tableau[i].length - 1];
      expect(top.faceUp).toBe(true);
      for (let j = 0; j < g.tableau[i].length - 1; j++) {
        expect(g.tableau[i][j].faceUp).toBe(false);
      }
    }
    expect(g.stock.length).toBe(52 - 28);
    expect(g.waste.length).toBe(0);
    expect(g.foundations.every((p) => p.length === 0)).toBe(true);
  });

  it('drawFromStock() — pomera top kartu stock-a u waste face-up', () => {
    const g = newGame(() => 0.5);
    const beforeStock = g.stock.length;
    const next = drawFromStock(g);
    expect(next.stock.length).toBe(beforeStock - 1);
    expect(next.waste.length).toBe(1);
    expect(next.waste[0].faceUp).toBe(true);
  });

  it('drawFromStock() — recikliranje waste kad je stock prazan', () => {
    const g: GameState = newGame(() => 0.5);
    // isprazni stock u waste
    let next = g;
    while (next.stock.length > 0) {
      next = drawFromStock(next);
    }
    expect(next.waste.length).toBeGreaterThan(0);
    const wasteLen = next.waste.length;
    next = drawFromStock(next);
    expect(next.stock.length).toBe(wasteLen);
    expect(next.waste.length).toBe(0);
  });

  it('moveCard() — kralj na prazno tableau polje radi', () => {
    const k: Card = { id: 'SK', suit: 'S', rank: 13, faceUp: true };
    const g: GameState = {
      tableau: [[k], [], [], [], [], [], []],
      foundations: [[], [], [], []],
      stock: [],
      waste: [],
      moves: 0,
      startedAt: Date.now(),
    };
    const next = moveCard(g, { type: 'tableau', index: 0 }, 0, { type: 'tableau', index: 1 });
    expect(next).not.toBeNull();
    expect(next!.tableau[0].length).toBe(0);
    expect(next!.tableau[1][0].id).toBe('SK');
  });

  it('moveCard() — As u prazan foundation kreira validnu sekvencu', () => {
    const a: Card = { id: 'H1', suit: 'H', rank: 1, faceUp: true };
    const g: GameState = {
      tableau: [[a], [], [], [], [], [], []],
      foundations: [[], [], [], []],
      stock: [],
      waste: [],
      moves: 0,
      startedAt: Date.now(),
    };
    const next = moveCard(g, { type: 'tableau', index: 0 }, 0, { type: 'foundation', index: 1 });
    expect(next).not.toBeNull();
    expect(next!.foundations[1][0].rank).toBe(1);
  });

  it('moveCard() — odbija pogresnu boju foundation-a', () => {
    const a: Card = { id: 'H1', suit: 'H', rank: 1, faceUp: true };
    const g: GameState = {
      tableau: [[a], [], [], [], [], [], []],
      foundations: [[], [], [], []],
      stock: [],
      waste: [],
      moves: 0,
      startedAt: Date.now(),
    };
    // foundation[0] = S (pik), pokušaj da stavimo srce — treba null
    const next = moveCard(g, { type: 'tableau', index: 0 }, 0, { type: 'foundation', index: 0 });
    expect(next).toBeNull();
  });

  it('isWon() — sve 4 foundation gomile imaju 13 karata', () => {
    const fullPile = (s: 'S' | 'H' | 'D' | 'C'): Card[] =>
      Array.from({ length: 13 }, (_, i) => ({ id: `${s}${i + 1}`, suit: s, rank: (i + 1) as Card['rank'], faceUp: true }));
    const g: GameState = {
      tableau: [[], [], [], [], [], [], []],
      foundations: [fullPile('S'), fullPile('H'), fullPile('D'), fullPile('C')],
      stock: [],
      waste: [],
      moves: 100,
      startedAt: Date.now() - 60000,
    };
    expect(isWon(g)).toBe(true);
    const score = computeScore(g, Date.now());
    expect(score).toBeGreaterThan(0);
  });

  it('isRed() — pravi razliku izmedju H/D (red) i S/C (black)', () => {
    expect(isRed('H')).toBe(true);
    expect(isRed('D')).toBe(true);
    expect(isRed('S')).toBe(false);
    expect(isRed('C')).toBe(false);
  });

  // ─── Tezine / hint / auto-complete / solver ───

  it('drawFromStock(state, 3) — vuce do 3 karte u waste, sve face-up', () => {
    const g = newGame(() => 0.5);
    const before = g.stock.length;
    const next = drawFromStock(g, 3);
    expect(next.stock.length).toBe(before - 3);
    expect(next.waste.length).toBe(3);
    expect(next.waste.every((c) => c.faceUp)).toBe(true);
  });

  it('findHint() — predlaze As (tableau vrh) u foundation', () => {
    const a: Card = { id: 'H1', suit: 'H', rank: 1, faceUp: true };
    const g: GameState = {
      tableau: [[a], [], [], [], [], [], []],
      foundations: [[], [], [], []],
      stock: [], waste: [], moves: 0, startedAt: Date.now(),
    };
    const h = findHint(g);
    expect(h).not.toBeNull();
    expect(h!.to.type).toBe('foundation');
  });

  it('findHint() — vraca stock-draw sentinel kad nema poteza na tabli', () => {
    const g: GameState = {
      tableau: [[], [], [], [], [], [], []],
      foundations: [[], [], [], []],
      stock: [{ id: 'C5', suit: 'C', rank: 5, faceUp: false }],
      waste: [], moves: 0, startedAt: Date.now(),
    };
    const h = findHint(g);
    expect(h).not.toBeNull();
    expect(h!.from.type).toBe('stock');
  });

  it('isAutoCompletable() + autoCompleteStep() — bez face-down karata zavrsava do pobede', () => {
    const g = nearWonState();
    expect(isAutoCompletable(g)).toBe(true);
    let st: GameState | null = g;
    let guard = 0;
    while (st && !isWon(st) && guard++ < 50) st = autoCompleteStep(st);
    expect(st).not.toBeNull();
    expect(isWon(st!)).toBe(true);
  });

  it('solve() — resi trivijalno-resivo (near-won) stanje u malom budzetu', () => {
    expect(solve(nearWonState(), 5000)).toBe(true);
  });

  it('solve() — vraca true za vec pobedjeno stanje', () => {
    const won: GameState = {
      tableau: [[], [], [], [], [], [], []],
      foundations: [upto('S', 13), upto('H', 13), upto('D', 13), upto('C', 13)],
      stock: [], waste: [], moves: 0, startedAt: Date.now(),
    };
    expect(solve(won, 100)).toBe(true);
  });
});
