import { ConflictError } from '../../shared/domain/errors';
import { PlayerName } from './player-name';
import { RoomCode } from '../../shared/domain/room-code';

export type RoomStatus = 'lobby' | 'ready';

export const ROOM_CAPACITY = 2;

export interface RoomPlayer {
  readonly id: string;
  readonly name: string;
}

/**
 * A room holds up to two players. The creator is always `players[0]`.
 * Instances are immutable: `join()` returns a new Room.
 */
export class Room {
  readonly players: readonly RoomPlayer[];

  private constructor(
    readonly code: RoomCode,
    players: readonly RoomPlayer[],
  ) {
    this.players = Object.freeze(
      players.map((player) => Object.freeze({ ...player })),
    );
  }

  static create(code: RoomCode, creatorId: string, creatorName: string): Room {
    const name = PlayerName.parse(creatorName);
    return new Room(code, [{ id: creatorId, name: name.value }]);
  }

  /** Rebuilds a room from stored data without re-running creation rules. */
  static rehydrate(code: RoomCode, players: readonly RoomPlayer[]): Room {
    return new Room(code, players);
  }

  get status(): RoomStatus {
    return this.players.length === ROOM_CAPACITY ? 'ready' : 'lobby';
  }

  /** Seats are checked before the name, so a full room is a 409 even for a blank name. */
  join(playerId: string, playerName: string): Room {
    if (this.players.length >= ROOM_CAPACITY) {
      throw new ConflictError('La sala ya tiene 2 jugadores.');
    }
    const name = PlayerName.parse(playerName);
    return new Room(this.code, [
      ...this.players,
      { id: playerId, name: name.value },
    ]);
  }
}
