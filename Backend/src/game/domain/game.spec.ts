import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../shared/domain/errors';
import {
  FlippedGame,
  Game,
  GameSnapshot,
  NewGameInput,
  StoredGameSnapshot,
} from './game';

// With sequential ids and no shuffling the board is predictable:
// card-1/card-2 are img-1, card-3/card-4 are img-2, and so on. On odd boards
// the last card is the blocked one.
const ANA = { id: 'ana', name: 'Ana' };
const BETO = { id: 'beto', name: 'Beto' };

function startGame(overrides: Partial<NewGameInput> = {}): Game {
  let next = 0;
  return Game.start(
    {
      roomCode: 'ABC234',
      roomStatus: 'ready',
      players: [ANA, BETO],
      requestedBy: ANA.id,
      boardSize: 2,
      ...overrides,
    },
    { newCardId: () => `card-${++next}`, shuffle: (cards) => cards },
  );
}

/** Flips two cards in a row for the same player. */
function play(
  game: Game,
  playerId: string,
  first: string,
  second: string,
): FlippedGame {
  return game.flip(playerId, first).game.flip(playerId, second);
}

function cardState(game: Game, cardId: string): string | undefined {
  return game.cards.find((card) => card.id === cardId)?.state;
}

function points(game: Game): number[] {
  return game.scores.map((score) => score.points);
}

