import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import type { RoomSnapshot } from './room.types';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  createRoom(@Body() body: { playerName?: string }): {
    room: RoomSnapshot;
    playerId: string;
  } {
    return this.roomsService.createRoom(body.playerName ?? '');
  }

  @Post(':roomCode/join')
  joinRoom(
    @Param('roomCode') roomCode: string,
    @Body() body: { playerName?: string },
  ): { room: RoomSnapshot; playerId: string } {
    return this.roomsService.joinRoom(roomCode, body.playerName ?? '');
  }

  @Get(':roomCode')
  getRoom(@Param('roomCode') roomCode: string): RoomSnapshot {
    return this.roomsService.getRoom(roomCode);
  }
}
