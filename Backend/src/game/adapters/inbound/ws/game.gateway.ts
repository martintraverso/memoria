import { Logger, UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { WsResponse } from '@nestjs/websockets';
import { DomainErrorWsFilter } from '../../../../shared/adapters/ws/domain-error.filter';
import { RoomCode } from '../../../../shared/domain/room-code';
import { FlipCardUseCase } from '../../../application/use-cases/flip-card.use-case';
import { GetGameStateUseCase } from '../../../application/use-cases/get-game-state.use-case';
import { RequestRematchUseCase } from '../../../application/use-cases/request-rematch.use-case';
import { StartGameUseCase } from '../../../application/use-cases/start-game.use-case';
import type { PublicGameState } from '../../../domain/public-game-state';
import { SocketServerRef } from '../../outbound/ws/socket-server.ref';

/**
 * Translates Socket.IO messages into use case calls. Room broadcasts are
 * sent by the use cases through the GameEvents port; this class only
 * manages socket room membership and replies to the requester.
 */
@UseFilters(new DomainErrorWsFilter())
@WebSocketGateway({
  namespace: 'game',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly startGameUseCase: StartGameUseCase,
    private readonly flipCardUseCase: FlipCardUseCase,
    private readonly getGameStateUseCase: GetGameStateUseCase,
    private readonly requestRematchUseCase: RequestRematchUseCase,
    private readonly serverRef: SocketServerRef,
  ) {}

  afterInit(namespace: Namespace): void {
    this.serverRef.attach(namespace);
  }

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
    const roomCode = RoomCode.parse(payload.roomCode).value;
    void client.join(roomCode);

    const state = this.getGameStateUseCase.find({ roomCode });
    if (state) {
      client.emit('game.state.updated', state);
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
  ): WsResponse<PublicGameState> {
    const roomCode = RoomCode.parse(payload.roomCode).value;
    // The requester must be in the room before the use case broadcasts
    // `game.started`, but only stays there if the start succeeds.
    const wasInRoom = client.rooms.has(roomCode);
    void client.join(roomCode);
    try {
      const state = this.startGameUseCase.execute({
        roomCode,
        playerId: payload.playerId ?? '',
        boardSize: payload.boardSize ?? 4,
      });
      return { event: 'game.started', data: state };
    } catch (error) {
      if (!wasInRoom) {
        void client.leave(roomCode);
      }
      throw error;
    }
  }

  @SubscribeMessage('game.state.request')
  handleStateRequest(
    @MessageBody() payload: { roomCode?: string },
  ): WsResponse<PublicGameState> {
    const roomCode = RoomCode.parse(payload.roomCode).value;
    return {
      event: 'game.state.updated',
      data: this.getGameStateUseCase.execute({ roomCode }),
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
  ): WsResponse<PublicGameState> {
    const { state } = this.flipCardUseCase.execute({
      roomCode: RoomCode.parse(payload.roomCode).value,
      playerId: payload.playerId ?? '',
      cardId: payload.cardId ?? '',
    });
    return {
      event: 'card.flip.applied',
      data: state,
    };
  }

  @SubscribeMessage('game.rematch.request')
  handleRematchRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode?: string; playerId?: string },
  ): WsResponse<PublicGameState> {
    const roomCode = RoomCode.parse(payload.roomCode).value;
    // The result screen may ask before it subscribed; the requester must
    // get the room broadcasts, including the start of the new round.
    void client.join(roomCode);
    const { state, outcome } = this.requestRematchUseCase.execute({
      roomCode,
      playerId: payload.playerId ?? '',
    });
    return {
      event: outcome === 'started' ? 'game.started' : 'game.rematch.requested',
      data: state,
    };
  }
}
