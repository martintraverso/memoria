import { RoomCode } from '../../../shared/domain/room-code';
import {
  PublicGameState,
  toPublicGameState,
} from '../../domain/public-game-state';
import type { GameRepository } from '../ports/outbound/game-repository.port';
import { findGameOrThrow } from './find-game';

export interface GetGameStateInput {
  roomCode: string;
}

export class GetGameStateUseCase {
  constructor(private readonly games: GameRepository) {}

  /** Throws `NotFoundError` when the room has no game. */
  execute(input: GetGameStateInput): PublicGameState {
    return toPublicGameState(findGameOrThrow(this.games, input.roomCode));
  }

  /** Returns null when the room has no game. */
  find(input: GetGameStateInput): PublicGameState | null {
    const game = this.games.findByRoomCode(RoomCode.parse(input.roomCode));
    return game ? toPublicGameState(game) : null;
  }
}
