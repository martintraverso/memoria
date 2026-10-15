import { Module } from '@nestjs/common';
import { GetRoomUseCase } from '../rooms/application/use-cases/get-room.use-case';
import { RoomsModule } from '../rooms/rooms.module';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../shared/application/ports/id-generator.port';
import { SharedModule } from '../shared/shared.module';
import { GameController } from './adapters/inbound/http/game.controller';
import { GameGateway } from './adapters/inbound/ws/game.gateway';
import { FisherYatesShuffler } from './adapters/outbound/fisher-yates.shuffler';
import { RoomsRoomLookup } from './adapters/outbound/rooms/rooms-room-lookup';
import { SqliteGameRepository } from './adapters/outbound/sqlite/sqlite-game.repository';
import { TimeoutMismatchScheduler } from './adapters/outbound/timer/timeout-mismatch-scheduler';
import { SocketIoGameEvents } from './adapters/outbound/ws/socket-io-game-events';
import { SocketServerRef } from './adapters/outbound/ws/socket-server.ref';
import {
  GAME_EVENTS,
  GameEvents,
} from './application/ports/outbound/game-events.port';
import {
  GAME_REPOSITORY,
  GameRepository,
} from './application/ports/outbound/game-repository.port';
import {
  MISMATCH_SCHEDULER,
  MismatchScheduler,
} from './application/ports/outbound/mismatch-scheduler.port';
import {
  ROOM_LOOKUP,
  RoomLookup,
} from './application/ports/outbound/room-lookup.port';
import { SHUFFLER, Shuffler } from './application/ports/outbound/shuffler.port';
import { FlipCardUseCase } from './application/use-cases/flip-card.use-case';
import { GetGameStateUseCase } from './application/use-cases/get-game-state.use-case';
import { ResolveMismatchUseCase } from './application/use-cases/resolve-mismatch.use-case';
import { StartGameUseCase } from './application/use-cases/start-game.use-case';

/** Composition root for the game: binds ports to adapters and builds use cases. */
@Module({
  imports: [RoomsModule, SharedModule],
  controllers: [GameController],
  providers: [
    { provide: GAME_REPOSITORY, useClass: SqliteGameRepository },
    {
      provide: ROOM_LOOKUP,
      useFactory: (getRoom: GetRoomUseCase) => new RoomsRoomLookup(getRoom),
      inject: [GetRoomUseCase],
    },
    { provide: SHUFFLER, useFactory: () => new FisherYatesShuffler() },
    { provide: SocketServerRef, useFactory: () => new SocketServerRef() },
    {
      provide: GAME_EVENTS,
      useFactory: (server: SocketServerRef) => new SocketIoGameEvents(server),
      inject: [SocketServerRef],
    },
    {
      provide: MISMATCH_SCHEDULER,
      useFactory: () => new TimeoutMismatchScheduler(),
    },
    {
      provide: StartGameUseCase,
      useFactory: (
        rooms: RoomLookup,
        games: GameRepository,
        ids: IdGenerator,
        shuffler: Shuffler,
        events: GameEvents,
      ) => new StartGameUseCase(rooms, games, ids, shuffler, events),
      inject: [
        ROOM_LOOKUP,
        GAME_REPOSITORY,
        ID_GENERATOR,
        SHUFFLER,
        GAME_EVENTS,
      ],
    },
    {
      provide: ResolveMismatchUseCase,
      useFactory: (games: GameRepository, events: GameEvents) =>
        new ResolveMismatchUseCase(games, events),
      inject: [GAME_REPOSITORY, GAME_EVENTS],
    },
    {
      provide: FlipCardUseCase,
      useFactory: (
        games: GameRepository,
        events: GameEvents,
        scheduler: MismatchScheduler,
        resolveMismatch: ResolveMismatchUseCase,
      ) => new FlipCardUseCase(games, events, scheduler, resolveMismatch),
      inject: [
        GAME_REPOSITORY,
        GAME_EVENTS,
        MISMATCH_SCHEDULER,
        ResolveMismatchUseCase,
      ],
    },
    {
      provide: GetGameStateUseCase,
      useFactory: (games: GameRepository) => new GetGameStateUseCase(games),
      inject: [GAME_REPOSITORY],
    },
    GameGateway,
  ],
})
export class GameModule {}
