import { NotFoundError } from '../../../shared/domain/errors';
import { RoomCode } from '../../../shared/domain/room-code';
import type { Game } from '../../domain/game';
import type { GameRepository } from '../ports/outbound/game-repository.port';

export function findGameOrThrow(
  games: GameRepository,
  rawRoomCode: string,
): Game {
  const game = games.findByRoomCode(RoomCode.parse(rawRoomCode));
  if (!game) {
    throw new NotFoundError('No hay partida activa para esta sala.');
  }
  return game;
}
