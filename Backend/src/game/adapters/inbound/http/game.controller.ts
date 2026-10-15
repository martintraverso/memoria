import { Controller, Get, Param } from '@nestjs/common';
import { GetGameStateUseCase } from '../../../application/use-cases/get-game-state.use-case';
import type { PublicGameState } from '../../../domain/public-game-state';

@Controller('games')
export class GameController {
  constructor(private readonly getGameStateUseCase: GetGameStateUseCase) {}

  @Get(':roomCode')
  getGameState(@Param('roomCode') roomCode: string): PublicGameState {
    return this.getGameStateUseCase.execute({ roomCode });
  }
}
