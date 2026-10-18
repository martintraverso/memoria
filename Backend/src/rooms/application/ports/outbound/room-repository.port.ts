import type { Room } from '../../../domain/room';
import type { RoomCode } from '../../../../shared/domain/room-code';

/**
 * Synchronous on purpose: each use case loads, changes and saves a room
 * without yielding the event loop, so concurrent requests can't interleave.
 */
export interface RoomRepository {
  findByCode(code: RoomCode): Room | null;
  exists(code: RoomCode): boolean;
  save(room: Room): void;
}

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');
