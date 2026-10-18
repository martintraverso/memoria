import type { IdGenerator } from '../../../shared/application/ports/id-generator.port';
import { Room } from '../../domain/room';
import type { RoomCode } from '../../../shared/domain/room-code';
import type { RoomCodeGenerator } from '../ports/outbound/room-code-generator.port';
import type { RoomRepository } from '../ports/outbound/room-repository.port';
import { RoomMembership, toRoomView } from '../room-view';

export interface CreateRoomInput {
  playerName: string;
}

export class CreateRoomUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly roomCodes: RoomCodeGenerator,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: CreateRoomInput): RoomMembership {
    const playerId = this.ids.generate();
    const room = Room.create(this.newUniqueCode(), playerId, input.playerName);
    this.rooms.save(room);
    return { room: toRoomView(room), playerId };
  }

  private newUniqueCode(): RoomCode {
    let code: RoomCode;
    do {
      code = this.roomCodes.generate();
    } while (this.rooms.exists(code));
    return code;
  }
}
