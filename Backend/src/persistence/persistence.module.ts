import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import {
  openSqliteDatabase,
  SQLITE_DATABASE,
  type SqliteDatabase,
} from './sqlite-database';

@Global()
@Module({
  providers: [
    { provide: SQLITE_DATABASE, useFactory: () => openSqliteDatabase() },
  ],
  exports: [SQLITE_DATABASE],
})
export class PersistenceModule implements OnApplicationShutdown {
  constructor(@Inject(SQLITE_DATABASE) private readonly db: SqliteDatabase) {}

  /**
   * Runs after every `onModuleDestroy`, so pending mismatch timers are
   * already cancelled and nothing writes to a closed connection.
   */
  onApplicationShutdown(): void {
    this.db.close();
  }
}
