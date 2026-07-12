import { GameService } from './game.service';
import { RoomsService } from '../rooms/rooms.service';
import type { GameCardState, GameState } from './game.types';

describe('GameService', () => {
  let roomsService: RoomsService;
  let gameService: GameService;

  beforeEach(() => {
    roomsService = new RoomsService();
    gameService = new GameService(roomsService);
  });

  it('resolves mismatch and changes turn', () => {
    const { room, playerId: playerAId } = roomsService.createRoom('Jugador A');
    const { playerId: playerBId } = roomsService.joinRoom(
      room.code,
      'Jugador B',
    );
    const startedState = gameService.startGame(room.code, playerAId, 2);
    expect(startedState.turnPlayerId).toBe(playerAId);

    const internal = getInternalGame(gameService, room.code);
    const mismatchCards = findMismatchCards(internal.cards);
    const firstFlip = gameService.flipCard(
      room.code,
      playerAId,
      mismatchCards[0],
    );
    const secondFlip = gameService.flipCard(
      room.code,
      playerAId,
      mismatchCards[1],
    );

    expect(firstFlip.mismatchPending).toBe(false);
    expect(secondFlip.mismatchPending).toBe(true);
    expect(
      secondFlip.state.cards.filter((card) => card.state === 'revealed'),
    ).toHaveLength(2);

    const resolvedState = gameService.resolveMismatch(room.code);
    expect(resolvedState).not.toBeNull();
    expect(resolvedState?.turnPlayerId).toBe(playerBId);
    expect(
      resolvedState?.cards.filter((card) => card.state === 'revealed'),
    ).toHaveLength(0);
  });

  it('completes a full 1v1 flow (create/join/start/play/finish)', () => {
    const { room, playerId: playerAId } = roomsService.createRoom('Jugador A');
    roomsService.joinRoom(room.code, 'Jugador B');

    let state = gameService.startGame(room.code, playerAId, 2);
    expect(state.status).toBe('playing');

    const pairIdsByValue = groupHiddenPairIds(
      getInternalGame(gameService, room.code).cards,
    );

    while (state.status === 'playing') {
      const turnPlayerId = state.turnPlayerId;
      expect(turnPlayerId).toBeTruthy();

      const nextPair = pairIdsByValue.find(
        ([firstCardId, secondCardId]) =>
          hasCardState(state, firstCardId, 'hidden') &&
          hasCardState(state, secondCardId, 'hidden'),
      );

      expect(nextPair).toBeTruthy();
      const [firstCardId, secondCardId] = nextPair!;

      gameService.flipCard(room.code, turnPlayerId!, firstCardId);
      const secondFlip = gameService.flipCard(
        room.code,
        turnPlayerId!,
        secondCardId,
      );
      state = secondFlip.state;
      expect(secondFlip.mismatchPending).toBe(false);
    }

    expect(state.status).toBe('finished');
    expect(state.turnPlayerId).toBeNull();
    expect(state.scores.reduce((sum, score) => sum + score.points, 0)).toBe(2);
  });
});

function hasCardState(
  state: GameState,
  cardId: string,
  expectedState: GameCardState,
): boolean {
  return state.cards.some(
    (card) => card.id === cardId && card.state === expectedState,
  );
}

function groupHiddenPairIds(
  cards: Array<{ id: string; value: string; state: GameCardState }>,
): string[][] {
  const pairMap = new Map<string, string[]>();

  for (const card of cards) {
    if (card.value === 'blocked') {
      continue;
    }
    const current = pairMap.get(card.value) ?? [];
    current.push(card.id);
    pairMap.set(card.value, current);
  }

  return Array.from(pairMap.values());
}

function findMismatchCards(
  cards: Array<{ id: string; value: string; state: GameCardState }>,
): [string, string] {
  const playableCards = cards.filter((card) => card.value !== 'blocked');

  for (let index = 0; index < playableCards.length; index += 1) {
    const first = playableCards[index];
    for (
      let secondIndex = index + 1;
      secondIndex < playableCards.length;
      secondIndex += 1
    ) {
      const second = playableCards[secondIndex];
      if (first.value !== second.value) {
        return [first.id, second.id];
      }
    }
  }

  throw new Error('No mismatch cards found for test.');
}

function getInternalGame(
  gameService: GameService,
  roomCode: string,
): { cards: Array<{ id: string; value: string; state: GameCardState }> } {
  const internal = gameService as unknown as {
    games: Map<
      string,
      { cards: Array<{ id: string; value: string; state: GameCardState }> }
    >;
  };
  return internal.games.get(roomCode.toUpperCase())!;
}
