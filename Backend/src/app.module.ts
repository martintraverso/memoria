import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';
import { PersistenceModule } from './persistence/persistence.module';

@Module({
  imports: [PersistenceModule, RoomsModule, GameModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
