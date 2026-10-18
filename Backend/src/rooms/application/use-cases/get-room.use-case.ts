import type { RoomRepository } from '../ports/outbound/room-repository.port';
import { RoomView, toRoomView } from '../room-view';
import { findRoomOrThrow } from './find-room';

export interface GetRoomInput {
  roomCode: string;
}

export class GetRoomUseCase {
  constructor(private readonly rooms: RoomRepository) {}

  execute(input: GetRoomInput): RoomView {
    return toRoomView(findRoomOrThrow(this.rooms, input.roomCode));
  }
}