describe('Game', () => {
  describe('start', () => {
    it('starts playing with the creator in turn and no points', () => {
      const game = startGame();

      expect(game.toSnapshot()).toEqual({
        roomCode: 'ABC234',
        boardSize: 2,
        status: 'playing',
        players: [ANA, BETO],
        turnPlayerId: 'ana',
        cards: [
          { id: 'card-1', value: 'img-1', state: 'hidden' },
          { id: 'card-2', value: 'img-1', state: 'hidden' },
          { id: 'card-3', value: 'img-2', state: 'hidden' },
          { id: 'card-4', value: 'img-2', state: 'hidden' },
        ],
        openedCardIds: [],
        scores: [
          { playerId: 'ana', playerName: 'Ana', points: 0 },
          { playerId: 'beto', playerName: 'Beto', points: 0 },
        ],
        winnerPlayerId: null,
        totalMatchablePairs: 2,
        matchedPairs: 0,
        round: 1,
        startingPlayerId: 'ana',
        rematchRequestedBy: [],
      });
    });

    it('excludes the blocked card from the pairs to find', () => {
      expect(startGame({ boardSize: 3 }).toSnapshot().totalMatchablePairs).toBe(
        4,
      );
    });

    it.each<[string, Partial<NewGameInput>]>([
      ['the room is in lobby', { roomStatus: 'lobby' }],
      ['there is one player', { players: [ANA] }],
    ])('rejects starting when %s', (_, overrides) => {
      expect(() => startGame(overrides)).toThrow(
        new ConflictError('La sala aún no tiene 2 jugadores listos.'),
      );
    });

    it.each(['', 'intruder'])('rejects the non-player %p', (requestedBy) => {
      expect(() => startGame({ requestedBy })).toThrow(
        new InvalidInputError('El jugador no pertenece a la sala.'),
      );
    });

    it('only lets the room creator start', () => {
      expect(() => startGame({ requestedBy: BETO.id })).toThrow(
        new ConflictError(
          'Solo el jugador que creó la sala puede iniciar la partida.',
        ),
      );
    });

    it('rejects an invalid board size', () => {
      expect(() => startGame({ boardSize: 6 })).toThrow(InvalidInputError);
    });

    it('checks the creator before the board size', () => {
      expect(() => startGame({ requestedBy: BETO.id, boardSize: 6 })).toThrow(
        ConflictError,
      );
    });
  });

  describe('flip', () => {
    it('reveals the first card and keeps the turn', () => {
      const { game, outcome } = startGame().flip('ana', 'card-1');

      expect(outcome).toBe('first-card');
      expect(cardState(game, 'card-1')).toBe('revealed');
      expect(game.turnPlayerId).toBe('ana');
      expect(game.hasPendingMismatch).toBe(false);
    });

    it('scores a match and passes the turn', () => {
      const { game, outcome } = play(startGame(), 'ana', 'card-1', 'card-2');

      expect(outcome).toBe('match');
      expect(cardState(game, 'card-1')).toBe('matched');
      expect(cardState(game, 'card-2')).toBe('matched');
      expect(points(game)).toEqual([1, 0]);
      expect(game.turnPlayerId).toBe('beto');
      expect(game.toSnapshot()).toMatchObject({
        openedCardIds: [],
        matchedPairs: 1,
      });
    });

    it('leaves a mismatch face up and keeps the turn until it is resolved', () => {
      const { game, outcome } = play(startGame(), 'ana', 'card-1', 'card-3');

      expect(outcome).toBe('mismatch');
      expect(cardState(game, 'card-1')).toBe('revealed');
      expect(cardState(game, 'card-3')).toBe('revealed');
      expect(game.hasPendingMismatch).toBe(true);
      expect(game.turnPlayerId).toBe('ana');
      expect(points(game)).toEqual([0, 0]);
    });

    it('finishes on the last pair and declares the winner', () => {
      // Ana: match (turn → Beto). Beto: mismatch (turn → Ana).
      // Ana: match, match → 3-0 on a 3x3 board.
      let game = play(
        startGame({ boardSize: 3 }),
        'ana',
        'card-1',
        'card-2',
      ).game;
      game = play(game, 'beto', 'card-3', 'card-5').game.resolveMismatch();
      game = play(game, 'ana', 'card-3', 'card-4').game;
      game = play(game, 'beto', 'card-5', 'card-6').game;
      const last = play(game, 'ana', 'card-7', 'card-8');

      expect(last.outcome).toBe('finished');
      expect(last.game.status).toBe('finished');
      expect(last.game.turnPlayerId).toBeNull();
      expect(last.game.winnerPlayerId).toBe('ana');
      expect(points(last.game)).toEqual([3, 1]);
      expect(cardState(last.game, 'card-9')).toBe('blocked');
    });

    it('declares a draw on equal points', () => {
      const game = play(startGame(), 'ana', 'card-1', 'card-2').game;
      const last = play(game, 'beto', 'card-3', 'card-4');

      expect(last.outcome).toBe('finished');
      expect(last.game.winnerPlayerId).toBeNull();
      expect(points(last.game)).toEqual([1, 1]);
    });

    it('does not change the original game', () => {
      const original = startGame();
      const before = original.toSnapshot();

      play(original, 'ana', 'card-1', 'card-2');

      expect(original.toSnapshot()).toEqual(before);
    });

    describe('rejects', () => {
      it('moves after the game is over, before any other check', () => {
        let game = play(startGame(), 'ana', 'card-1', 'card-2').game;
        game = play(game, 'beto', 'card-3', 'card-4').game;

        expect(() => game.flip('intruder', 'missing')).toThrow(
          new ConflictError('La partida ya finalizó.'),
        );
      });

      it.each(['', 'intruder'])('the non-player %p', (playerId) => {
        expect(() => startGame().flip(playerId, 'card-1')).toThrow(
          new InvalidInputError('El jugador no pertenece a la sala.'),
        );
      });

      it('a player out of turn', () => {
        expect(() => startGame().flip('beto', 'card-1')).toThrow(
          new ConflictError('No es el turno del jugador.'),
        );
      });

      it('a third card while a mismatch is pending', () => {
        const { game } = play(startGame(), 'ana', 'card-1', 'card-3');

        expect(() => game.flip('ana', 'card-2')).toThrow(
          new ConflictError(
            'Hay una jugada pendiente de resolución. Espera un momento.',
          ),
        );
      });

      it('an unknown card', () => {
        expect(() => startGame().flip('ana', 'missing')).toThrow(
          new NotFoundError('La carta no existe.'),
        );
      });

      it.each([
        ['revealed', (game: Game) => game.flip('ana', 'card-1').game, 'card-1'],
        [
          'matched',
          (game: Game) => play(game, 'ana', 'card-1', 'card-2').game,
          'card-1',
        ],
      ])('a %s card', (_, setUp, cardId) => {
        const game = setUp(startGame());
        const playerId = game.turnPlayerId!;

        expect(() => game.flip(playerId, cardId)).toThrow(
          new ConflictError('La carta no se puede levantar.'),
        );
      });

      it('the blocked card', () => {
        expect(() => startGame({ boardSize: 3 }).flip('ana', 'card-9')).toThrow(
          new ConflictError('La carta no se puede levantar.'),
        );
      });
    });
  });

  describe('resolveMismatch', () => {
    it('hides both cards and passes the turn', () => {
      const { game } = play(startGame(), 'ana', 'card-1', 'card-3');

      const resolved = game.resolveMismatch();

      expect(cardState(resolved, 'card-1')).toBe('hidden');
      expect(cardState(resolved, 'card-3')).toBe('hidden');
      expect(resolved.turnPlayerId).toBe('beto');
      expect(resolved.hasPendingMismatch).toBe(false);
      expect(resolved.toSnapshot().openedCardIds).toEqual([]);
      expect(game.hasPendingMismatch).toBe(true);
    });

    it('rejects a game without a pending mismatch', () => {
      const { game } = startGame().flip('ana', 'card-1');

      expect(game.hasPendingMismatch).toBe(false);
      expect(() => game.resolveMismatch()).toThrow(ConflictError);
    });
  });

  describe('requestRematch', () => {
    let nextRematchId = 0;
    const rematchDeps = {
      newCardId: () => `new-${++nextRematchId}`,
      shuffle: <T>(cards: T[]) => cards,
    };

    beforeEach(() => {
      nextRematchId = 0;
    });

    /** A finished 2x2 game: each player found one pair (1-1). */
    function finishedGame(): Game {
      const game = play(startGame(), 'ana', 'card-1', 'card-2').game;
      return play(game, 'beto', 'card-3', 'card-4').game;
    }

    it('rejects a rematch while the match is being played', () => {
      expect(() => startGame().requestRematch('ana', rematchDeps)).toThrow(
        new ConflictError('La partida todavía no terminó.'),
      );
    });

    it.each(['', 'intruder'])('rejects the non-player %p', (playerId) => {
      expect(() =>
        finishedGame().requestRematch(playerId, rematchDeps),
      ).toThrow(new InvalidInputError('El jugador no pertenece a la sala.'));
    });

    it('waits for the other player after the first request', () => {
      const finished = finishedGame();

      const { game, outcome } = finished.requestRematch('beto', rematchDeps);

      expect(outcome).toBe('waiting');
      expect(game.rematchRequestedBy).toEqual(['beto']);
      expect(game.status).toBe('finished');
      expect(game.toSnapshot().cards).toEqual(finished.toSnapshot().cards);
      expect(finished.rematchRequestedBy).toEqual([]);
    });

    it('treats a repeated request as the same one', () => {
      const once = finishedGame().requestRematch('ana', rematchDeps).game;

      const { game, outcome } = once.requestRematch('ana', rematchDeps);

      expect(outcome).toBe('waiting');
      expect(game.rematchRequestedBy).toEqual(['ana']);
    });

    it('starts a new round once both players asked', () => {
      const waiting = finishedGame().requestRematch('ana', rematchDeps).game;

      const { game, outcome } = waiting.requestRematch('beto', rematchDeps);

      expect(outcome).toBe('started');
      expect(game.toSnapshot()).toEqual({
        roomCode: 'ABC234',
        boardSize: 2,
        status: 'playing',
        players: [ANA, BETO],
        turnPlayerId: 'beto',
        cards: [
          { id: 'new-1', value: 'img-1', state: 'hidden' },
          { id: 'new-2', value: 'img-1', state: 'hidden' },
          { id: 'new-3', value: 'img-2', state: 'hidden' },
          { id: 'new-4', value: 'img-2', state: 'hidden' },
        ],
        openedCardIds: [],
        scores: [
          { playerId: 'ana', playerName: 'Ana', points: 0 },
          { playerId: 'beto', playerName: 'Beto', points: 0 },
        ],
        winnerPlayerId: null,
        totalMatchablePairs: 2,
        matchedPairs: 0,
        round: 2,
        startingPlayerId: 'beto',
        rematchRequestedBy: [],
      });
    });

    it('keeps the board size and its blocked card', () => {
      let game = startGame({ boardSize: 3 });
      for (const [player, first, second] of [
        ['ana', 'card-1', 'card-2'],
        ['beto', 'card-3', 'card-4'],
        ['ana', 'card-5', 'card-6'],
        ['beto', 'card-7', 'card-8'],
      ]) {
        game = play(game, player, first, second).game;
      }

      game = game.requestRematch('ana', rematchDeps).game;
      game = game.requestRematch('beto', rematchDeps).game;

      expect(game.boardSize).toBe(3);
      expect(game.cards).toHaveLength(9);
      expect(
        game.cards.filter((card) => card.state === 'blocked'),
      ).toHaveLength(1);
    });

    it('alternates who starts on every rematch', () => {
      const rematch = (game: Game) =>
        game
          .requestRematch('ana', rematchDeps)
          .game.requestRematch('beto', rematchDeps).game;
      const finish = (game: Game) => {
        const first = game.turnPlayerId!;
        const second = first === 'ana' ? 'beto' : 'ana';
        const [a, b, c, d] = game.cards.map((card) => card.id);
        return play(play(game, first, a, b).game, second, c, d).game;
      };

      const round2 = rematch(finishedGame());
      const round3 = rematch(finish(round2));

      expect(round2.turnPlayerId).toBe('beto');
      expect(round3.turnPlayerId).toBe('ana');
      expect(round3.round).toBe(3);
    });
  });

  describe('snapshots', () => {
    it('rehydrates a snapshot saved before rematches existed as a first round', () => {
      const legacy: StoredGameSnapshot = startGame().toSnapshot();
      delete legacy.round;
      delete legacy.startingPlayerId;
      delete legacy.rematchRequestedBy;

      const game = Game.rehydrate(legacy);

      expect(game.round).toBe(1);
      expect(game.rematchRequestedBy).toEqual([]);
      expect(game.toSnapshot().startingPlayerId).toBe('ana');
    });

    it('rehydrates to an equal game', () => {
      const { game } = play(startGame(), 'ana', 'card-1', 'card-3');

      const restored = Game.rehydrate(game.toSnapshot());

      expect(restored.toSnapshot()).toEqual(game.toSnapshot());
      expect(restored.hasPendingMismatch).toBe(true);
    });

    it('hands out copies that cannot change the game', () => {
      const game = startGame();
      const snapshot: GameSnapshot = game.toSnapshot();

      snapshot.cards[0].state = 'matched';
      snapshot.scores[0].points = 99;

      expect(cardState(game, 'card-1')).toBe('hidden');
      expect(points(game)).toEqual([0, 0]);
    });

    it('does not keep a reference to the snapshot it was rehydrated from', () => {
      const snapshot = startGame().toSnapshot();
      const game = Game.rehydrate(snapshot);

      snapshot.turnPlayerId = 'beto';

      expect(game.turnPlayerId).toBe('ana');
    });

    it('exposes read-only state', () => {
      const game = startGame();

      expect(Object.isFrozen(game.cards)).toBe(true);
      expect(Object.isFrozen(game.cards[0])).toBe(true);
      expect(Object.isFrozen(game.scores[0])).toBe(true);
    });
  });
});
