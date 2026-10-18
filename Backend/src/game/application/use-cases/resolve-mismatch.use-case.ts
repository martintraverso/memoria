import { RoomCode } from '../../../shared/domain/room-code';
import {
  PublicGameState,
  toPublicGameState,
} from '../../domain/public-game-state';
import type { GameEvents } from '../ports/outbound/game-events.port';
import type { GameRepository } from '../ports/outbound/game-repository.port';

export interface ResolveMismatchInput {
  roomCode: string;
}

export class ResolveMismatchUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEvents,
  ) {}

  /** Returns null, and notifies nobody, when there is nothing to resolve. */
  execute(input: ResolveMismatchInput): PublicGameState | null {
    const game = this.games.findByRoomCode(RoomCode.parse(input.roomCode));
    if (!game?.hasPendingMismatch) {
      return null;
    }

    const resolved = game.resolveMismatch();
    this.games.save(resolved);

    const state = toPublicGameState(resolved);
    this.events.cardsHidden(state);
    this.events.turnChanged(state);
    this.events.stateUpdated(state);
    return state;
  }
}
