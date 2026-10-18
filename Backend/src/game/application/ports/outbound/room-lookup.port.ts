import type { RoomCode } from '../../../../shared/domain/room-code';

/** What the game needs to know about a room to start a match. */
export interface RoomForGame {
  code: string;
  status: 'lobby' | 'ready';
  /** In join order: the first player is the room creator. */
  players: { id: string; name: string }[];
}

export interface RoomLookup {
  /** Throws `NotFoundError('La sala no existe.')` for an unknown room. */
  getRoom(code: RoomCode): RoomForGame;
}

export const ROOM_LOOKUP = Symbol('ROOM_LOOKUP');
