import type { RoomCode } from '../../../../shared/domain/room-code';
import type { GameRepository } from '../../../application/ports/outbound/game-repository.port';
import type { Game } from '../../../domain/game';

export class InMemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();

  findByRoomCode(code: RoomCode): Game | null {
    return this.games.get(code.value) ?? null;
  }

  save(game: Game): void {
    this.games.set(game.roomCode, game);
  }
}
