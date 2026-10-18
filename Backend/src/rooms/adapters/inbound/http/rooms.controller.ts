import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { RoomMembership, RoomView } from '../../../application/room-view';
import { CreateRoomUseCase } from '../../../application/use-cases/create-room.use-case';
import { GetRoomUseCase } from '../../../application/use-cases/get-room.use-case';
import { JoinRoomUseCase } from '../../../application/use-cases/join-room.use-case';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    private readonly getRoomUseCase: GetRoomUseCase,
  ) {}

  @Post()
  createRoom(@Body() body: { playerName?: string }): RoomMembership {
    return this.createRoomUseCase.execute({
      playerName: body.playerName ?? '',
    });
  }

  @Post(':roomCode/join')
  joinRoom(
    @Param('roomCode') roomCode: string,
    @Body() body: { playerName?: string },
  ): RoomMembership {
    return this.joinRoomUseCase.execute({
      roomCode,
      playerName: body.playerName ?? '',
    });
  }

  @Get(':roomCode')
  getRoom(@Param('roomCode') roomCode: string): RoomView {
    return this.getRoomUseCase.execute({ roomCode });
  }
}
