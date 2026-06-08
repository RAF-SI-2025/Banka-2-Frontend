// Pure Klondike Solitaire engine — bez React zavisnosti, lako testabilno.
//
// Tipovi: 4 boje (S/H/D/C), 13 rangova (A-K). Standardni Klondike layout:
// 7 tableau kolona (1, 2, ..., 7 karata; samo poslednja okrenuta), 1 stock pile,
// 1 waste pile, 4 foundation slot-a (jedan po boji).

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: string; // npr "H7" (sedmica srca), "SK" (kralj pik)
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type PileType = 'tableau' | 'foundation' | 'waste' | 'stock';

export interface PileRef {
  type: PileType;
  /** index za tableau (0-6) ili foundation (0-3); za stock/waste je 0 */
  index: number;
}

export interface GameState {
  tableau: Card[][]; // 7 kolona
  foundations: Card[][]; // 4 sloga (S/H/D/C — redom)
  stock: Card[];
  waste: Card[];
  moves: number;
  startedAt: number;
}

export const RED_SUITS: ReadonlySet<Suit> = new Set(['H', 'D']);
export const FOUNDATION_ORDER: readonly Suit[] = ['S', 'H', 'D', 'C'];

export function isRed(suit: Suit): boolean {
  return RED_SUITS.has(suit);
}

export function buildDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const deck: Card[] = [];
  for (const s of suits) {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: `${s}${r}`, suit: s, rank: r as Rank, faceUp: false });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function newGame(rng: () => number = Math.random): GameState {
  const deck = shuffle(buildDeck(), rng);
  const tableau: Card[][] = [[], [], [], [], [], [], []];
  let cursor = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[cursor++] };
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    foundations: [[], [], [], []],
    stock,
    waste: [],
    moves: 0,
    startedAt: Date.now(),
  };
}

/** Broj karata po izvlacenju: 1 (lako) ili 3 (tesko). */
export type DrawMode = 1 | 3;

export function drawFromStock(state: GameState, drawCount: DrawMode = 1): GameState {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return state;
    // recikliraj waste u stock (poredak ocuvan: vrh waste-a postaje dno stock-a)
    const newStock = state.waste.slice().reverse().map((c) => ({ ...c, faceUp: false }));
    return { ...state, stock: newStock, waste: [], moves: state.moves + 1 };
  }
  const stock = state.stock.slice();
  // Izvuci do `drawCount` karata; sve face-up, poslednja izvucena je vrh waste-a.
  const drawn: Card[] = [];
  for (let i = 0; i < drawCount && stock.length > 0; i++) {
    drawn.push({ ...stock.pop()!, faceUp: true });
  }
  const waste = [...state.waste, ...drawn];
  return { ...state, stock, waste, moves: state.moves + 1 };
}

/** Move single card or sequence; returns null ako move nije validan. */
export function moveCard(state: GameState, from: PileRef, fromCardIndex: number, to: PileRef): GameState | null {
  const sourcePile = getPile(state, from);
  if (!sourcePile || fromCardIndex < 0 || fromCardIndex >= sourcePile.length) return null;
  const moving = sourcePile.slice(fromCardIndex);
  if (moving.some((c) => !c.faceUp)) return null;

  if (!canPlaceOn(moving, getPile(state, to), to)) return null;

  // klonira state
  const tableau = state.tableau.map((c) => c.slice());
  const foundations = state.foundations.map((c) => c.slice());
  let waste = state.waste.slice();

  // ukloni iz source
  if (from.type === 'tableau') {
    tableau[from.index] = tableau[from.index].slice(0, fromCardIndex);
    // okreni novu top-kartu ako postoji i jos je face-down
    const top = tableau[from.index][tableau[from.index].length - 1];
    if (top && !top.faceUp) top.faceUp = true;
  } else if (from.type === 'foundation') {
    foundations[from.index] = foundations[from.index].slice(0, fromCardIndex);
  } else if (from.type === 'waste') {
    waste = waste.slice(0, fromCardIndex);
  }

  // dodaj u destination
  if (to.type === 'tableau') {
    tableau[to.index] = [...tableau[to.index], ...moving];
  } else if (to.type === 'foundation') {
    if (moving.length !== 1) return null;
    foundations[to.index] = [...foundations[to.index], ...moving];
  }

  return {
    ...state,
    tableau,
    foundations,
    waste,
    moves: state.moves + 1,
  };
}

