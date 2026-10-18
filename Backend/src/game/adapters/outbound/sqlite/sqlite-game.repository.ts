import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  SQLITE_DATABASE,
  type SqliteDatabase,
} from '../../../../persistence/sqlite-database';
import type { RoomCode } from '../../../../shared/domain/room-code';
import type { GameRepository } from '../../../application/ports/outbound/game-repository.port';
import { Game, GameSnapshot } from '../../../domain/game';

/**
 * Write-through cache over SQLite: every game is loaded at startup and each
 * save is written to the database before the cache is updated.
 *
 * `game_snapshots.payload` holds `Game.toSnapshot()` as JSON. Keep that shape
 * stable: existing databases must keep loading.
 */
@Injectable()
export class SqliteGameRepository implements GameRepository, OnModuleInit {
  private readonly cache = new Map<string, Game>();

  constructor(@Inject(SQLITE_DATABASE) private readonly db: SqliteDatabase) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_snapshots (
        room_code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  onModuleInit(): void {
    const rows = this.db
      .prepare('SELECT payload FROM game_snapshots')
      .all() as Array<{ payload: string }>;
    for (const row of rows) {
      const snapshot = JSON.parse(row.payload) as GameSnapshot;
      this.cache.set(snapshot.roomCode, Game.rehydrate(snapshot));
    }
  }

  findByRoomCode(code: RoomCode): Game | null {
    return this.cache.get(code.value) ?? null;
  }

  save(game: Game): void {
    this.db
      .prepare(
        `INSERT INTO game_snapshots (room_code, payload, updated_at)
         VALUES (@roomCode, @payload, @updatedAt)
         ON CONFLICT(room_code) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
      .run({
        roomCode: game.roomCode,
        payload: JSON.stringify(game.toSnapshot()),
        updatedAt: new Date().toISOString(),
      });
    this.cache.set(game.roomCode, game);
  }
}
