import type { IdGenerator } from '../../../shared/application/ports/id-generator.port';
import type { RoomRepository } from '../ports/outbound/room-repository.port';
import { RoomMembership, toRoomView } from '../room-view';
import { findRoomOrThrow } from './find-room';

export interface JoinRoomInput {
  roomCode: string;
  playerName: string;
}

export class JoinRoomUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: JoinRoomInput): RoomMembership {
    const room = findRoomOrThrow(this.rooms, input.roomCode);
    const playerId = this.ids.generate();
    const joined = room.join(playerId, input.playerName);
    this.rooms.save(joined);
    return { room: toRoomView(joined), playerId };
  }
}
