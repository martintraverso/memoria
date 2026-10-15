import type { RoomRepository } from '../../application/ports/outbound/room-repository.port';
import { Room } from '../../domain/room';
import { RoomCode } from '../../../shared/domain/room-code';

/**
 * Behavior every RoomRepository adapter must have. Run it from each adapter's
 * spec. (The `.contract-spec.ts` suffix keeps it out of the build and stops
 * Jest from running it on its own.)
 */
export function describeRoomRepositoryContract(
  createRepository: () => RoomRepository,
): void {
  describe('RoomRepository contract', () => {
    const code = RoomCode.parse('ABC234');
    let repository: RoomRepository;

    beforeEach(() => {
      repository = createRepository();
    });

    it('finds nothing for an unknown code', () => {
      expect(repository.findByCode(code)).toBeNull();
      expect(repository.exists(code)).toBe(false);
    });

    it('finds a saved room by an equal code', () => {
      repository.save(Room.create(code, 'p1', 'Ana'));

      const found = repository.findByCode(RoomCode.parse('abc234'));
      expect(found?.code.value).toBe('ABC234');
      expect(found?.players).toEqual([{ id: 'p1', name: 'Ana' }]);
      expect(repository.exists(RoomCode.parse('ABC234'))).toBe(true);
    });

    it('replaces a room when it is saved again', () => {
      const lobby = Room.create(code, 'p1', 'Ana');
      repository.save(lobby);
      repository.save(lobby.join('p2', 'Beto'));

      expect(repository.findByCode(code)?.status).toBe('ready');
      expect(repository.findByCode(code)?.players).toHaveLength(2);
    });

    it('keeps rooms apart', () => {
      repository.save(Room.create(code, 'p1', 'Ana'));
      repository.save(Room.create(RoomCode.parse('XYZ789'), 'p2', 'Beto'));

      expect(repository.findByCode(code)?.players[0].name).toBe('Ana');
      expect(
        repository.findByCode(RoomCode.parse('XYZ789'))?.players[0].name,
      ).toBe('Beto');
    });
  });
}
