import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Injection token for the shared `better-sqlite3` connection. */
export const SQLITE_DATABASE = Symbol('SQLITE_DATABASE');

export type SqliteDatabase = Database.Database;

/**
 * Opens the SQLite file, creating its folder if needed. Each SQLite adapter
 * creates the tables it owns, so this file knows no feature.
 */
export function openSqliteDatabase(
  path = process.env.DATABASE_PATH ?? 'data/memoria.sqlite',
): SqliteDatabase {
  const databasePath = resolve(path);
  mkdirSync(dirname(databasePath), { recursive: true });
  return new Database(databasePath);
}
