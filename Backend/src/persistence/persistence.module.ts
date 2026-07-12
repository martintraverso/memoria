import { Global, Module } from '@nestjs/common';
import { SQLitePersistenceService } from './sqlite-persistence.service';

@Global()
@Module({
  providers: [SQLitePersistenceService],
  exports: [SQLitePersistenceService],
})
export class PersistenceModule {}
