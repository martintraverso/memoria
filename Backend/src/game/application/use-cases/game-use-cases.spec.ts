import type { IdGenerator } from '../../../shared/application/ports/id-generator.port';
import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../../shared/domain/errors';
import { RoomCode } from '../../../shared/domain/room-code';
import { InMemoryGameRepository } from '../../adapters/outbound/memory/in-memory-game.repository';
import type { PublicGameState } from '../../domain/public-game-state';
import type { GameEvents } from '../ports/outbound/game-events.port';
import type { MismatchScheduler } from '../ports/outbound/mismatch-scheduler.port';
import type {
  RoomForGame,
  RoomLookup,
} from '../ports/outbound/room-lookup.port';
import type { Shuffler } from '../ports/outbound/shuffler.port';
import { FlipCardUseCase, MISMATCH_REVEAL_MS } from './flip-card.use-case';
import { GetGameStateUseCase } from './get-game-state.use-case';
import { ResolveMismatchUseCase } from './resolve-mismatch.use-case';
import { StartGameUseCase } from './start-game.use-case';

class SequentialIds implements IdGenerator {
  private next = 0;
  generate(): string {
    return `card-${++this.next}`;
  }
}

/** Keeps the dealt order: card-1/card-2 are img-1, card-3/card-4 img-2… */
const noShuffle: Shuffler = { shuffle: (items) => [...items] };

class FakeRoomLookup implements RoomLookup {
  readonly rooms = new Map<string, RoomForGame>();

  getRoom(code: RoomCode): RoomForGame {
    const room = this.rooms.get(code.value);
    if (!room) {
      throw new NotFoundError('La sala no existe.');
    }
    return room;
  }
}

class RecordingEvents implements GameEvents {
  readonly sent: { event: keyof GameEvents; state: PublicGameState }[] = [];

  names(): (keyof GameEvents)[] {
    return this.sent.map((item) => item.event);
  }

  clear(): void {
    this.sent.length = 0;
  }

  gameStarted = (state: PublicGameState) => this.record('gameStarted', state);
  cardFlipped = (state: PublicGameState) => this.record('cardFlipped', state);
  scoreUpdated = (state: PublicGameState) => this.record('scoreUpdated', state);
  turnChanged = (state: PublicGameState) => this.record('turnChanged', state);
  cardsHidden = (state: PublicGameState) => this.record('cardsHidden', state);
  gameFinished = (state: PublicGameState) => this.record('gameFinished', state);
  stateUpdated = (state: PublicGameState) => this.record('stateUpdated', state);

  private record(event: keyof GameEvents, state: PublicGameState): void {
    this.sent.push({ event, state });
  }
}

/** Keeps scheduled tasks until the test runs them. */
class ManualScheduler implements MismatchScheduler {
  readonly pending = new Map<string, { delayMs: number; task: () => void }>();

  schedule(roomCode: string, delayMs: number, task: () => void): void {
    this.pending.set(roomCode, { delayMs, task });
  }

  run(roomCode: string): void {
    const entry = this.pending.get(roomCode);
    this.pending.delete(roomCode);
    entry?.task();
  }
}

