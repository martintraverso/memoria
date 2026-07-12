import { BadRequestException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { WsResponse } from '@nestjs/websockets';
import { GameService } from './game.service';
import type { FlipResult, GameState } from './game.types';

@WebSocketGateway({
  namespace: 'game',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);
  private readonly mismatchTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('game.ping')
  handlePing(
    @MessageBody() payload?: { timestamp?: number },
  ): WsResponse<{ timestamp: number }> {
    return {
      event: 'game.pong',
      data: { timestamp: payload?.timestamp ?? Date.now() },
    };
  }

  @SubscribeMessage('room.subscribe')
  handleRoomSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode?: string },
  ): WsResponse<{ roomCode: string }> {
    const roomCode = this.normalizeRoomCode(payload.roomCode ?? '');
    void client.join(roomCode);

    if (this.gameService.hasGame(roomCode)) {
      const gameState = this.gameService.getGameState(roomCode);
      client.emit('game.state.updated', gameState);
    }

    return {
      event: 'room.joined',
      data: { roomCode },
    };
  }

  @SubscribeMessage('game.start.request')
  handleGameStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomCode?: string; playerId?: string; boardSize?: number },
  ): WsResponse<GameState> {
    const roomCode = this.normalizeRoomCode(payload.roomCode ?? '');
    const state = this.gameService.startGame(
      roomCode,
      payload.playerId ?? '',
      payload.boardSize ?? 4,
    );
    void client.join(roomCode);
    this.server.to(roomCode).emit('game.started', state);
    this.server.to(roomCode).emit('game.state.updated', state);
    return {
      event: 'game.started',
      data: state,
    };
  }

  @SubscribeMessage('game.state.request')
  handleStateRequest(
    @MessageBody() payload: { roomCode?: string },
  ): WsResponse<GameState> {
    const roomCode = this.normalizeRoomCode(payload.roomCode ?? '');
    const state = this.gameService.getGameState(roomCode);
    return {
      event: 'game.state.updated',
      data: state,
    };
  }

  @SubscribeMessage('card.flip.request')
  handleCardFlip(
    @MessageBody()
    payload: {
      roomCode?: string;
      playerId?: string;
      cardId?: string;
    },
  ): WsResponse<GameState> {
    const roomCode = this.normalizeRoomCode(payload.roomCode ?? '');
    const result = this.gameService.flipCard(
      roomCode,
      payload.playerId ?? '',
      payload.cardId ?? '',
    );

    this.broadcastFlipResult(roomCode, result);

    return {
      event: 'card.flip.applied',
      data: result.state,
    };
  }

  private broadcastFlipResult(roomCode: string, result: FlipResult): void {
    this.server.to(roomCode).emit('card.flip.applied', result.state);
    this.server.to(roomCode).emit('game.state.updated', result.state);

    if (result.scoreChanged) {
      this.server.to(roomCode).emit('score.updated', result.state);
    }

    if (result.finished) {
      this.server.to(roomCode).emit('game.finished', result.state);
      return;
    }

    if (result.turnChanged) {
      this.server.to(roomCode).emit('turn.changed', result.state);
    }

    if (result.mismatchPending) {
      this.scheduleMismatchResolution(roomCode);
    }
  }

  private scheduleMismatchResolution(roomCode: string): void {
    const activeTimer = this.mismatchTimers.get(roomCode);
    if (activeTimer) {
      clearTimeout(activeTimer);
    }

    const timer = setTimeout(() => {
      const updatedState = this.gameService.resolveMismatch(roomCode);
      this.mismatchTimers.delete(roomCode);

      if (!updatedState) {
        return;
      }

      this.server.to(roomCode).emit('cards.hidden', updatedState);
      this.server.to(roomCode).emit('turn.changed', updatedState);
      this.server.to(roomCode).emit('game.state.updated', updatedState);
    }, 1000);

    this.mismatchTimers.set(roomCode, timer);
  }

  private normalizeRoomCode(roomCode: string): string {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('El código de sala es obligatorio.');
    }
    return normalizedCode;
  }
}
