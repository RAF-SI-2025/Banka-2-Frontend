// Tipovi za Sobu za cekanje (igre + leaderboard) — dodato 14.05.2026 vece-5.
// Spec: Info o predmetu/2026-05-14-waiting-room-games-design.md

export type GameType = 'DINO' | 'SOLITAIRE' | 'CHESS' | 'BANKA2_RUSH';

export interface GameScore {
  id: number;
  clientId: number;
  playerName: string;
  gameType: GameType;
  score: number;
  createdAt: string;
  /** 1-based rank u leaderboard-u (popunjeno samo za /games/leaderboard). */
  rank?: number;
}

export interface SubmitScoreDto {
  gameType: GameType;
  score: number;
}

export const GAME_LABELS: Record<GameType, string> = {
  DINO: 'Bankar Dino',
  SOLITAIRE: 'Solitaire',
  CHESS: 'Šah',
  BANKA2_RUSH: 'Banka2Rush',
};

// NB: opisi igara zive u WaitingRoomHubPage `GAME_CARDS` (page-curated tekst +
// SVG ikonice) — jedini izvor istine za UI. Raniji `GAME_DESCRIPTIONS` map je
// uklonjen (bio dead-code i divergentan duplikat).
