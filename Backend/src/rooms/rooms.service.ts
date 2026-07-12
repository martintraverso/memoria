import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RoomPlayer, RoomSnapshot, RoomStatus } from './room.types';
import { SQLitePersistenceService } from '../persistence/sqlite-persistence.service';

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly rooms = new Map<string, RoomSnapshot>();

  constructor(
    @Optional()
    private readonly persistenceService?: SQLitePersistenceService,
  ) {}

  onModuleInit(): void {
    if (!this.persistenceService) {
      return;
    }

    for (const room of this.persistenceService.loadRooms<RoomSnapshot>()) {
      this.rooms.set(room.code, room);
    }
  }

  createRoom(playerName: string): { room: RoomSnapshot; playerId: string } {
    const sanitizedPlayerName = this.validatePlayerName(playerName);
    const code = this.generateRoomCode();
    const player: RoomPlayer = {
      id: randomUUID(),
      name: sanitizedPlayerName,
    };
    const room: RoomSnapshot = {
      code,
      status: 'lobby',
      players: [player],
    };
    this.rooms.set(code, room);
    this.persistRoom(room);
    return { room, playerId: player.id };
  }

  joinRoom(
    roomCode: string,
    playerName: string,
  ): { room: RoomSnapshot; playerId: string } {
    const sanitizedCode = this.normalizeRoomCode(roomCode);
    const room = this.rooms.get(sanitizedCode);

    if (!room) {
      throw new NotFoundException('La sala no existe.');
    }

    if (room.players.length >= 2) {
      throw new ConflictException('La sala ya tiene 2 jugadores.');
    }

    const sanitizedPlayerName = this.validatePlayerName(playerName);
    const player: RoomPlayer = {
      id: randomUUID(),
      name: sanitizedPlayerName,
    };

    room.players.push(player);
    room.status = this.resolveRoomStatus(room.players.length);
    this.rooms.set(sanitizedCode, room);
    this.persistRoom(room);

    return { room, playerId: player.id };
  }

  getRoom(roomCode: string): RoomSnapshot {
    const sanitizedCode = this.normalizeRoomCode(roomCode);
    const room = this.rooms.get(sanitizedCode);
    if (!room) {
      throw new NotFoundException('La sala no existe.');
    }
    return room;
  }

  private validatePlayerName(playerName: string): string {
    const sanitizedPlayerName = playerName?.trim();
    if (!sanitizedPlayerName) {
      throw new BadRequestException('El nombre del jugador es obligatorio.');
    }
    return sanitizedPlayerName;
  }

  private resolveRoomStatus(playersCount: number): RoomStatus {
    return playersCount === 2 ? 'ready' : 'lobby';
  }

  private normalizeRoomCode(roomCode: string): string {
    const normalizedRoomCode = roomCode?.trim().toUpperCase();
    if (!normalizedRoomCode) {
      throw new BadRequestException('El código de sala es obligatorio.');
    }
    return normalizedRoomCode;
  }

  private generateRoomCode(): string {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const roomCodeLength = 6;
    let code = '';

    do {
      code = Array.from({ length: roomCodeLength }, () => {
        const index = Math.floor(Math.random() * characters.length);
        return characters[index];
      }).join('');
    } while (this.rooms.has(code));

    return code;
  }

  private persistRoom(room: RoomSnapshot): void {
    if (!this.persistenceService) {
      return;
    }
    this.persistenceService.saveRoom(room.code, room);
  }
}