function getPile(state: GameState, ref: PileRef): Card[] | null {
  if (ref.type === 'tableau') return state.tableau[ref.index] ?? null;
  if (ref.type === 'foundation') return state.foundations[ref.index] ?? null;
  if (ref.type === 'waste') return state.waste;
  if (ref.type === 'stock') return state.stock;
  return null;
}

function canPlaceOn(moving: Card[], destPile: Card[] | null, dest: PileRef): boolean {
  if (!destPile) return false;
  const first = moving[0];
  if (dest.type === 'foundation') {
    if (moving.length !== 1) return false;
    const expectedSuit = FOUNDATION_ORDER[dest.index];
    if (first.suit !== expectedSuit) return false;
    const top = destPile[destPile.length - 1];
    if (!top) return first.rank === 1; // mora biti as
    return first.rank === top.rank + 1;
  }
  if (dest.type === 'tableau') {
    const top = destPile[destPile.length - 1];
    if (!top) return first.rank === 13; // prazan tableau prima samo kralja
    if (!top.faceUp) return false;
    if (isRed(first.suit) === isRed(top.suit)) return false;
    return first.rank === top.rank - 1;
  }
  return false;
}

export function isWon(state: GameState): boolean {
  return state.foundations.every((p) => p.length === 13);
}

/** Score: 100 ako pobeda, plus bonus za malo poteza i kratko vreme. */
export function computeScore(state: GameState, endedAt: number): number {
  if (!isWon(state)) return 0;
  const seconds = Math.max(1, Math.floor((endedAt - state.startedAt) / 1000));
  const movesPenalty = Math.min(state.moves * 2, 400);
  const timePenalty = Math.min(seconds, 600);
  return Math.max(100, 2000 - movesPenalty - timePenalty);
}

// ─── Tezine / hint / auto-complete / solver ─────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Predlozen potez (za hint i auto-complete). {@code from.type==='stock'} = "vuci iz stock-a". */
export interface Move {
  from: PileRef;
  fromCardIndex: number;
  to: PileRef;
}

function foundationIndexForSuit(suit: Suit): number {
  return FOUNDATION_ORDER.indexOf(suit);
}

/** Vraca foundation index na koji karta moze da ide, ili null. */
function foundationDestFor(state: GameState, card: Card): number | null {
  const fi = foundationIndexForSuit(card.suit);
  const pile = state.foundations[fi];
  const top = pile[pile.length - 1];
  if (!top) return card.rank === 1 ? fi : null;
  return card.rank === top.rank + 1 ? fi : null;
}

/** Index prve face-up karte u koloni (pocetak face-up run-a), ili -1 ako je prazna. */
function faceUpRunStart(col: Card[]): number {
  for (let i = 0; i < col.length; i++) if (col[i].faceUp) return i;
  return -1;
}

/**
 * Heuristicki hint — vraca prvi "produktivan" potez po prioritetu:
 * (1) tableau→tableau koji okrece face-down kartu, (2) tableau/waste vrh → foundation,
 * (3) waste → tableau, (4) tableau → tableau (kralj na prazno / konsolidacija),
 * (5) vuci iz stock-a (sentinel {@code from.type==='stock'}). null ako nema poteza.
 */
