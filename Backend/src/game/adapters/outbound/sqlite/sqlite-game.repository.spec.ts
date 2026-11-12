import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openSqliteDatabase,
  type SqliteDatabase,
} from '../../../../persistence/sqlite-database';
import { RoomCode } from '../../../../shared/domain/room-code';
import {
  describeGameRepositoryContract,
  startTestGame,
} from '../game-repository.contract-spec';
import type { StoredGameSnapshot } from '../../../domain/game';
import { SqliteGameRepository } from './sqlite-game.repository';

describe('SqliteGameRepository', () => {
  let directory: string;
  let databasePath: string;
  let openDatabases: SqliteDatabase[];

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'memoria-games-'));
    databasePath = join(directory, 'memoria.sqlite');
    openDatabases = [];
  });

  afterEach(() => {
    openDatabases.forEach((db) => db.close());
    rmSync(directory, { recursive: true, force: true });
  });

  function openRepository(): SqliteGameRepository {
    const db = openSqliteDatabase(databasePath);
    openDatabases.push(db);
    const repository = new SqliteGameRepository(db);
    repository.onModuleInit();
    return repository;
  }

  describeGameRepositoryContract(openRepository);

  it('loads saved games, mid-move, when it starts again', () => {
    const { game } = startTestGame()
      .flip('ana', 'card-1')
      .game.flip('ana', 'card-3');
    openRepository().save(game);

    const restored = openRepository().findByRoomCode(RoomCode.parse('ABC234'));

    expect(restored?.toSnapshot()).toEqual(game.toSnapshot());
    expect(restored?.hasPendingMismatch).toBe(true);
  });

  it('loads rows saved before rematches existed as a first round', () => {
    const legacy: StoredGameSnapshot = startTestGame().toSnapshot();
    delete legacy.round;
    delete legacy.startingPlayerId;
    delete legacy.rematchRequestedBy;
    const db = openSqliteDatabase(databasePath);
    openDatabases.push(db);
    new SqliteGameRepository(db);
    db.prepare(
      `INSERT INTO game_snapshots (room_code, payload, updated_at)
       VALUES ('ABC234', ?, '2026-01-01T00:00:00.000Z')`,
    ).run(JSON.stringify(legacy));

    const restored = openRepository().findByRoomCode(RoomCode.parse('ABC234'));

    expect(restored?.toSnapshot()).toMatchObject({
      round: 1,
      startingPlayerId: 'ana',
      rematchRequestedBy: [],
    });
  });

  it('stores the game snapshot JSON shape, with the round fields', () => {
    openRepository().save(startTestGame().flip('ana', 'card-1').game);

    const db = new Database(databasePath, { readonly: true });
    const row = db
      .prepare('SELECT room_code, payload FROM game_snapshots')
      .get() as { room_code: string; payload: string };
    db.close();

    expect(row.room_code).toBe('ABC234');
    expect(JSON.parse(row.payload)).toEqual({
      roomCode: 'ABC234',
      boardSize: 2,
      status: 'playing',
      players: [
        { id: 'ana', name: 'Ana' },
        { id: 'beto', name: 'Beto' },
      ],
      turnPlayerId: 'ana',
      cards: [
        { id: 'card-1', value: 'img-1', state: 'revealed' },
        { id: 'card-2', value: 'img-1', state: 'hidden' },
        { id: 'card-3', value: 'img-2', state: 'hidden' },
        { id: 'card-4', value: 'img-2', state: 'hidden' },
      ],
      openedCardIds: ['card-1'],
      scores: [
        { playerId: 'ana', playerName: 'Ana', points: 0 },
        { playerId: 'beto', playerName: 'Beto', points: 0 },
      ],
      winnerPlayerId: null,
      totalMatchablePairs: 2,
      matchedPairs: 0,
      round: 1,
      startingPlayerId: 'ana',
      rematchRequestedBy: [],
    });
  });
});
