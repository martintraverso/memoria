import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  SQLITE_DATABASE,
  type SqliteDatabase,
} from '../../../../persistence/sqlite-database';
import type { RoomRepository } from '../../../application/ports/outbound/room-repository.port';
import { Room, RoomStatus } from '../../../domain/room';
import { RoomCode } from '../../../../shared/domain/room-code';

/**
 * JSON stored in `room_snapshots.payload`. Keep this shape stable: existing
 * databases must keep loading.
 */
interface StoredRoom {
  code: string;
  status: RoomStatus;
  players: { id: string; name: string }[];
}

/**
 * Write-through cache over SQLite: every room is loaded at startup and each
 * save is written to the database before the cache is updated.
 */
@Injectable()
export class SqliteRoomRepository implements RoomRepository, OnModuleInit {
  private readonly cache = new Map<string, Room>();

  constructor(@Inject(SQLITE_DATABASE) private readonly db: SqliteDatabase) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS room_snapshots (
        code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  onModuleInit(): void {
    const rows = this.db
      .prepare('SELECT payload FROM room_snapshots')
      .all() as Array<{ payload: string }>;
    for (const row of rows) {
      const room = fromStored(JSON.parse(row.payload) as StoredRoom);
      this.cache.set(room.code.value, room);
    }
  }

  findByCode(code: RoomCode): Room | null {
    return this.cache.get(code.value) ?? null;
  }

  exists(code: RoomCode): boolean {
    return this.cache.has(code.value);
  }

  save(room: Room): void {
    this.db
      .prepare(
        `INSERT INTO room_snapshots (code, payload, updated_at)
         VALUES (@code, @payload, @updatedAt)
         ON CONFLICT(code) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
      .run({
        code: room.code.value,
        payload: JSON.stringify(toStored(room)),
        updatedAt: new Date().toISOString(),
      });
    this.cache.set(room.code.value, room);
  }
}

function fromStored(stored: StoredRoom): Room {
  return Room.rehydrate(RoomCode.parse(stored.code), stored.players);
}

function toStored(room: Room): StoredRoom {
  return {
    code: room.code.value,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
    })),
  };
}
