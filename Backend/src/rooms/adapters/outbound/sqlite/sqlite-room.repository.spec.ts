import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openSqliteDatabase,
  type SqliteDatabase,
} from '../../../../persistence/sqlite-database';
import { Room } from '../../../domain/room';
import { RoomCode } from '../../../../shared/domain/room-code';
import { describeRoomRepositoryContract } from '../room-repository.contract-spec';
import { SqliteRoomRepository } from './sqlite-room.repository';

describe('SqliteRoomRepository', () => {
  let directory: string;
  let databasePath: string;
  let openDatabases: SqliteDatabase[];

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'memoria-rooms-'));
    databasePath = join(directory, 'memoria.sqlite');
    openDatabases = [];
  });

  afterEach(() => {
    openDatabases.forEach((db) => db.close());
    rmSync(directory, { recursive: true, force: true });
  });

  function openRepository(): SqliteRoomRepository {
    const db = openSqliteDatabase(databasePath);
    openDatabases.push(db);
    const repository = new SqliteRoomRepository(db);
    repository.onModuleInit();
    return repository;
  }

  describeRoomRepositoryContract(openRepository);

  it('loads saved rooms when it starts again', () => {
    const code = RoomCode.parse('ABC234');
    openRepository().save(Room.create(code, 'p1', 'Ana').join('p2', 'Beto'));

    const reopened = openRepository();

    expect(reopened.exists(code)).toBe(true);
    expect(reopened.findByCode(code)?.status).toBe('ready');
    expect(reopened.findByCode(code)?.players).toEqual([
      { id: 'p1', name: 'Ana' },
      { id: 'p2', name: 'Beto' },
    ]);
  });

  it('stores the same JSON shape as before the refactor', () => {
    openRepository().save(Room.create(RoomCode.parse('ABC234'), 'p1', 'Ana'));

    const db = new Database(databasePath, { readonly: true });
    const row = db
      .prepare('SELECT code, payload FROM room_snapshots')
      .get() as { code: string; payload: string };
    db.close();

    expect(row.code).toBe('ABC234');
    expect(JSON.parse(row.payload)).toEqual({
      code: 'ABC234',
      status: 'lobby',
      players: [{ id: 'p1', name: 'Ana' }],
    });
  });
});
