import request from 'supertest';
import {
  bodyOf,
  createTempDatabasePath,
  ErrorResponse,
  RoomResponse,
  startTestApp,
  TestApp,
} from './support/test-app';

// Characterization tests: they pin the current REST behavior so the
// hexagonal refactor (docs/hexagonal-refactor-plan.md) can't change it.
describe('Rooms REST (e2e)', () => {
  const database = createTempDatabasePath();
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await startTestApp(database.path);
  });

  afterAll(async () => {
    await testApp.close();
    database.cleanup();
  });

  const http = () => request(testApp.app.getHttpServer());

  async function createRoom(playerName = 'Ana'): Promise<RoomResponse> {
    return bodyOf<RoomResponse>(
      await http().post('/api/rooms').send({ playerName }).expect(201),
    );
  }

  it('creates a room in lobby with the creator as the only player', async () => {
    const { room, playerId } = await createRoom('  Ana  ');

    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(typeof playerId).toBe('string');
    expect(room).toEqual({
      code: room.code,
      status: 'lobby',
      players: [{ id: playerId, name: 'Ana' }],
    });
  });

  it('rejects a missing or blank player name with 400', async () => {
    for (const body of [{}, { playerName: '   ' }]) {
      const response = await http().post('/api/rooms').send(body).expect(400);
      expect(bodyOf<ErrorResponse>(response).message).toBe(
        'El nombre del jugador es obligatorio.',
      );
    }
  });

  it('lets a second player join with a lowercase, padded code and marks the room ready', async () => {
    const created = await createRoom('Ana');
    const code = created.room.code;

    const joined = bodyOf<RoomResponse>(
      await http()
        .post(
          `/api/rooms/${encodeURIComponent(` ${code.toLowerCase()} `)}/join`,
        )
        .send({ playerName: 'Beto' })
        .expect(201),
    );

    expect(joined.room).toEqual({
      code,
      status: 'ready',
      players: [
        { id: created.playerId, name: 'Ana' },
        { id: joined.playerId, name: 'Beto' },
      ],
    });
    expect(typeof joined.playerId).toBe('string');
    expect(joined.playerId).not.toBe(created.playerId);

    const fetched = await http()
      .get(`/api/rooms/${code.toLowerCase()}`)
      .expect(200);
    expect(bodyOf<RoomResponse['room']>(fetched)).toEqual(joined.room);
  });

  it('rejects a third player with 409', async () => {
    const { room } = await createRoom('Ana');
    await http()
      .post(`/api/rooms/${room.code}/join`)
      .send({ playerName: 'Beto' });

    const response = await http()
      .post(`/api/rooms/${room.code}/join`)
      .send({ playerName: 'Caro' })
      .expect(409);
    expect(bodyOf<ErrorResponse>(response).message).toBe(
      'La sala ya tiene 2 jugadores.',
    );
  });

  it('checks the room exists before validating the joining name', async () => {
    const missing = await http()
      .post('/api/rooms/ZZZZZZ/join')
      .send({ playerName: '' })
      .expect(404);
    expect(bodyOf<ErrorResponse>(missing).message).toBe('La sala no existe.');

    const { room } = await createRoom('Ana');
    const blankName = await http()
      .post(`/api/rooms/${room.code}/join`)
      .send({ playerName: ' ' })
      .expect(400);
    expect(bodyOf<ErrorResponse>(blankName).message).toBe(
      'El nombre del jugador es obligatorio.',
    );
  });

  it('returns 404 for an unknown room', async () => {
    const response = await http().get('/api/rooms/ZZZZZZ').expect(404);
    expect(bodyOf<ErrorResponse>(response)).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'La sala no existe.',
    });
  });

  it('returns 404 for a game that has not started', async () => {
    const { room } = await createRoom('Ana');

    const response = await http().get(`/api/games/${room.code}`).expect(404);
    expect(bodyOf<ErrorResponse>(response)).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'No hay partida activa para esta sala.',
    });
  });
});
