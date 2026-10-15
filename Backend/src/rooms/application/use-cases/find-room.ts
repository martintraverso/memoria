import { NotFoundError } from '../../../shared/domain/errors';
import type { Room } from '../../domain/room';
import { RoomCode } from '../../../shared/domain/room-code';
import type { RoomRepository } from '../ports/outbound/room-repository.port';

export function findRoomOrThrow(
  rooms: RoomRepository,
  rawRoomCode: string,
): Room {
  const room = rooms.findByCode(RoomCode.parse(rawRoomCode));
  if (!room) {
    throw new NotFoundError('La sala no existe.');
  }
  return room;
}
