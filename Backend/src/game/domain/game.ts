import { deepFreeze } from '../../shared/domain/deep-freeze';
import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '../../shared/domain/errors';
import { BoardFactoryDependencies, buildBoard, GameCard } from './board';
import { BoardSize } from './board-size';

export type GameStatus = 'playing' | 'finished';

export interface GamePlayer {
  id: string;
  name: string;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  points: number;
}

/**
 * Complete game state, including the values of hidden cards. It is what gets
 * persisted; clients must only ever see `toPublicGameState()`.
 */
export interface GameSnapshot {
  roomCode: string;
  boardSize: number;
  status: GameStatus;
  players: GamePlayer[];
  turnPlayerId: string | null;
  cards: GameCard[];
  openedCardIds: string[];
  scores: PlayerScore[];
  winnerPlayerId: string | null;
  totalMatchablePairs: number;
  matchedPairs: number;
}

export interface NewGameInput {
  roomCode: string;
  roomStatus: 'lobby' | 'ready';
  /** Room players in join order: the first one is the room creator. */
  players: readonly GamePlayer[];
  requestedBy: string;
  boardSize: number;
}

/**
 * - `first-card`: one card is face up, the same player flips again.
 * - `match`: the pair scores a point and the turn passes.
 * - `mismatch`: both cards stay face up until `resolveMismatch()`.
 * - `finished`: the last pair was found.
 */
export type FlipOutcome = 'first-card' | 'match' | 'mismatch' | 'finished';

export interface FlippedGame {
  game: Game;
  outcome: FlipOutcome;
}

/**
 * The memory game rules. Instances are immutable: every move returns a new
 * Game.
 */
export class Game {
  private readonly state: Readonly<GameSnapshot>;

  private constructor(state: GameSnapshot) {
    this.state = deepFreeze(state);
  }

  /** Validates who can start and on which board, then deals the cards. */
  static start(
    input: NewGameInput,
    boardDependencies: BoardFactoryDependencies,
  ): Game {
    const { players } = input;
    if (players.length !== 2 || input.roomStatus !== 'ready') {
      throw new ConflictError('La sala aún no tiene 2 jugadores listos.');
    }
    ensureIsPlayer(input.requestedBy, players);
    if (input.requestedBy !== players[0].id) {
      throw new ConflictError(
        'Solo el jugador que creó la sala puede iniciar la partida.',
      );
    }
    const boardSize = BoardSize.parse(input.boardSize);

    return new Game({
      roomCode: input.roomCode,
      boardSize: boardSize.value,
      status: 'playing',
      players: players.map((player) => ({ id: player.id, name: player.name })),
      turnPlayerId: players[0].id,
      cards: buildBoard(boardSize, boardDependencies),
      openedCardIds: [],
      scores: players.map((player) => ({
        playerId: player.id,
        playerName: player.name,
        points: 0,
      })),
      winnerPlayerId: null,
      totalMatchablePairs: boardSize.pairCount,
      matchedPairs: 0,
    });
  }

  /** Rebuilds a game from stored data without re-running the start rules. */
  static rehydrate(snapshot: GameSnapshot): Game {
    return new Game(structuredClone(snapshot));
  }

  get roomCode(): string {
    return this.state.roomCode;
  }

  get boardSize(): number {
    return this.state.boardSize;
  }

  get status(): GameStatus {
    return this.state.status;
  }

  get players(): readonly GamePlayer[] {
    return this.state.players;
  }

  get turnPlayerId(): string | null {
    return this.state.turnPlayerId;
  }

  get cards(): readonly GameCard[] {
    return this.state.cards;
  }

  get scores(): readonly PlayerScore[] {
    return this.state.scores;
  }

  get winnerPlayerId(): string | null {
    return this.state.winnerPlayerId;
  }

  /** Two non-matching cards are face up, waiting to be hidden. */
  get hasPendingMismatch(): boolean {
    return (
      this.state.status === 'playing' && this.state.openedCardIds.length === 2
    );
  }

  flip(playerId: string, cardId: string): FlippedGame {
    if (this.state.status !== 'playing') {
      throw new ConflictError('La partida ya finalizó.');
    }
    ensureIsPlayer(playerId, this.state.players);
    if (this.state.turnPlayerId !== playerId) {
      throw new ConflictError('No es el turno del jugador.');
    }
    if (this.state.openedCardIds.length >= 2) {
      throw new ConflictError(
        'Hay una jugada pendiente de resolución. Espera un momento.',
      );
    }

    const next = this.toSnapshot();
    const card = next.cards.find((item) => item.id === cardId);
    if (!card) {
      throw new NotFoundError('La carta no existe.');
    }
    if (card.state !== 'hidden') {
      throw new ConflictError('La carta no se puede levantar.');
    }

    card.state = 'revealed';
    next.openedCardIds.push(card.id);
    if (next.openedCardIds.length === 1) {
      return { game: new Game(next), outcome: 'first-card' };
    }

    const [first, second] = next.openedCardIds.map((id) => cardById(next, id));
    if (first.value !== second.value) {
      return { game: new Game(next), outcome: 'mismatch' };
    }

    first.state = 'matched';
    second.state = 'matched';
    next.openedCardIds = [];
    next.matchedPairs += 1;
    scoreOf(next, playerId).points += 1;

    if (next.matchedPairs >= next.totalMatchablePairs) {
      next.status = 'finished';
      next.turnPlayerId = null;
      next.winnerPlayerId = winnerOf(next.scores);
      return { game: new Game(next), outcome: 'finished' };
    }

    passTurn(next);
    return { game: new Game(next), outcome: 'match' };
  }

  /** Hides the two face-up cards of a mismatch and passes the turn. */
  resolveMismatch(): Game {
    if (!this.hasPendingMismatch) {
      throw new ConflictError('No hay una jugada pendiente de resolución.');
    }

    const next = this.toSnapshot();
    for (const id of next.openedCardIds) {
      const card = cardById(next, id);
      if (card.state === 'revealed') {
        card.state = 'hidden';
      }
    }
    next.openedCardIds = [];
    passTurn(next);
    return new Game(next);
  }

  /** A mutable deep copy of the full state. */
  toSnapshot(): GameSnapshot {
    return structuredClone(this.state);
  }
}

function ensureIsPlayer(
  playerId: string,
  players: readonly GamePlayer[],
): void {
  if (!playerId || !players.some((player) => player.id === playerId)) {
    throw new InvalidInputError('El jugador no pertenece a la sala.');
  }
}

// The helpers below guard invariants that valid moves can't break, so they
// throw plain errors (logged as bugs) instead of domain errors.

function cardById(state: GameSnapshot, cardId: string): GameCard {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) {
    throw new Error(`Opened card ${cardId} is not on the board.`);
  }
  return card;
}

function scoreOf(state: GameSnapshot, playerId: string): PlayerScore {
  const score = state.scores.find((item) => item.playerId === playerId);
  if (!score) {
    throw new Error(`Player ${playerId} has no score.`);
  }
  return score;
}

function passTurn(state: GameSnapshot): void {
  const current = state.players.findIndex(
    (player) => player.id === state.turnPlayerId,
  );
  if (current < 0) {
    throw new Error(`Turn player ${state.turnPlayerId} is not in the game.`);
  }
  state.turnPlayerId = state.players[(current + 1) % state.players.length].id;
}

function winnerOf(scores: readonly PlayerScore[]): string | null {
  const [first, second] = scores;
  if (!first || !second || first.points === second.points) {
    return null;
  }
  return first.points > second.points ? first.playerId : second.playerId;
}
