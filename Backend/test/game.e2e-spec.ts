import request from 'supertest';
import {
  bodyOf,
  connectClient,
  createTempDatabasePath,
  delay,
  pairsByValue,
  readGameSnapshot,
  RecordingClient,
  RoomResponse,
  startTestApp,
  TestApp,
} from './support/test-app';

// Characterization tests: they pin the current Socket.IO protocol (event
// names, order, recipients and payloads) so the hexagonal refactor
// (docs/hexagonal-refactor-plan.md) can't change it.

interface PublicGameState {
  roomCode: string;
  boardSize: number;
  status: 'playing' | 'finished';
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: { id: string; value: string; state: string }[];
  scores: { playerId: string; playerName: string; points: number }[];
  winnerPlayerId: string | null;
}

interface Match {
  roomCode: string;
  creatorId: string;
  guestId: string;
  creator: RecordingClient;
  guest: RecordingClient;
}

// Nest's default WS exception filter hides the HttpException messages and
// echoes the rejected request back as `cause`.
function wsException(pattern: string, data: object) {
  return {
    event: 'exception',
    payload: {
      status: 'error',
      message: 'Internal server error',
      cause: { pattern, data },
    },
  };
}
// Time to wait for stray events after the expected ones have arrived.
const SETTLE_MS = 100;

