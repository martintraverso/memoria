import { Game } from './game';
import { toPublicGameState } from './public-game-state';

describe('toPublicGameState', () => {
  function startGame(boardSize: number): Game {
    let next = 0;
    return Game.start(
      {
        roomCode: 'ABC234',
        roomStatus: 'ready',
        players: [
          { id: 'ana', name: 'Ana' },
          { id: 'beto', name: 'Beto' },
        ],
        requestedBy: 'ana',
        boardSize,
      },
      { newCardId: () => `card-${++next}`, shuffle: (cards) => cards },
    );
  }

  it('hides the values of hidden cards only', () => {
    // card-1 matched, card-3 revealed, card-9 blocked, the rest hidden.
    let game = startGame(3)
      .flip('ana', 'card-1')
      .game.flip('ana', 'card-2').game;
    game = game.flip('beto', 'card-3').game;

    const cards = toPublicGameState(game).cards;

    expect(cards.find((card) => card.id === 'card-1')).toEqual({
      id: 'card-1',
      state: 'matched',
      value: 'img-1',
    });
    expect(cards.find((card) => card.id === 'card-3')).toEqual({
      id: 'card-3',
      state: 'revealed',
      value: 'img-2',
    });
    expect(cards.find((card) => card.id === 'card-9')).toEqual({
      id: 'card-9',
      state: 'blocked',
      value: 'blocked',
    });
    const hidden = cards.filter((card) => card.state === 'hidden');
    expect(hidden).toHaveLength(5);
    expect(hidden.every((card) => card.value === '')).toBe(true);
  });

  it('exposes exactly the public fields', () => {
    const state = toPublicGameState(startGame(2));

    expect(Object.keys(state).sort()).toEqual([
      'boardSize',
      'cards',
      'players',
      'rematchRequestedBy',
      'roomCode',
      'round',
      'scores',
      'status',
      'turnPlayerId',
      'winnerPlayerId',
    ]);
    expect(state).toMatchObject({
      roomCode: 'ABC234',
      boardSize: 2,
      status: 'playing',
      turnPlayerId: 'ana',
      winnerPlayerId: null,
      round: 1,
      rematchRequestedBy: [],
      players: [
        { id: 'ana', name: 'Ana' },
        { id: 'beto', name: 'Beto' },
      ],
      scores: [
        { playerId: 'ana', playerName: 'Ana', points: 0 },
        { playerId: 'beto', playerName: 'Beto', points: 0 },
      ],
    });
  });

  it('shows rematch requests and still hides the new board after a rematch', () => {
    let game = startGame(2)
      .flip('ana', 'card-1')
      .game.flip('ana', 'card-2').game;
    game = game.flip('beto', 'card-3').game.flip('beto', 'card-4').game;
    const ids = { next: 0 };
    const deps = {
      newCardId: () => `new-${++ids.next}`,
      shuffle: <T>(cards: T[]) => cards,
    };

    const waiting = game.requestRematch('beto', deps).game;
    expect(toPublicGameState(waiting).rematchRequestedBy).toEqual(['beto']);

    const state = toPublicGameState(waiting.requestRematch('ana', deps).game);
    expect(state.round).toBe(2);
    expect(state.rematchRequestedBy).toEqual([]);
    expect(state.cards.every((card) => card.value === '')).toBe(true);
  });

  it('returns mutable copies, not the frozen game state', () => {
    const game = startGame(2);
    const state = toPublicGameState(game);

    state.scores[0].points = 5;
    state.players.push({ id: 'x', name: 'X' });

    expect(game.scores[0].points).toBe(0);
    expect(game.players).toHaveLength(2);
  });
});
