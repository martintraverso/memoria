import { ConflictError, InvalidInputError } from '../../shared/domain/errors';
import { Room } from './room';
import { RoomCode } from '../../shared/domain/room-code';

describe('Room', () => {
  const code = RoomCode.parse('ABC234');

  describe('create', () => {
    it('starts in lobby with the trimmed creator as the only player', () => {
      const room = Room.create(code, 'p1', '  Ana  ');

      expect(room.code).toBe(code);
      expect(room.status).toBe('lobby');
      expect(room.players).toEqual([{ id: 'p1', name: 'Ana' }]);
    });

    it.each(['', '   '])('rejects the creator name %p', (name) => {
      expect(() => Room.create(code, 'p1', name)).toThrow(
        new InvalidInputError('El nombre del jugador es obligatorio.'),
      );
    });
  });

  describe('join', () => {
    it('adds the second player after the creator and becomes ready', () => {
      const room = Room.create(code, 'p1', 'Ana').join('p2', ' Beto ');

      expect(room.status).toBe('ready');
      expect(room.players).toEqual([
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Beto' },
      ]);
    });

    it('returns a new room and leaves the original unchanged', () => {
      const lobby = Room.create(code, 'p1', 'Ana');

      const ready = lobby.join('p2', 'Beto');

      expect(ready).not.toBe(lobby);
      expect(lobby.status).toBe('lobby');
      expect(lobby.players).toHaveLength(1);
    });

    it('rejects a third player', () => {
      const full = Room.create(code, 'p1', 'Ana').join('p2', 'Beto');

      expect(() => full.join('p3', 'Caro')).toThrow(
        new ConflictError('La sala ya tiene 2 jugadores.'),
      );
    });

    it('checks the free seat before the name', () => {
      const full = Room.create(code, 'p1', 'Ana').join('p2', 'Beto');

      expect(() => full.join('p3', '  ')).toThrow(ConflictError);
    });

    it('rejects a blank name when there is a free seat', () => {
      const lobby = Room.create(code, 'p1', 'Ana');

      expect(() => lobby.join('p2', '  ')).toThrow(InvalidInputError);
    });
  });

  it('cannot be mutated from outside', () => {
    const room = Room.create(code, 'p1', 'Ana');

    expect(Object.isFrozen(room.players)).toBe(true);
    expect(Object.isFrozen(room.players[0])).toBe(true);
  });

  it('rehydrates stored players without re-validating them', () => {
    const players = [
      { id: 'p1', name: 'Ana' },
      { id: 'p2', name: 'Beto' },
    ];

    const room = Room.rehydrate(code, players);

    expect(room.status).toBe('ready');
    expect(room.players).toEqual(players);
    expect(room.players).not.toBe(players);
  });
});
