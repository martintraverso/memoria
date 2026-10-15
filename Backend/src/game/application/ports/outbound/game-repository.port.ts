import type { RoomCode } from '../../../../shared/domain/room-code';
import type { Game } from '../../../domain/game';

/**
 * One game per room. Synchronous on purpose: each use case loads, changes
 * and saves a game without yielding the event loop, so two flips can't
 * interleave.
 */
export interface GameRepository {
  findByRoomCode(code: RoomCode): Game | null;
  save(game: Game): void;
}

export const GAME_REPOSITORY = Symbol('GAME_REPOSITORY');
