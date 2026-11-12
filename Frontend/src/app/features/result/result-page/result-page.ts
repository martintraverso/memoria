import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameStateSnapshot } from '../../../core/services/rooms-api.service';
import { SocketService } from '../../../core/services/socket';

export type ResultOutcome = 'win' | 'lose' | 'draw' | 'neutral';

interface WsException {
  message?: string;
  cause?: { pattern?: string };
}

/** Events that carry the full game state. */
const STATE_EVENTS = ['game.state.updated', 'game.rematch.requested', 'game.started'];

/** What the server sends for errors it doesn't describe. */
const GENERIC_SERVER_ERROR = 'Internal server error';

@Component({
  selector: 'app-result-page',
  imports: [RouterLink],
  templateUrl: './result-page.html',
  styleUrl: './result-page.scss',
})
export class ResultPage implements OnInit, OnDestroy {
  roomCode = '';
  playerId = '';
  gameState: GameStateSnapshot | null = null;
  errorMessage = '';
  rematchError = '';
  rematchPending = false;

  private leaving = false;
  private readonly onState = (state: GameStateSnapshot) => this.applyState(state);
  private readonly onConnect = () => this.requestState();
  private readonly onException = (error: WsException) => this.handleException(error);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly socketService: SocketService,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.roomCode = params.get('room')?.trim().toUpperCase() ?? '';
    this.playerId = params.get('player')?.trim() ?? '';

    if (!this.roomCode) {
      this.errorMessage = 'Faltan datos de sala para mostrar el resultado.';
      return;
    }

    for (const eventName of STATE_EVENTS) {
      this.socketService.on(eventName, this.onState);
    }
    this.socketService.on('connect', this.onConnect);
    this.socketService.on('exception', this.onException);
    this.requestState();
  }

  ngOnDestroy(): void {
    for (const eventName of STATE_EVENTS) {
      this.socketService.off(eventName, this.onState);
    }
    this.socketService.off('connect', this.onConnect);
    this.socketService.off('exception', this.onException);
  }

  requestRematch(): void {
    if (!this.canRequestRematch) {
      return;
    }
    this.rematchError = '';
    this.rematchPending = true;
    this.socketService.emit('game.rematch.request', {
      roomCode: this.roomCode,
      playerId: this.playerId,
    });
  }

  /** `neutral` when the viewer isn't known: show the winner by name. */
  get outcome(): ResultOutcome {
    if (!this.gameState || !this.isPlayer) {
      return 'neutral';
    }
    if (!this.gameState.winnerPlayerId) {
      return 'draw';
    }
    return this.gameState.winnerPlayerId === this.playerId ? 'win' : 'lose';
  }

  get outcomeEmoji(): string {
    switch (this.outcome) {
      case 'win':
        return '🏆';
      case 'lose':
        return '😔';
      case 'draw':
        return '🤝';
      default:
        return this.gameState?.winnerPlayerId ? '🏆' : '🤝';
    }
  }

  get outcomeTitle(): string {
    switch (this.outcome) {
      case 'win':
        return '¡Ganaste!';
      case 'lose':
        return 'Perdiste';
      case 'draw':
        return 'Empate';
      default:
        return this.winnerName ? `Ganó ${this.winnerName}` : 'Empate';
    }
  }

  get scoreLine(): string {
    if (!this.gameState) {
      return '';
    }
    if (this.isPlayer) {
      return `Vos ${this.myScore} – ${this.rivalScore} ${this.rivalName}`;
    }
    const [first, second] = this.gameState.scores;
    if (!first || !second) {
      return '';
    }
    return `${first.playerName} ${first.points} – ${second.points} ${second.playerName}`;
  }

  get myScore(): number {
    return this.gameState?.scores.find((score) => score.playerId === this.playerId)?.points ?? 0;
  }

  get rivalScore(): number {
    return this.rivalScoreEntry?.points ?? 0;
  }

  get rivalName(): string {
    return this.rivalScoreEntry?.playerName ?? 'Rival';
  }

  get iRequestedRematch(): boolean {
    return !!this.gameState?.rematchRequestedBy.includes(this.playerId);
  }

  get rivalRequestedRematch(): boolean {
    return !!this.gameState?.rematchRequestedBy.some((id) => id !== this.playerId);
  }

  get canRequestRematch(): boolean {
    return (
      this.isPlayer &&
      this.gameState?.status === 'finished' &&
      !this.iRequestedRematch &&
      !this.rematchPending
    );
  }

  get rematchButtonLabel(): string {
    if (this.iRequestedRematch || this.rematchPending) {
      return `Esperando a ${this.rivalName}…`;
    }
    return this.rivalRequestedRematch ? 'Aceptar revancha' : 'Revancha';
  }

  /** The viewer is one of the match's players. */
  get isPlayer(): boolean {
    return !!this.playerId && !!this.gameState?.players.some((p) => p.id === this.playerId);
  }

  private get winnerName(): string {
    const winnerId = this.gameState?.winnerPlayerId;
    return this.gameState?.scores.find((score) => score.playerId === winnerId)?.playerName ?? '';
  }

  private get rivalScoreEntry() {
    return this.gameState?.scores.find((score) => score.playerId !== this.playerId);
  }

  private requestState(): void {
    this.socketService.emit('room.subscribe', { roomCode: this.roomCode });
    this.socketService.emit('game.state.request', { roomCode: this.roomCode });
  }

  private applyState(state: GameStateSnapshot): void {
    this.gameState = state;
    this.rematchPending = false;
    if (state.status === 'playing') {
      this.goToGame(state);
      return;
    }
    this.changeDetectorRef.detectChanges();
  }

  /** The match is on again (a rematch started, or it wasn't over yet). */
  private goToGame(state: GameStateSnapshot): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    void this.router.navigate(['/game'], {
      queryParams: {
        room: this.roomCode,
        player: this.playerId,
        size: state.boardSize,
        starter: '0',
      },
    });
  }

  private handleException(error: WsException): void {
    if (error?.cause?.pattern !== 'game.rematch.request') {
      return;
    }
    this.rematchPending = false;
    this.rematchError =
      error.message && error.message !== GENERIC_SERVER_ERROR
        ? error.message
        : 'No se pudo pedir la revancha.';
    this.changeDetectorRef.detectChanges();
  }
}
