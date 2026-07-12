import { ConflictException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  let roomsService: RoomsService;

  beforeEach(() => {
    roomsService = new RoomsService();
  });

  it('creates a room and allows a second player to join', () => {
    const { room, playerId: firstPlayerId } =
      roomsService.createRoom('Jugador 1');

    expect(room.code).toHaveLength(6);
    expect(firstPlayerId).toBeTruthy();
    expect(room.status).toBe('lobby');
    expect(room.players).toHaveLength(1);

    const joinResult = roomsService.joinRoom(room.code, 'Jugador 2');
    expect(joinResult.playerId).toBeTruthy();
    expect(joinResult.room.players).toHaveLength(2);
    expect(joinResult.room.status).toBe('ready');
  });

  it('rejects joining a full room', () => {
    const { room } = roomsService.createRoom('Jugador 1');
    roomsService.joinRoom(room.code, 'Jugador 2');

    expect(() => roomsService.joinRoom(room.code, 'Jugador 3')).toThrow(
      ConflictException,
    );
  });
});
