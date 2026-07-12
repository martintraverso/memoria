export type GameStatus = 'playing' | 'finished';

export type GameCardState = 'hidden' | 'revealed' | 'matched' | 'blocked';

export interface GameCard {
  id: string;
  value: string;
  state: GameCardState;
}

export interface GamePlayerScore {
  playerId: string;
  playerName: string;
  points: number;
}

export interface GameState {
  roomCode: string;
  boardSize: number;
  status: GameStatus;
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: GameCard[];
  scores: GamePlayerScore[];
  winnerPlayerId: string | null;
}

export interface FlipResult {
  state: GameState;
  scoreChanged: boolean;
  turnChanged: boolean;
  finished: boolean;
  mismatchPending: boolean;
}
