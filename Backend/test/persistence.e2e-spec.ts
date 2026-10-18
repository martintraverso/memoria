import request from 'supertest';
import {
  bodyOf,
  connectClient,
  createTempDatabasePath,
  delay,
  pairsByValue,
  readGameSnapshot,
  readRoomSnapshot,
  RoomResponse,
  startTestApp,
  TestApp,
} from './support/test-app';

// Characterization tests: rooms and games must survive a restart, and the
// JSON stored in SQLite must keep its current shape so existing
// data/memoria.sqlite files still load after the hexagonal refactor.
describe('SQLite persistence (e2e)', () => {
  const database = createTempDatabasePath();
  let testApp: TestApp | undefined;

  afterEach(async () => {
    await testApp?.close();
    testApp = undefined;
  });

  afterAll(() => database.cleanup());

  async function getJson(app: TestApp, path: string): Promise<unknown> {
    return bodyOf<unknown>(
      await request(app.app.getHttpServer()).get(path).expect(200),
    );
  }

  it('cancels a pending mismatch timer on shutdown', async () => {
    const app = await startTestApp(database.path);
    testApp = app;
    const http = () => request(app.app.getHttpServer());
    const created = bodyOf<RoomResponse>(
      await http().post('/api/rooms').send({ playerName: 'Ana' }),
    );
    const roomCode = created.room.code;
    await http()
      .post(`/api/rooms/${roomCode}/join`)
      .send({ playerName: 'Beto' });

    const client = await connectClient(app.baseUrl);
    client.socket.emit('game.start.request', {
      roomCode,
      playerId: created.playerId,
      boardSize: 2,
    });
    await client.waitForEventCount(3);
    const [first, second] = pairsByValue(
      readGameSnapshot(database.path, roomCode),
    );
    for (const cardId of [first[0], second[0]]) {
      client.clear();
      client.socket.emit('card.flip.request', {
        roomCode,
        playerId: created.playerId,
        cardId,
      });
      await client.waitForEventCount(3);
    }
    client.disconnect();

    await app.close();
    testApp = undefined;
    await delay(1300);

    // The timer never ran: the mismatch is still pending in the database.
    expect(readGameSnapshot(database.path, roomCode).openedCardIds).toEqual([
      first[0],
      second[0],
    ]);
  });

  it('restores rooms and in-progress games after a restart', async () => {
    const firstRun = await startTestApp(database.path);
    testApp = firstRun;
    const http = () => request(firstRun.app.getHttpServer());

    const created = bodyOf<RoomResponse>(
      await http().post('/api/rooms').send({ playerName: 'Ana' }),
    );
    const roomCode = created.room.code;
    const creatorId = created.playerId;
    const guestId = bodyOf<RoomResponse>(
      await http()
        .post(`/api/rooms/${roomCode}/join`)
        .send({ playerName: 'Beto' }),
    ).playerId;

    const client = await connectClient(firstRun.baseUrl);
    client.socket.emit('game.start.request', {
      roomCode,
      playerId: creatorId,
      boardSize: 3,
    });
    await client.waitForEventCount(3);
    const cardId = readGameSnapshot(database.path, roomCode).cards.find(
      (card) => card.state === 'hidden',
    )!.id;
    client.clear();
    client.socket.emit('card.flip.request', {
      roomCode,
      playerId: creatorId,
      cardId,
    });
    await client.waitForEventCount(3);
    client.disconnect();

    const roomBefore = await getJson(firstRun, `/api/rooms/${roomCode}`);
    const gameBefore = await getJson(firstRun, `/api/games/${roomCode}`);
    const storedGameBefore = readGameSnapshot(database.path, roomCode);

    // Snapshot shapes are a compatibility contract.
    const players = [
      { id: creatorId, name: 'Ana' },
      { id: guestId, name: 'Beto' },
    ];
    expect(readRoomSnapshot(database.path, roomCode)).toEqual({
      code: roomCode,
      status: 'ready',
      players,
    });
    expect(storedGameBefore).toEqual({
      roomCode,
      boardSize: 3,
      status: 'playing',
      players,
      turnPlayerId: creatorId,
      cards: storedGameBefore.cards,
      openedCardIds: [cardId],
      scores: [
        { playerId: creatorId, playerName: 'Ana', points: 0 },
        { playerId: guestId, playerName: 'Beto', points: 0 },
      ],
      winnerPlayerId: null,
      totalMatchablePairs: 4,
      matchedPairs: 0,
    });
    // Stored cards keep their real values, even hidden ones.
    expect(storedGameBefore.cards).toHaveLength(9);
    expect(
      storedGameBefore.cards.every(
        (card) => /^img-\d$/.test(card.value) || card.value === 'blocked',
      ),
    ).toBe(true);

    await firstRun.close();
    const secondRun = await startTestApp(database.path);
    testApp = secondRun;

    expect(await getJson(secondRun, `/api/rooms/${roomCode}`)).toEqual(
      roomBefore,
    );
    expect(await getJson(secondRun, `/api/games/${roomCode}`)).toEqual(
      gameBefore,
    );
    expect(readGameSnapshot(database.path, roomCode)).toEqual(storedGameBefore);

    // The restored game is still playable from where it stopped. Flip the
    // matching card: a mismatch would leave a 1s timer running after close.
    const restored = await connectClient(secondRun.baseUrl);
    const firstValue = storedGameBefore.cards.find(
      (card) => card.id === cardId,
    )!.value;
    const secondCardId = storedGameBefore.cards.find(
      (card) => card.value === firstValue && card.id !== cardId,
    )!.id;
    restored.socket.emit('room.subscribe', { roomCode });
    await restored.waitForEventCount(2);
    restored.clear();
    restored.socket.emit('card.flip.request', {
      roomCode,
      playerId: creatorId,
      cardId: secondCardId,
    });
    await restored.waitForEventCount(5);
    expect(restored.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'score.updated',
      'turn.changed',
      'card.flip.applied',
    ]);
    const storedAfter = readGameSnapshot(database.path, roomCode);
    expect(storedAfter.openedCardIds).toEqual([]);
    expect(storedAfter.matchedPairs).toBe(1);
    restored.disconnect();
  });
});
