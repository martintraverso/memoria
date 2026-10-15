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

  it('stores the same JSON shape as before the refactor', () => {
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
    });
  });
});
