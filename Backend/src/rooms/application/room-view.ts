import type { Room, RoomStatus } from '../domain/room';

/** Plain data returned by the rooms use cases. */
export interface RoomView {
  code: string;
  status: RoomStatus;
  players: { id: string; name: string }[];
}

/** A room plus the id of the player who just entered it. */
export interface RoomMembership {
  room: RoomView;
  playerId: string;
}

export function toRoomView(room: Room): RoomView {
  return {
    code: room.code.value,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
    })),
  };
}
