import type { PublicGameState } from '../../../domain/public-game-state';

/**
 * Notifies everyone in the game's room. Each call carries the full public
 * state; the room is `state.roomCode`. Use cases call these in a fixed order
 * that clients rely on.
 */
export interface GameEvents {
  gameStarted(state: PublicGameState): void;
  cardFlipped(state: PublicGameState): void;
  scoreUpdated(state: PublicGameState): void;
  turnChanged(state: PublicGameState): void;
  cardsHidden(state: PublicGameState): void;
  gameFinished(state: PublicGameState): void;
  /** Sent after every change, so a client can render from it alone. */
  stateUpdated(state: PublicGameState): void;
}

export const GAME_EVENTS = Symbol('GAME_EVENTS');
