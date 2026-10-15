import type { GameEvents } from '../../../application/ports/outbound/game-events.port';
import type { PublicGameState } from '../../../domain/public-game-state';
import type { SocketServerRef } from './socket-server.ref';

/**
 * Broadcasts to the Socket.IO room named after the room code. Event names
 * are part of the protocol: keep them in sync with `socketEvents` in
 * Frontend/src/app/features/game/game-page/game-page.ts.
 */
export class SocketIoGameEvents implements GameEvents {
  constructor(private readonly server: SocketServerRef) {}

  gameStarted(state: PublicGameState): void {
    this.emit('game.started', state);
  }

  cardFlipped(state: PublicGameState): void {
    this.emit('card.flip.applied', state);
  }

  scoreUpdated(state: PublicGameState): void {
    this.emit('score.updated', state);
  }

  turnChanged(state: PublicGameState): void {
    this.emit('turn.changed', state);
  }

  cardsHidden(state: PublicGameState): void {
    this.emit('cards.hidden', state);
  }

  gameFinished(state: PublicGameState): void {
    this.emit('game.finished', state);
  }

  stateUpdated(state: PublicGameState): void {
    this.emit('game.state.updated', state);
  }

  private emit(event: string, state: PublicGameState): void {
    this.server.get().to(state.roomCode).emit(event, state);
  }
}