describe('Game Socket.IO protocol (e2e)', () => {
  const database = createTempDatabasePath();
  let testApp: TestApp;
  const clients: RecordingClient[] = [];

  beforeAll(async () => {
    testApp = await startTestApp(database.path);
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.disconnect());
  });

  afterAll(async () => {
    await testApp.close();
    database.cleanup();
  });

  const http = () => request(testApp.app.getHttpServer());

  async function createRoom(): Promise<RoomResponse> {
    return bodyOf<RoomResponse>(
      await http().post('/api/rooms').send({ playerName: 'Ana' }).expect(201),
    );
  }

  async function connect(): Promise<RecordingClient> {
    const client = await connectClient(testApp.baseUrl);
    clients.push(client);
    return client;
  }

  async function subscribe(
    client: RecordingClient,
    roomCode: string,
  ): Promise<void> {
    const before = client.events.length;
    client.socket.emit('room.subscribe', { roomCode });
    await client.waitForEventCount(before + 1);
  }

  /** Creates a ready room with both players connected and subscribed. */
  async function setupMatch(): Promise<Match> {
    const created = await createRoom();
    const roomCode = created.room.code;
    const joined = bodyOf<RoomResponse>(
      await http()
        .post(`/api/rooms/${roomCode}/join`)
        .send({ playerName: 'Beto' })
        .expect(201),
    );

    const creator = await connect();
    const guest = await connect();
    await subscribe(creator, roomCode);
    await subscribe(guest, roomCode);
    creator.clear();
    guest.clear();

    return {
      roomCode,
      creatorId: created.playerId,
      guestId: joined.playerId,
      creator,
      guest,
    };
  }

  async function startGame(
    match: Match,
    boardSize: number,
  ): Promise<PublicGameState> {
    match.creator.socket.emit('game.start.request', {
      roomCode: match.roomCode,
      playerId: match.creatorId,
      boardSize,
    });
    await match.creator.waitForEventCount(3);
    await match.guest.waitForEventCount(2);
    const state = match.guest.events[0].payload as PublicGameState;
    await settleAndClear(match);
    return state;
  }

  async function flip(
    match: Match,
    flipper: RecordingClient,
    playerId: string,
    cardId: string,
    expectedObserverEvents: number,
  ): Promise<void> {
    flipper.socket.emit('card.flip.request', {
      roomCode: match.roomCode,
      playerId,
      cardId,
    });
    const observer = flipper === match.creator ? match.guest : match.creator;
    await observer.waitForEventCount(expectedObserverEvents);
    await flipper.waitForEventCount(expectedObserverEvents + 1);
    await delay(SETTLE_MS);
  }

  async function settleAndClear(match: Match): Promise<void> {
    await delay(SETTLE_MS);
    match.creator.clear();
    match.guest.clear();
  }

  function lastState(client: RecordingClient): PublicGameState {
    return client.events[client.events.length - 1].payload as PublicGameState;
  }

  it('answers game.ping with game.pong', async () => {
    const client = await connect();

    client.socket.emit('game.ping', { timestamp: 42 });
    await client.waitForEventCount(1);

    expect(client.events).toEqual([
      { event: 'game.pong', payload: { timestamp: 42 } },
    ]);
  });

  it('acknowledges room.subscribe with the normalized code and no state before a game', async () => {
    const roomCode = (await createRoom()).room.code;
    const client = await connect();

    client.socket.emit('room.subscribe', {
      roomCode: ` ${roomCode.toLowerCase()} `,
    });
    await client.waitForEventCount(1);
    await delay(SETTLE_MS);

    expect(client.events).toEqual([
      { event: 'room.joined', payload: { roomCode } },
    ]);
  });

  it('starts a game: broadcasts game.started + game.state.updated and hides card values', async () => {
    const match = await setupMatch();

    match.creator.socket.emit('game.start.request', {
      roomCode: match.roomCode.toLowerCase(),
      playerId: match.creatorId,
      boardSize: 2,
    });
    await match.creator.waitForEventCount(3);
    await match.guest.waitForEventCount(2);
    await delay(SETTLE_MS);

    // The requester also gets its own response after the room broadcast.
    expect(match.creator.eventNames()).toEqual([
      'game.started',
      'game.state.updated',
      'game.started',
    ]);
    expect(match.guest.eventNames()).toEqual([
      'game.started',
      'game.state.updated',
    ]);

    const state = match.guest.events[0].payload as PublicGameState;
    expect(state).toEqual({
      roomCode: match.roomCode,
      boardSize: 2,
      status: 'playing',
      players: [
        { id: match.creatorId, name: 'Ana' },
        { id: match.guestId, name: 'Beto' },
      ],
      turnPlayerId: match.creatorId,
      cards: state.cards,
      scores: [
        { playerId: match.creatorId, playerName: 'Ana', points: 0 },
        { playerId: match.guestId, playerName: 'Beto', points: 0 },
      ],
      winnerPlayerId: null,
    });
    expect(state.cards).toHaveLength(4);
    for (const card of state.cards) {
      expect(card).toEqual({ id: card.id, state: 'hidden', value: '' });
      expect(card.id).toBeTruthy();
    }
    for (const event of [...match.creator.events, ...match.guest.events]) {
      expect(event.payload).toEqual(state);
    }

    const rest = await http().get(`/api/games/${match.roomCode}`).expect(200);
    expect(bodyOf<PublicGameState>(rest)).toEqual(state);
  });

  it('builds odd boards with one visible blocked card', async () => {
    const match = await setupMatch();
    const state = await startGame(match, 3);

    expect(state.cards).toHaveLength(9);
    const blocked = state.cards.filter((card) => card.state === 'blocked');
    expect(blocked).toEqual([
      { id: blocked[0]?.id, state: 'blocked', value: 'blocked' },
    ]);
    expect(state.cards.filter((card) => card.state === 'hidden')).toHaveLength(
      8,
    );
  });

  it('defaults the board size to 4 when it is missing', async () => {
    const match = await setupMatch();

    match.creator.socket.emit('game.start.request', {
      roomCode: match.roomCode,
      playerId: match.creatorId,
    });
    await match.guest.waitForEventCount(2);

    expect((match.guest.events[0].payload as PublicGameState).boardSize).toBe(
      4,
    );
  });

  it('returns the existing game when the start is requested again', async () => {
    const match = await setupMatch();
    const first = await startGame(match, 2);

    match.creator.socket.emit('game.start.request', {
      roomCode: match.roomCode,
      playerId: match.creatorId,
      boardSize: 4,
    });
    await match.guest.waitForEventCount(2);
    await delay(SETTLE_MS);

    expect(match.guest.eventNames()).toEqual([
      'game.started',
      'game.state.updated',
    ]);
    expect(match.guest.events[0].payload).toEqual(first);
  });

  it('delivers the start broadcast to a requester that never subscribed', async () => {
    const created = await createRoom();
    await http()
      .post(`/api/rooms/${created.room.code}/join`)
      .send({ playerName: 'Beto' });
    const requester = await connect();

    requester.socket.emit('game.start.request', {
      roomCode: created.room.code,
      playerId: created.playerId,
      boardSize: 2,
    });
    await requester.waitForEventCount(3);
    await delay(SETTLE_MS);

    expect(requester.eventNames()).toEqual([
      'game.started',
      'game.state.updated',
      'game.started',
    ]);
  });

  it('does not add the requester to the room when the start is rejected', async () => {
    const match = await setupMatch();
    const outsider = await connect();

    const rejected = {
      roomCode: match.roomCode,
      playerId: match.guestId,
      boardSize: 2,
    };
    outsider.socket.emit('game.start.request', rejected);
    await outsider.waitForEventCount(1);
    expect(outsider.events).toEqual([
      wsException('game.start.request', rejected),
    ]);
    outsider.clear();

    await startGame(match, 2);
    await delay(SETTLE_MS);
    expect(outsider.events).toEqual([]);
  });

  it('sends the current state to late subscribers and on game.state.request', async () => {
    const match = await setupMatch();
    const state = await startGame(match, 2);
    const late = await connect();

    late.socket.emit('room.subscribe', { roomCode: match.roomCode });
    await late.waitForEventCount(2);
    expect(late.events).toEqual([
      { event: 'game.state.updated', payload: state },
      { event: 'room.joined', payload: { roomCode: match.roomCode } },
    ]);

    late.clear();
    late.socket.emit('game.state.request', {
      roomCode: match.roomCode.toLowerCase(),
    });
    await late.waitForEventCount(1);
    expect(late.events).toEqual([
      { event: 'game.state.updated', payload: state },
    ]);
  });

  it('plays a full game: first flip, mismatch with 1s delay, matches and finish', async () => {
    const match = await setupMatch();
    await startGame(match, 3);
    const [p0, p1, p2, p3] = pairsByValue(
      readGameSnapshot(database.path, match.roomCode),
    );
    const { creator, guest, creatorId, guestId } = match;

    // Creator: match on the first pair. The turn passes to the guest.
    await flip(match, creator, creatorId, p0[0], 2);
    expect(guest.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
    ]);
    expect(creator.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'card.flip.applied',
    ]);
    const revealed = lastState(guest).cards.find((card) => card.id === p0[0]);
    expect(revealed?.state).toBe('revealed');
    expect(revealed?.value).toMatch(/^img-\d$/);
    expect(lastState(guest).turnPlayerId).toBe(creatorId);
    await settleAndClear(match);

    await flip(match, creator, creatorId, p0[1], 4);
    expect(guest.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'score.updated',
      'turn.changed',
    ]);
    expect(creator.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'score.updated',
      'turn.changed',
      'card.flip.applied',
    ]);
    let state = lastState(guest);
    expect(state.turnPlayerId).toBe(guestId);
    expect(state.cards.filter((card) => card.state === 'matched')).toHaveLength(
      2,
    );
    expect(state.scores.map((score) => score.points)).toEqual([1, 0]);
    await settleAndClear(match);

    // Guest: mismatch. The cards stay revealed until the 1s timer hides them.
    await flip(match, guest, guestId, p1[0], 2);
    await settleAndClear(match);
    const mismatchAt = Date.now();
    await flip(match, guest, guestId, p2[0], 2);
    expect(creator.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
    ]);
    expect(guest.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'card.flip.applied',
    ]);
    expect(
      lastState(creator).cards.filter((card) => card.state === 'revealed'),
    ).toHaveLength(2);
    expect(
      readGameSnapshot(database.path, match.roomCode).openedCardIds,
    ).toEqual([p1[0], p2[0]]);

    // A third flip while the mismatch is pending is rejected.
    guest.clear();
    const pendingFlip = {
      roomCode: match.roomCode,
      playerId: guestId,
      cardId: p3[0],
    };
    guest.socket.emit('card.flip.request', pendingFlip);
    await guest.waitForEventCount(1);
    expect(guest.events).toEqual([
      wsException('card.flip.request', pendingFlip),
    ]);
    await settleAndClear(match);

    await creator.waitForEventCount(3, 2000);
    expect(Date.now() - mismatchAt).toBeGreaterThanOrEqual(900);
    await delay(SETTLE_MS);
    for (const client of [creator, guest]) {
      expect(client.eventNames()).toEqual([
        'cards.hidden',
        'turn.changed',
        'game.state.updated',
      ]);
    }
    state = lastState(creator);
    expect(state.turnPlayerId).toBe(creatorId);
    expect(
      state.cards.filter((card) => card.state === 'revealed'),
    ).toHaveLength(0);
    expect(state.cards.find((card) => card.id === p1[0])).toEqual({
      id: p1[0],
      state: 'hidden',
      value: '',
    });
    expect(
      readGameSnapshot(database.path, match.roomCode).openedCardIds,
    ).toEqual([]);
    await settleAndClear(match);

    // Creator matches p1, guest matches p2, creator matches p3 and wins 3-1.
    await flip(match, creator, creatorId, p1[0], 2);
    await flip(match, creator, creatorId, p1[1], 4);
    await settleAndClear(match);
    await flip(match, guest, guestId, p2[0], 2);
    await flip(match, guest, guestId, p2[1], 4);
    await settleAndClear(match);
    await flip(match, creator, creatorId, p3[0], 2);
    await settleAndClear(match);
    await flip(match, creator, creatorId, p3[1], 4);

    expect(guest.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'score.updated',
      'game.finished',
    ]);
    expect(creator.eventNames()).toEqual([
      'card.flip.applied',
      'game.state.updated',
      'score.updated',
      'game.finished',
      'card.flip.applied',
    ]);
    state = lastState(guest);
    expect(state.status).toBe('finished');
    expect(state.turnPlayerId).toBeNull();
    expect(state.winnerPlayerId).toBe(creatorId);
    expect(state.scores.map((score) => score.points)).toEqual([3, 1]);
    expect(state.cards.filter((card) => card.state === 'matched')).toHaveLength(
      8,
    );
    // Once revealed or matched, card values are public.
    expect(state.cards.every((card) => card.value !== '')).toBe(true);

    // No moves after the game is over.
    await settleAndClear(match);
    const lateFlip = {
      roomCode: match.roomCode,
      playerId: creatorId,
      cardId: p0[0],
    };
    creator.socket.emit('card.flip.request', lateFlip);
    await creator.waitForEventCount(1);
    expect(creator.events).toEqual([
      wsException('card.flip.request', lateFlip),
    ]);
  });

  it('declares a draw when both players score the same', async () => {
    const match = await setupMatch();
    await startGame(match, 2);
    const [p0, p1] = pairsByValue(
      readGameSnapshot(database.path, match.roomCode),
    );

    await flip(match, match.creator, match.creatorId, p0[0], 2);
    await flip(match, match.creator, match.creatorId, p0[1], 4);
    await settleAndClear(match);
    await flip(match, match.guest, match.guestId, p1[0], 2);
    await flip(match, match.guest, match.guestId, p1[1], 4);

    const state = lastState(match.creator);
    expect(state.status).toBe('finished');
    expect(state.winnerPlayerId).toBeNull();
    expect(state.scores.map((score) => score.points)).toEqual([1, 1]);
  });

  describe('rejected requests (only the requester gets an exception event)', () => {
    async function expectRejected(
      match: Match,
      client: RecordingClient,
      event: string,
      payload: object,
    ): Promise<void> {
      client.socket.emit(event, payload);
      await client.waitForEventCount(1);
      await delay(SETTLE_MS);
      expect(client.events).toEqual([wsException(event, payload)]);
      const other = client === match.creator ? match.guest : match.creator;
      expect(other.events).toEqual([]);
    }

    it('rejects starting a game before the room is ready', async () => {
      const created = await createRoom();
      const client = await connect();

      const startRequest = {
        roomCode: created.room.code,
        playerId: created.playerId,
        boardSize: 2,
      };
      client.socket.emit('game.start.request', startRequest);
      await client.waitForEventCount(1);
      expect(client.events).toEqual([
        wsException('game.start.request', startRequest),
      ]);
    });

    it('rejects a start from the guest, an unknown player or an invalid board size', async () => {
      const match = await setupMatch();
      const { roomCode } = match;

      await expectRejected(match, match.guest, 'game.start.request', {
        roomCode,
        playerId: match.guestId,
        boardSize: 2,
      });
      match.guest.clear();
      await expectRejected(match, match.creator, 'game.start.request', {
        roomCode,
        playerId: 'intruder',
        boardSize: 2,
      });
      for (const boardSize of [1, 6, 2.5]) {
        match.creator.clear();
        await expectRejected(match, match.creator, 'game.start.request', {
          roomCode,
          playerId: match.creatorId,
          boardSize,
        });
      }
      await http().get(`/api/games/${roomCode}`).expect(404);
    });

    it('rejects flips out of turn, on unknown cards and on already revealed cards', async () => {
      const match = await setupMatch();
      const state = await startGame(match, 2);
      const { roomCode, creatorId, guestId } = match;

      await expectRejected(match, match.guest, 'card.flip.request', {
        roomCode,
        playerId: guestId,
        cardId: state.cards[0].id,
      });
      match.guest.clear();
      await expectRejected(match, match.creator, 'card.flip.request', {
        roomCode,
        playerId: creatorId,
        cardId: 'missing-card',
      });
      match.creator.clear();

      await flip(match, match.creator, creatorId, state.cards[0].id, 2);
      await settleAndClear(match);
      await expectRejected(match, match.creator, 'card.flip.request', {
        roomCode,
        playerId: creatorId,
        cardId: state.cards[0].id,
      });
    });

    it('rejects requests for a room without a game or without a code', async () => {
      const client = await connect();

      for (const [event, payload] of [
        ['game.state.request', { roomCode: 'ZZZZZZ' }],
        [
          'card.flip.request',
          { roomCode: 'ZZZZZZ', playerId: 'x', cardId: 'y' },
        ],
        ['room.subscribe', { roomCode: '   ' }],
      ] as const) {
        client.clear();
        client.socket.emit(event, payload);
        await client.waitForEventCount(1);
        expect(client.events).toEqual([wsException(event, payload)]);
      }
    });
  });
});