export function findHint(state: GameState): Move | null {
  // (1) otkrij face-down kartu pomeranjem face-up run-a kolone
  for (let c = 0; c < 7; c++) {
    const rs = faceUpRunStart(state.tableau[c]);
    if (rs <= 0) continue; // rs<=0 → nema face-down ispod
    for (let d = 0; d < 7; d++) {
      if (d === c) continue;
      const from: PileRef = { type: 'tableau', index: c };
      const to: PileRef = { type: 'tableau', index: d };
      if (moveCard(state, from, rs, to)) return { from, fromCardIndex: rs, to };
    }
  }
  // (2) tableau vrh / waste vrh → foundation
  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    if (!col.length) continue;
    const fi = foundationDestFor(state, col[col.length - 1]);
    if (fi !== null) return { from: { type: 'tableau', index: c }, fromCardIndex: col.length - 1, to: { type: 'foundation', index: fi } };
  }
  if (state.waste.length) {
    const fi = foundationDestFor(state, state.waste[state.waste.length - 1]);
    if (fi !== null) return { from: { type: 'waste', index: 0 }, fromCardIndex: state.waste.length - 1, to: { type: 'foundation', index: fi } };
  }
  // (3) waste → tableau
  if (state.waste.length) {
    const wi = state.waste.length - 1;
    for (let d = 0; d < 7; d++) {
      const to: PileRef = { type: 'tableau', index: d };
      if (moveCard(state, { type: 'waste', index: 0 }, wi, to)) return { from: { type: 'waste', index: 0 }, fromCardIndex: wi, to };
    }
  }
  // (4) tableau → tableau (kralj na prazno / konsolidacija) — ne predlazi jalov king-shuffle
  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    const rs = faceUpRunStart(col);
    if (rs < 0) continue;
    for (let d = 0; d < 7; d++) {
      if (d === c) continue;
      if (rs === 0 && state.tableau[d].length === 0) continue; // cela kolona → prazna: jalovo
      const from: PileRef = { type: 'tableau', index: c };
      const to: PileRef = { type: 'tableau', index: d };
      if (moveCard(state, from, rs, to)) return { from, fromCardIndex: rs, to };
    }
  }
  // (5) vuci iz stock-a
  if (state.stock.length > 0 || state.waste.length > 0) {
    return { from: { type: 'stock', index: 0 }, fromCardIndex: 0, to: { type: 'stock', index: 0 } };
  }
  return null;
}

/** Da li se partija moze automatski zavrsiti — nema vise face-down karata u tableau-u. */
export function isAutoCompletable(state: GameState): boolean {
  if (isWon(state)) return false;
  return state.tableau.every((col) => col.every((c) => c.faceUp));
}

/**
 * Jedan korak auto-complete-a: promovise prvu tableau/waste vrh kartu u foundation;
 * ako nema takve, vuce iz stock-a. Vraca null kad nema vise sta (gotovo/zaglavljeno).
 * UI ga poziva u petlji sa kratkim delay-em za "lete u foundation" animaciju.
 */
export function autoCompleteStep(state: GameState): GameState | null {
  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    if (!col.length) continue;
    const fi = foundationDestFor(state, col[col.length - 1]);
    if (fi !== null) {
      const next = moveCard(state, { type: 'tableau', index: c }, col.length - 1, { type: 'foundation', index: fi });
      if (next) return next;
    }
  }
  if (state.waste.length) {
    const fi = foundationDestFor(state, state.waste[state.waste.length - 1]);
    if (fi !== null) {
      const next = moveCard(state, { type: 'waste', index: 0 }, state.waste.length - 1, { type: 'foundation', index: fi });
      if (next) return next;
    }
  }
  if (state.stock.length > 0 || state.waste.length > 0) {
    return drawFromStock(state, 1);
  }
  return null;
}

// ── Solver (bounded DFS) — koristi se za "Lako" garantovano-resive deal-ove ──

function hashState(s: GameState): string {
  const t = s.tableau.map((col) => col.map((c) => c.id + (c.faceUp ? 'u' : 'd')).join(',')).join('|');
  const f = s.foundations.map((p) => p.length).join(',');
  const st = s.stock.map((c) => c.id).join(',');
  const w = s.waste.map((c) => c.id).join(',');
  return `${t}#${f}#${st}#${w}`;
}

