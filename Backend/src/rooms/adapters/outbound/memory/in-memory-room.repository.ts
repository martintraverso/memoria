import type { RoomRepository } from '../../../application/ports/outbound/room-repository.port';
import type { Room } from '../../../domain/room';
import type { RoomCode } from '../../../../shared/domain/room-code';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();

  findByCode(code: RoomCode): Room | null {
    return this.rooms.get(code.value) ?? null;
  }

  exists(code: RoomCode): boolean {
    return this.rooms.has(code.value);
  }

  save(room: Room): void {
    this.rooms.set(room.code.value, room);
  }
}
