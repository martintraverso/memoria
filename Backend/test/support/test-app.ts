import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';

export interface TestApp {
  app: INestApplication<Server>;
  baseUrl: string;
  close(): Promise<void>;
}

export interface RoomResponse {
  room: {
    code: string;
    status: 'lobby' | 'ready';
    players: { id: string; name: string }[];
  };
  playerId: string;
}

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

/** Types a supertest response body, which supertest leaves as `any`. */
export function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

export function createTempDatabasePath(): {
  path: string;
  cleanup(): void;
} {
  const directory = mkdtempSync(join(tmpdir(), 'memoria-e2e-'));
  return {
    path: join(directory, 'memoria.sqlite'),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

/** Boots the real AppModule like main.ts does, listening on a random port. */
export async function startTestApp(databasePath: string): Promise<TestApp> {
  process.env.DATABASE_PATH = databasePath;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<Server>>();
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');

  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => app.close(),
  };
}

export interface RecordedEvent {
  event: string;
  payload: unknown;
}

export interface RecordingClient {
  socket: Socket;
  events: RecordedEvent[];
  eventNames(): string[];
  clear(): void;
  waitForEventCount(count: number, timeoutMs?: number): Promise<void>;
  disconnect(): void;
}

export async function connectClient(baseUrl: string): Promise<RecordingClient> {
  const socket = io(`${baseUrl}/game`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  const events: RecordedEvent[] = [];
  socket.onAny((event: string, payload: unknown) => {
    events.push({ event, payload });
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });

  return {
    socket,
    events,
    eventNames: () => events.map((item) => item.event),
    clear: () => {
      events.length = 0;
    },
    waitForEventCount: (count, timeoutMs = 3000) =>
      waitUntil(() => events.length >= count, timeoutMs),
    disconnect: () => {
      socket.disconnect();
    },
  };
}

export async function waitUntil(
  condition: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await delay(10);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads the stored game snapshot straight from SQLite. Tests use it to learn
 * hidden card values without going through the (value-hiding) public API.
 * The snapshot format is part of the contract this refactor must preserve.
 */
export function readGameSnapshot(
  databasePath: string,
  roomCode: string,
): StoredGameSnapshot {
  return readSnapshot<StoredGameSnapshot>(
    databasePath,
    'SELECT payload FROM game_snapshots WHERE room_code = ?',
    roomCode,
  );
}

export function readRoomSnapshot(
  databasePath: string,
  roomCode: string,
): Record<string, unknown> {
  return readSnapshot<Record<string, unknown>>(
    databasePath,
    'SELECT payload FROM room_snapshots WHERE code = ?',
    roomCode,
  );
}

function readSnapshot<T>(databasePath: string, sql: string, key: string): T {
  const db = new Database(databasePath, { readonly: true });
  try {
    const row = db.prepare(sql).get(key) as { payload: string } | undefined;
    if (!row) {
      throw new Error(`No snapshot stored for ${key}`);
    }
    return JSON.parse(row.payload) as T;
  } finally {
    db.close();
  }
}

export interface StoredGameSnapshot {
  roomCode: string;
  boardSize: number;
  status: string;
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: { id: string; value: string; state: string }[];
  openedCardIds: string[];
  scores: { playerId: string; playerName: string; points: number }[];
  winnerPlayerId: string | null;
  totalMatchablePairs: number;
  matchedPairs: number;
}

/** Returns the card ids grouped by value, ignoring the blocked card. */
export function pairsByValue(snapshot: StoredGameSnapshot): string[][] {
  const pairs = new Map<string, string[]>();
  for (const card of snapshot.cards) {
    if (card.state === 'blocked') {
      continue;
    }
    pairs.set(card.value, [...(pairs.get(card.value) ?? []), card.id]);
  }
  return Array.from(pairs.values());
}
