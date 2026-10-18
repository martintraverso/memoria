import { InMemoryRoomRepository } from '../../../../rooms/adapters/outbound/memory/in-memory-room.repository';
import { GetRoomUseCase } from '../../../../rooms/application/use-cases/get-room.use-case';
import { Room } from '../../../../rooms/domain/room';
import { NotFoundError } from '../../../../shared/domain/errors';
import { RoomCode } from '../../../../shared/domain/room-code';
import { RoomsRoomLookup } from './rooms-room-lookup';

describe('RoomsRoomLookup', () => {
  const code = RoomCode.parse('ABC234');
  let rooms: InMemoryRoomRepository;
  let lookup: RoomsRoomLookup;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    lookup = new RoomsRoomLookup(new GetRoomUseCase(rooms));
  });

  it('maps a room from the rooms feature, keeping the join order', () => {
    rooms.save(Room.create(code, 'ana', 'Ana').join('beto', 'Beto'));

    expect(lookup.getRoom(code)).toEqual({
      code: 'ABC234',
      status: 'ready',
      players: [
        { id: 'ana', name: 'Ana' },
        { id: 'beto', name: 'Beto' },
      ],
    });
  });

  it('reports an unknown room as the rooms feature does', () => {
    expect(() => lookup.getRoom(code)).toThrow(
      new NotFoundError('La sala no existe.'),
    );
  });
});
