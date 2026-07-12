import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

@Injectable()
export class SQLitePersistenceService {
  private readonly db: Database.Database;

  constructor() {
    const databasePath = resolve(
      process.env.DATABASE_PATH ?? 'data/memoria.sqlite',
    );
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.initializeSchema();
  }

  loadRooms<T>(): T[] {
    const rows = this.db
      .prepare('SELECT payload FROM room_snapshots')
      .all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as T);
  }

  saveRoom<T>(roomCode: string, payload: T): void {
    this.db
      .prepare(
        `INSERT INTO room_snapshots (code, payload, updated_at)
         VALUES (@code, @payload, @updatedAt)
         ON CONFLICT(code) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
      .run({
        code: roomCode,
        payload: JSON.stringify(payload),
        updatedAt: new Date().toISOString(),
      });
  }

  loadGames<T>(): T[] {
    const rows = this.db
      .prepare('SELECT payload FROM game_snapshots')
      .all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as T);
  }

  saveGame<T>(roomCode: string, payload: T): void {
    this.db
      .prepare(
        `INSERT INTO game_snapshots (room_code, payload, updated_at)
         VALUES (@roomCode, @payload, @updatedAt)
         ON CONFLICT(room_code) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
      .run({
        roomCode,
        payload: JSON.stringify(payload),
        updatedAt: new Date().toISOString(),
      });
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS room_snapshots (
        code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_snapshots (
        room_code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
}
