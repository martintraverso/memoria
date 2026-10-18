import type { FlipOutcome } from '../../domain/game';
import {
  PublicGameState,
  toPublicGameState,
} from '../../domain/public-game-state';
import type { GameEvents } from '../ports/outbound/game-events.port';
import type { GameRepository } from '../ports/outbound/game-repository.port';
import type { MismatchScheduler } from '../ports/outbound/mismatch-scheduler.port';
import { findGameOrThrow } from './find-game';
import type { ResolveMismatchUseCase } from './resolve-mismatch.use-case';

/** How long both cards of a mismatch stay face up. */
export const MISMATCH_REVEAL_MS = 1000;

export interface FlipCardInput {
  roomCode: string;
  playerId: string;
  cardId: string;
}

export interface FlipCardResult {
  state: PublicGameState;
  outcome: FlipOutcome;
}

export class FlipCardUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly events: GameEvents,
    private readonly scheduler: MismatchScheduler,
    private readonly resolveMismatch: ResolveMismatchUseCase,
  ) {}

  execute(input: FlipCardInput): FlipCardResult {
    const { game, outcome } = findGameOrThrow(this.games, input.roomCode).flip(
      input.playerId,
      input.cardId,
    );
    this.games.save(game);

    const state = toPublicGameState(game);
    this.notify(state, outcome);
    if (outcome === 'mismatch') {
      this.scheduler.schedule(game.roomCode, MISMATCH_REVEAL_MS, () => {
        this.resolveMismatch.execute({ roomCode: game.roomCode });
      });
    }
    return { state, outcome };
  }

  private notify(state: PublicGameState, outcome: FlipOutcome): void {
    this.events.cardFlipped(state);
    this.events.stateUpdated(state);
    if (outcome === 'match' || outcome === 'finished') {
      this.events.scoreUpdated(state);
    }
    if (outcome === 'finished') {
      this.events.gameFinished(state);
    }
    if (outcome === 'match') {
      this.events.turnChanged(state);
    }
  }
}
