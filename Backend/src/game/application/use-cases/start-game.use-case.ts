import type { IdGenerator } from '../../../shared/application/ports/id-generator.port';
import { RoomCode } from '../../../shared/domain/room-code';
import { Game } from '../../domain/game';
import {
  PublicGameState,
  toPublicGameState,
} from '../../domain/public-game-state';
import type { GameEvents } from '../ports/outbound/game-events.port';
import type { GameRepository } from '../ports/outbound/game-repository.port';
import type { RoomLookup } from '../ports/outbound/room-lookup.port';
import type { Shuffler } from '../ports/outbound/shuffler.port';

export interface StartGameInput {
  roomCode: string;
  playerId: string;
  boardSize: number;
}

export class StartGameUseCase {
  constructor(
    private readonly rooms: RoomLookup,
    private readonly games: GameRepository,
    private readonly ids: IdGenerator,
    private readonly shuffler: Shuffler,
    private readonly events: GameEvents,
  ) {}

  /**
   * Starts the room's game, or returns the current one if it already
   * started. The request is validated in both cases, and the room is
   * notified in both cases too.
   */
  execute(input: StartGameInput): PublicGameState {
    const code = RoomCode.parse(input.roomCode);
    const room = this.rooms.getRoom(code);
    const game = Game.start(
      {
        roomCode: room.code,
        roomStatus: room.status,
        players: room.players,
        requestedBy: input.playerId,
        boardSize: input.boardSize,
      },
      {
        newCardId: () => this.ids.generate(),
        shuffle: (cards) => this.shuffler.shuffle(cards),
      },
    );

    const existingGame = this.games.findByRoomCode(code);
    if (!existingGame) {
      this.games.save(game);
    }

    const state = toPublicGameState(existingGame ?? game);
    this.events.gameStarted(state);
    this.events.stateUpdated(state);
    return state;
  }
}
