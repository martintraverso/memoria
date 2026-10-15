import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';
import { PersistenceModule } from './persistence/persistence.module';
import { DomainErrorHttpFilter } from './shared/adapters/http/domain-error.filter';

@Module({
  imports: [PersistenceModule, RoomsModule, GameModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: DomainErrorHttpFilter },
  ],
})
export class AppModule {}