describe('game use cases', () => {
  let rooms: FakeRoomLookup;
  let games: InMemoryGameRepository;
  let events: RecordingEvents;
  let scheduler: ManualScheduler;
  let startGame: StartGameUseCase;
  let flipCard: FlipCardUseCase;
  let resolveMismatch: ResolveMismatchUseCase;
  let getGameState: GetGameStateUseCase;

  beforeEach(() => {
    rooms = new FakeRoomLookup();
    rooms.rooms.set('ABC234', {
      code: 'ABC234',
      status: 'ready',
      players: [
        { id: 'ana', name: 'Ana' },
        { id: 'beto', name: 'Beto' },
      ],
    });
    games = new InMemoryGameRepository();
    events = new RecordingEvents();
    scheduler = new ManualScheduler();
    startGame = new StartGameUseCase(
      rooms,
      games,
      new SequentialIds(),
      noShuffle,
      events,
    );
    resolveMismatch = new ResolveMismatchUseCase(games, events);
    flipCard = new FlipCardUseCase(games, events, scheduler, resolveMismatch);
    getGameState = new GetGameStateUseCase(games);
  });

  const stored = () => games.findByRoomCode(RoomCode.parse('ABC234'));
  const start = (boardSize = 2) =>
    startGame.execute({ roomCode: ' abc234 ', playerId: 'ana', boardSize });
  const flip = (playerId: string, cardId: string) =>
    flipCard.execute({ roomCode: 'abc234', playerId, cardId });

  describe('StartGameUseCase', () => {
    it('deals the board with the id generator and shuffler, saves it and hides the values', () => {
      const state = start();

      expect(state.roomCode).toBe('ABC234');
      expect(state.turnPlayerId).toBe('ana');
      expect(state.cards).toEqual([
        { id: 'card-1', state: 'hidden', value: '' },
        { id: 'card-2', state: 'hidden', value: '' },
        { id: 'card-3', state: 'hidden', value: '' },
        { id: 'card-4', state: 'hidden', value: '' },
      ]);
      expect(stored()?.cards.map((card) => card.value)).toEqual([
        'img-1',
        'img-1',
        'img-2',
        'img-2',
      ]);
    });

    it('applies the shuffler to the dealt cards', () => {
      startGame = new StartGameUseCase(
        rooms,
        games,
        new SequentialIds(),
        { shuffle: (items) => [...items].reverse() },
        events,
      );

      expect(start().cards.map((card) => card.id)).toEqual([
        'card-4',
        'card-3',
        'card-2',
        'card-1',
      ]);
    });

    it('returns the existing game instead of starting a new one', () => {
      const first = start(2);
      flip('ana', 'card-1');

      const again = start(4);

      expect(again.boardSize).toBe(2);
      expect(again.cards).toHaveLength(first.cards.length);
      expect(again.cards[0].state).toBe('revealed');
    });

    it('still validates the request when the game exists', () => {
      start();

      expect(() =>
        startGame.execute({
          roomCode: 'ABC234',
          playerId: 'beto',
          boardSize: 2,
        }),
      ).toThrow(ConflictError);
    });

    it('reports an unknown room', () => {
      expect(() =>
        startGame.execute({
          roomCode: 'ZZZZZZ',
          playerId: 'ana',
          boardSize: 2,
        }),
      ).toThrow(new NotFoundError('La sala no existe.'));
    });

    it('rejects a blank room code', () => {
      expect(() =>
        startGame.execute({ roomCode: ' ', playerId: 'ana', boardSize: 2 }),
      ).toThrow(InvalidInputError);
    });

    it('saves nothing when the domain rejects the start', () => {
      rooms.rooms.set('ABC234', {
        code: 'ABC234',
        status: 'lobby',
        players: [{ id: 'ana', name: 'Ana' }],
      });

      expect(() => start()).toThrow(ConflictError);
      expect(stored()).toBeNull();
      expect(events.sent).toEqual([]);
    });

    it('notifies gameStarted then stateUpdated with the returned state', () => {
      const state = start();

      expect(events.sent).toEqual([
        { event: 'gameStarted', state },
        { event: 'stateUpdated', state },
      ]);
    });

    it('notifies the room again when the game already exists', () => {
      start();
      events.clear();

      const state = start();

      expect(events.names()).toEqual(['gameStarted', 'stateUpdated']);
      expect(events.sent[0].state).toEqual(state);
    });
  });

  describe('FlipCardUseCase', () => {
    beforeEach(() => start());

    it('saves the move and returns the public state and outcome', () => {
      const result = flip('ana', 'card-1');

      expect(result.outcome).toBe('first-card');
      expect(result.state.cards[0]).toEqual({
        id: 'card-1',
        state: 'revealed',
        value: 'img-1',
      });
      expect(stored()?.cards[0].state).toBe('revealed');
    });

    it.each([
      ['card-2', 'match'],
      ['card-3', 'mismatch'],
    ])('reports a second card %s as %s', (secondCard, outcome) => {
      flip('ana', 'card-1');

      expect(flip('ana', secondCard).outcome).toBe(outcome);
    });

    it('keeps the stored game unchanged and notifies nobody when the move is rejected', () => {
      const before = stored()?.toSnapshot();
      events.clear();

      expect(() => flip('beto', 'card-1')).toThrow(ConflictError);
      expect(stored()?.toSnapshot()).toEqual(before);
      expect(events.sent).toEqual([]);
      expect(scheduler.pending.size).toBe(0);
    });

    describe('notifications', () => {
      beforeEach(() => events.clear());

      it('sends cardFlipped and stateUpdated for the first card', () => {
        const { state } = flip('ana', 'card-1');

        expect(events.sent).toEqual([
          { event: 'cardFlipped', state },
          { event: 'stateUpdated', state },
        ]);
      });

      it('adds scoreUpdated and turnChanged for a match', () => {
        flip('ana', 'card-1');
        events.clear();
        flip('ana', 'card-2');

        expect(events.names()).toEqual([
          'cardFlipped',
          'stateUpdated',
          'scoreUpdated',
          'turnChanged',
        ]);
        expect(scheduler.pending.size).toBe(0);
      });

      it('adds scoreUpdated and gameFinished, but no turnChanged, for the last pair', () => {
        flip('ana', 'card-1');
        flip('ana', 'card-2');
        flip('beto', 'card-3');
        events.clear();
        flip('beto', 'card-4');

        expect(events.names()).toEqual([
          'cardFlipped',
          'stateUpdated',
          'scoreUpdated',
          'gameFinished',
        ]);
      });

      it('schedules the mismatch resolution for the room after 1s', () => {
        flip('ana', 'card-1');
        events.clear();
        flip('ana', 'card-3');

        expect(events.names()).toEqual(['cardFlipped', 'stateUpdated']);
        expect(MISMATCH_REVEAL_MS).toBe(1000);
        expect(scheduler.pending.get('ABC234')?.delayMs).toBe(1000);
      });

      it('resolves the mismatch when the scheduled task runs', () => {
        flip('ana', 'card-1');
        flip('ana', 'card-3');
        events.clear();

        scheduler.run('ABC234');

        expect(events.names()).toEqual([
          'cardsHidden',
          'turnChanged',
          'stateUpdated',
        ]);
        expect(stored()?.hasPendingMismatch).toBe(false);
        expect(stored()?.turnPlayerId).toBe('beto');
      });
    });

    it('reports a room without a game', () => {
      expect(() =>
        flipCard.execute({ roomCode: 'ZZZZZZ', playerId: 'ana', cardId: 'x' }),
      ).toThrow(new NotFoundError('No hay partida activa para esta sala.'));
    });
  });

  describe('ResolveMismatchUseCase', () => {
    beforeEach(() => start());

    it('hides the mismatched cards, passes the turn and saves', () => {
      flip('ana', 'card-1');
      flip('ana', 'card-3');

      const state = resolveMismatch.execute({ roomCode: 'abc234' });

      expect(state?.turnPlayerId).toBe('beto');
      expect(state?.cards.filter((card) => card.state === 'revealed')).toEqual(
        [],
      );
      expect(stored()?.hasPendingMismatch).toBe(false);
    });

    it('notifies cardsHidden, turnChanged and stateUpdated in that order', () => {
      flip('ana', 'card-1');
      flip('ana', 'card-3');
      events.clear();

      const state = resolveMismatch.execute({ roomCode: 'ABC234' });

      expect(events.sent).toEqual([
        { event: 'cardsHidden', state },
        { event: 'turnChanged', state },
        { event: 'stateUpdated', state },
      ]);
    });

    it('does nothing for a game without a pending mismatch', () => {
      flip('ana', 'card-1');
      const before = stored();
      events.clear();

      expect(resolveMismatch.execute({ roomCode: 'ABC234' })).toBeNull();
      expect(stored()).toBe(before);
      expect(events.sent).toEqual([]);
    });

    it('does nothing for a room without a game', () => {
      events.clear();

      expect(resolveMismatch.execute({ roomCode: 'ZZZZZZ' })).toBeNull();
      expect(events.sent).toEqual([]);
    });
  });

  describe('GetGameStateUseCase', () => {
    it('returns the public state by a normalized code', () => {
      const state = start();

      expect(getGameState.execute({ roomCode: ' abc234' })).toEqual(state);
      expect(getGameState.find({ roomCode: 'abc234' })).toEqual(state);
    });

    it('reports a room without a game, or finds nothing', () => {
      expect(() => getGameState.execute({ roomCode: 'ABC234' })).toThrow(
        new NotFoundError('No hay partida activa para esta sala.'),
      );
      expect(getGameState.find({ roomCode: 'ABC234' })).toBeNull();
    });
  });
});
