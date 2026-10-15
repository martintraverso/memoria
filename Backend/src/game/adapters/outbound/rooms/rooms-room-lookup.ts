import type { GetRoomUseCase } from '../../../../rooms/application/use-cases/get-room.use-case';
import type { RoomCode } from '../../../../shared/domain/room-code';
import type {
  RoomForGame,
  RoomLookup,
} from '../../../application/ports/outbound/room-lookup.port';

/**
 * Reads rooms through the rooms feature's public use case. This is the only
 * place in `game/` that knows about the rooms feature.
 */
export class RoomsRoomLookup implements RoomLookup {
  constructor(private readonly getRoomUseCase: GetRoomUseCase) {}

  getRoom(code: RoomCode): RoomForGame {
    const room = this.getRoomUseCase.execute({ roomCode: code.value });
    return {
      code: room.code,
      status: room.status,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
      })),
    };
  }
}
