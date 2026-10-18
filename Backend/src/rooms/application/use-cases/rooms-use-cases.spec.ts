import type { IdGenerator } from '../../../shared/application/ports/id-generator.port';
import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../../shared/domain/errors';
import { InMemoryRoomRepository } from '../../adapters/outbound/memory/in-memory-room.repository';
import { Room } from '../../domain/room';
import { RoomCode } from '../../../shared/domain/room-code';
import type { RoomCodeGenerator } from '../ports/outbound/room-code-generator.port';
import { CreateRoomUseCase } from './create-room.use-case';
import { GetRoomUseCase } from './get-room.use-case';
import { JoinRoomUseCase } from './join-room.use-case';

class SequentialIds implements IdGenerator {
  private next = 1;
  generate(): string {
    return `player-${this.next++}`;
  }
}

class ScriptedRoomCodes implements RoomCodeGenerator {
  constructor(private readonly codes: string[]) {}
  generate(): RoomCode {
    const code = this.codes.shift();
    if (!code) {
      throw new Error('No more scripted codes');
    }
    return RoomCode.parse(code);
  }
}

describe('rooms use cases', () => {
  let rooms: InMemoryRoomRepository;
  let ids: SequentialIds;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    ids = new SequentialIds();
  });

  function createRoom(codes = ['ABC234'], playerName = 'Ana') {
    return new CreateRoomUseCase(
      rooms,
      new ScriptedRoomCodes(codes),
      ids,
    ).execute({ playerName });
  }

  describe('CreateRoomUseCase', () => {
    it('saves a lobby room and returns it with the creator id', () => {
      const result = createRoom(['ABC234'], ' Ana ');

      expect(result).toEqual({
        room: {
          code: 'ABC234',
          status: 'lobby',
          players: [{ id: 'player-1', name: 'Ana' }],
        },
        playerId: 'player-1',
      });
      expect(rooms.findByCode(RoomCode.parse('ABC234'))?.players).toEqual([
        { id: 'player-1', name: 'Ana' },
      ]);
    });

    it('draws a new code until it finds an unused one', () => {
      rooms.save(Room.create(RoomCode.parse('TAKEN2'), 'x', 'Otro'));
      rooms.save(Room.create(RoomCode.parse('TAKEN3'), 'y', 'Otro'));

      const result = createRoom(['TAKEN2', 'TAKEN3', 'FREE45']);

      expect(result.room.code).toBe('FREE45');
    });

    it('saves nothing when the name is blank', () => {
      expect(() => createRoom(['ABC234'], ' ')).toThrow(InvalidInputError);
      expect(rooms.exists(RoomCode.parse('ABC234'))).toBe(false);
    });
  });

  describe('JoinRoomUseCase', () => {
    const joinRoom = (roomCode: string, playerName: string) =>
      new JoinRoomUseCase(rooms, ids).execute({ roomCode, playerName });

    it('adds the player, saves the ready room and returns the new player id', () => {
      createRoom(['ABC234']);

      const result = joinRoom(' abc234 ', 'Beto');

      expect(result).toEqual({
        room: {
          code: 'ABC234',
          status: 'ready',
          players: [
            { id: 'player-1', name: 'Ana' },
            { id: 'player-2', name: 'Beto' },
          ],
        },
        playerId: 'player-2',
      });
      expect(rooms.findByCode(RoomCode.parse('ABC234'))?.status).toBe('ready');
    });

    it('reports an unknown room before checking the name', () => {
      expect(() => joinRoom('ZZZZZZ', '')).toThrow(
        new NotFoundError('La sala no existe.'),
      );
    });

    it('rejects a blank code', () => {
      expect(() => joinRoom('  ', 'Beto')).toThrow(InvalidInputError);
    });

    it('rejects a full room and keeps the stored room unchanged', () => {
      createRoom(['ABC234']);
      joinRoom('ABC234', 'Beto');

      expect(() => joinRoom('ABC234', 'Caro')).toThrow(ConflictError);
      expect(rooms.findByCode(RoomCode.parse('ABC234'))?.players).toHaveLength(
        2,
      );
    });
  });

  describe('GetRoomUseCase', () => {
    const getRoom = (roomCode: string) =>
      new GetRoomUseCase(rooms).execute({ roomCode });

    it('finds a room by a normalized code', () => {
      const { room } = createRoom(['ABC234']);

      expect(getRoom(' abc234')).toEqual(room);
    });

    it('returns a copy that cannot change the stored room', () => {
      createRoom(['ABC234']);

      getRoom('ABC234').players.push({ id: 'intruder', name: 'X' });

      expect(getRoom('ABC234').players).toHaveLength(1);
    });

    it('reports an unknown room', () => {
      expect(() => getRoom('ZZZZZZ')).toThrow(
        new NotFoundError('La sala no existe.'),
      );
    });
  });
});
