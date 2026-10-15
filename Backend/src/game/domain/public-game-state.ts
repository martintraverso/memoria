import type { CardState } from './board';
import type { Game, GameStatus } from './game';

/** What clients may see of a game. */
export interface PublicGameState {
  roomCode: string;
  boardSize: number;
  status: GameStatus;
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: { id: string; state: CardState; value: string }[];
  scores: { playerId: string; playerName: string; points: number }[];
  winnerPlayerId: string | null;
}

/**
 * Anti-cheat rule: a hidden card's value is replaced by an empty string, so
 * clients can't learn where the pairs are. Revealed, matched and blocked
 * values are public.
 */
export function toPublicGameState(game: Game): PublicGameState {
  return {
    roomCode: game.roomCode,
    boardSize: game.boardSize,
    status: game.status,
    players: game.players.map((player) => ({ ...player })),
    turnPlayerId: game.turnPlayerId,
    cards: game.cards.map((card) => ({
      id: card.id,
      state: card.state,
      value: card.state === 'hidden' ? '' : card.value,
    })),
    scores: game.scores.map((score) => ({ ...score })),
    winnerPlayerId: game.winnerPlayerId,
  };
}
