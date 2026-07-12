import { Controller, Get, Param } from '@nestjs/common';
import { GameService } from './game.service';
import type { GameState } from './game.types';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get(':roomCode')
  getGameState(@Param('roomCode') roomCode: string): GameState {
    return this.gameService.getGameState(roomCode);
  }
}
