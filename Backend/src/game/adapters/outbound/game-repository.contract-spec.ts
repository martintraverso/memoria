import { RoomCode } from '../../../shared/domain/room-code';
import type { GameRepository } from '../../application/ports/outbound/game-repository.port';
import { Game } from '../../domain/game';

/** Starts a predictable 2x2 game: card-1/card-2 are img-1, card-3/card-4 img-2. */
export function startTestGame(roomCode = 'ABC234'): Game {
  let next = 0;
  return Game.start(
    {
      roomCode,
      roomStatus: 'ready',
      players: [
        { id: 'ana', name: 'Ana' },
        { id: 'beto', name: 'Beto' },
      ],
      requestedBy: 'ana',
      boardSize: 2,
    },
    { newCardId: () => `card-${++next}`, shuffle: (cards) => cards },
  );
}

/**
 * Behavior every GameRepository adapter must have. Run it from each adapter's
 * spec. (The `.contract-spec.ts` suffix keeps it out of the build and stops
 * Jest from running it on its own.)
 */
export function describeGameRepositoryContract(
  createRepository: () => GameRepository,
): void {
  describe('GameRepository contract', () => {
    const code = RoomCode.parse('ABC234');
    let repository: GameRepository;

    beforeEach(() => {
      repository = createRepository();
    });

    it('finds nothing for a room without a game', () => {
      expect(repository.findByRoomCode(code)).toBeNull();
    });

    it('finds a saved game by its room code', () => {
      const game = startTestGame();
      repository.save(game);

      expect(
        repository.findByRoomCode(RoomCode.parse('abc234'))?.toSnapshot(),
      ).toEqual(game.toSnapshot());
    });

    it('replaces a game when it is saved again', () => {
      const { game } = startTestGame().flip('ana', 'card-1');
      repository.save(startTestGame());
      repository.save(game);

      expect(repository.findByRoomCode(code)?.toSnapshot()).toEqual(
        game.toSnapshot(),
      );
    });

    it('keeps the full state, including hidden card values', () => {
      repository.save(startTestGame());

      expect(
        repository.findByRoomCode(code)?.cards.map((card) => card.value),
      ).toEqual(['img-1', 'img-1', 'img-2', 'img-2']);
    });

    it('keeps games of different rooms apart', () => {
      repository.save(startTestGame('ABC234'));
      repository.save(startTestGame('XYZ789').flip('ana', 'card-1').game);

      expect(repository.findByRoomCode(code)?.cards[0].state).toBe('hidden');
      expect(
        repository.findByRoomCode(RoomCode.parse('XYZ789'))?.cards[0].state,
      ).toBe('revealed');
    });
  });
}
