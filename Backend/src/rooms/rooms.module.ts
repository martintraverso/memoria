import { Module } from '@nestjs/common';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../shared/application/ports/id-generator.port';
import { SharedModule } from '../shared/shared.module';
import { RoomsController } from './adapters/inbound/http/rooms.controller';
import { RandomRoomCodeGenerator } from './adapters/outbound/random-room-code.generator';
import { SqliteRoomRepository } from './adapters/outbound/sqlite/sqlite-room.repository';
import {
  ROOM_CODE_GENERATOR,
  RoomCodeGenerator,
} from './application/ports/outbound/room-code-generator.port';
import {
  ROOM_REPOSITORY,
  RoomRepository,
} from './application/ports/outbound/room-repository.port';
import { CreateRoomUseCase } from './application/use-cases/create-room.use-case';
import { GetRoomUseCase } from './application/use-cases/get-room.use-case';
import { JoinRoomUseCase } from './application/use-cases/join-room.use-case';

/** Composition root for rooms: binds ports to adapters and builds use cases. */
@Module({
  imports: [SharedModule],
  controllers: [RoomsController],
  providers: [
    { provide: ROOM_REPOSITORY, useClass: SqliteRoomRepository },
    {
      provide: ROOM_CODE_GENERATOR,
      useFactory: () => new RandomRoomCodeGenerator(),
    },
    {
      provide: CreateRoomUseCase,
      useFactory: (
        rooms: RoomRepository,
        roomCodes: RoomCodeGenerator,
        ids: IdGenerator,
      ) => new CreateRoomUseCase(rooms, roomCodes, ids),
      inject: [ROOM_REPOSITORY, ROOM_CODE_GENERATOR, ID_GENERATOR],
    },
    {
      provide: JoinRoomUseCase,
      useFactory: (rooms: RoomRepository, ids: IdGenerator) =>
        new JoinRoomUseCase(rooms, ids),
      inject: [ROOM_REPOSITORY, ID_GENERATOR],
    },
    {
      provide: GetRoomUseCase,
      useFactory: (rooms: RoomRepository) => new GetRoomUseCase(rooms),
      inject: [ROOM_REPOSITORY],
    },
  ],
  exports: [GetRoomUseCase],
})
export class RoomsModule {}