/** Naslednici stanja u prioritetnom redosledu (najbolji prvi): foundation, reveal, waste→tab, tab→tab, draw. */
function successors(s: GameState): GameState[] {
  const foundationMoves: GameState[] = [];
  const reveals: GameState[] = [];
  const tableauMoves: GameState[] = [];
  const wasteMoves: GameState[] = [];

  for (let c = 0; c < 7; c++) {
    const col = s.tableau[c];
    if (!col.length) continue;
    const fi = foundationDestFor(s, col[col.length - 1]);
    if (fi !== null) {
      const nx = moveCard(s, { type: 'tableau', index: c }, col.length - 1, { type: 'foundation', index: fi });
      if (nx) foundationMoves.push(nx);
    }
  }
  if (s.waste.length) {
    const fi = foundationDestFor(s, s.waste[s.waste.length - 1]);
    if (fi !== null) {
      const nx = moveCard(s, { type: 'waste', index: 0 }, s.waste.length - 1, { type: 'foundation', index: fi });
      if (nx) foundationMoves.push(nx);
    }
  }
  for (let c = 0; c < 7; c++) {
    const col = s.tableau[c];
    const rs = faceUpRunStart(col);
    if (rs < 0) continue;
    for (let i = rs; i < col.length; i++) {
      for (let d = 0; d < 7; d++) {
        if (d === c) continue;
        if (i === rs && rs === 0 && s.tableau[d].length === 0) continue; // jalov full-column shuffle
        const nx = moveCard(s, { type: 'tableau', index: c }, i, { type: 'tableau', index: d });
        if (!nx) continue;
        if (i === rs && rs > 0) reveals.push(nx);
        else tableauMoves.push(nx);
      }
    }
  }
  if (s.waste.length) {
    for (let d = 0; d < 7; d++) {
      const nx = moveCard(s, { type: 'waste', index: 0 }, s.waste.length - 1, { type: 'tableau', index: d });
      if (nx) wasteMoves.push(nx);
    }
  }
  const drawn = s.stock.length > 0 || s.waste.length > 0 ? drawFromStock(s, 1) : null;
  const draws = drawn && hashState(drawn) !== hashState(s) ? [drawn] : [];

  return [...foundationMoves, ...reveals, ...wasteMoves, ...tableauMoves, ...draws];
}

/**
 * Bounded DFS provera resivosti (draw-1). Vraca true ako je pronadjena pobeda u
 * okviru {@code nodeBudget} obidjenih stanja, inace false (konzervativno —
 * tezak/neresiv deal). Move-ordering (foundation/reveal prvo) + visited-set.
 */
export function solve(initial: GameState, nodeBudget = 40000): boolean {
  const visited = new Set<string>();
  const stack: GameState[] = [initial];
  let nodes = 0;
  while (stack.length) {
    const st = stack.pop()!;
    if (isWon(st)) return true;
    if (nodes++ > nodeBudget) return false;
    const key = hashState(st);
    if (visited.has(key)) continue;
    visited.add(key);
    const succ = successors(st);
    // push najgori prvi → najbolji (succ[0]) ostaje na vrhu stack-a (DFS best-first)
    for (let i = succ.length - 1; i >= 0; i--) stack.push(succ[i]);
  }
  return false;
}

/**
 * Deli novu partiju koju solver moze da resi (garantovano-resiv "Lako" deal).
 * Reshuffle do {@code retries} puta; fallback na poslednji deal ako nijedan nije
 * potvrdjen u budzetu (i dalje igriv uz undo/hint). Tipicno se resi iz 1-3 pokusaja.
 */
export function newWinnableGame(rng: () => number = Math.random, retries = 20, nodeBudget = 40000): GameState {
  let last = newGame(rng);
  for (let i = 0; i < retries; i++) {
    const g = newGame(rng);
    if (solve(g, nodeBudget)) return g;
    last = g;
  }
  return last;
}
