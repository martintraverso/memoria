import type { IdGenerator } from '../../../shared/application/ports/id-generator.port';
import type { RematchOutcome } from '../../domain/game';
import {
  PublicGameState,
  toPublicGameState,
} from '../../domain/public-game-state';
import type { GameEvents } from '../ports/outbound/game-events.port';
import type { GameRepository } from '../ports/outbound/game-repository.port';
import type { Shuffler } from '../ports/outbound/shuffler.port';
import { findGameOrThrow } from './find-game';

export interface RequestRematchInput {
  roomCode: string;
  playerId: string;
}

export interface RequestRematchResult {
  state: PublicGameState;
  outcome: RematchOutcome;
}

export class RequestRematchUseCase {
  constructor(
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly shuffler: Shuffler,
    private readonly events: GameEvents,
  ) {}

  /**
   * Records the player's rematch request. When both players asked, the new
   * round is announced with the same events as a normal start.
   */
  execute(input: RequestRematchInput): RequestRematchResult {
    const { game, outcome } = findGameOrThrow(
      this.games,
      input.roomCode,
    ).requestRematch(input.playerId, {
      newCardId: () => this.ids.generate(),
      shuffle: (cards) => this.shuffler.shuffle(cards),
    });
    this.games.save(game);

    const state = toPublicGameState(game);
    if (outcome === 'started') {
      this.events.gameStarted(state);
    } else {
      this.events.rematchRequested(state);
    }
    this.events.stateUpdated(state);
    return { state, outcome };
  }
}
