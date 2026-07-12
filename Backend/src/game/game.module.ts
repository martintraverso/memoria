import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GameController } from './game.controller';

@Module({
  imports: [RoomsModule],
  controllers: [GameController],
  providers: [GameService, GameGateway],
})
export class GameModule {}
