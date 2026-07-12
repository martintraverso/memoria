import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { SocketService } from '../../../core/services/socket';

interface GameCardView {
  id: string;
  value: string;
  state: 'hidden' | 'revealed' | 'matched' | 'blocked';
}

interface GameScoreView {
  playerId: string;
  playerName: string;
  points: number;
}

interface GameStateView {
  roomCode: string;
  boardSize: number;
  status: 'playing' | 'finished';
  players: { id: string; name: string }[];
  turnPlayerId: string | null;
  cards: GameCardView[];
  scores: GameScoreView[];
  winnerPlayerId: string | null;
}

@Component({
  selector: 'app-game-page',
  imports: [RouterLink],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage implements OnInit, OnDestroy {
  roomCode = '';
  playerId = '';
  boardSize = 4;
  gameState: GameStateView | null = null;
  errorMessage = '';
  connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'connecting';
  isStarter = false;

  private readonly socketEvents = [
    'game.started',
    'game.state.updated',
    'card.flip.applied',
    'cards.hidden',
    'turn.changed',
    'score.updated',
    'game.finished',
  ];
  private readonly connectionEvents = ['connect', 'disconnect'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly socketService: SocketService,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.roomCode = params.get('room')?.trim().toUpperCase() ?? '';
    this.playerId = params.get('player')?.trim() ?? '';
    this.boardSize = Number(params.get('size') ?? 4);
    this.isStarter = params.get('starter') === '1';

    if (!this.roomCode || !this.playerId) {
      this.errorMessage = 'Faltan datos de sala o jugador para iniciar la partida.';
      return;
    }

    this.socketService.on('connect', () => {
      this.connectionStatus = 'connected';
      this.requestLatestState();
      this.triggerViewUpdate();
    });

    this.socketService.on('disconnect', () => {
      this.connectionStatus = 'disconnected';
      this.triggerViewUpdate();
    });

    for (const eventName of this.socketEvents) {
      this.socketService.on<GameStateView>(eventName, (state) => {
        this.gameState = state;
        this.triggerViewUpdate();
      });
    }

    this.requestLatestState();
    if (this.isStarter) {
      this.socketService.emit('game.start.request', {
        roomCode: this.roomCode,
        playerId: this.playerId,
        boardSize: this.boardSize,
      });
    }
    this.requestLatestState();
  }

  ngOnDestroy(): void {
    for (const eventName of this.connectionEvents) {
      this.socketService.off(eventName);
    }

    for (const eventName of this.socketEvents) {
      this.socketService.off(eventName);
    }
  }

  flipCard(cardId: string): void {
    if (!this.gameState || !this.canPlay) {
      return;
    }

    this.socketService.emit('card.flip.request', {
      roomCode: this.roomCode,
      playerId: this.playerId,
      cardId,
    });
  }

  canFlip(card: GameCardView): boolean {
    return this.canPlay && !this.isWaitingResolution && card.state === 'hidden';
  }

  get canPlay(): boolean {
    return (
      !!this.gameState &&
      this.gameState.status === 'playing' &&
      this.gameState.turnPlayerId === this.playerId
    );
  }

  get isWaitingResolution(): boolean {
    if (!this.gameState) {
      return false;
    }

    const revealedCards = this.gameState.cards.filter(
      (card) => card.state === 'revealed',
    );
    return revealedCards.length === 2;
  }

  get currentPlayerName(): string {
    if (!this.gameState) {
      return '';
    }

    return (
      this.gameState.players.find((player) => player.id === this.playerId)?.name ??
      'Jugador'
    );
  }

  get opponentName(): string {
    if (!this.gameState) {
      return '';
    }

    return (
      this.gameState.players.find((player) => player.id !== this.playerId)?.name ??
      'Rival'
    );
  }

  get currentPlayerScore(): number {
    if (!this.gameState) {
      return 0;
    }

    return (
      this.gameState.scores.find((score) => score.playerId === this.playerId)
        ?.points ?? 0
    );
  }

  get opponentScore(): number {
    if (!this.gameState) {
      return 0;
    }

    return (
      this.gameState.scores.find((score) => score.playerId !== this.playerId)
        ?.points ?? 0
    );
  }

  get turnLabel(): string {
    if (!this.gameState || this.gameState.status === 'finished') {
      return 'Partida finalizada';
    }

    if (this.isWaitingResolution) {
      return 'Resolviendo jugada...';
    }

    return this.canPlay ? 'Tu turno' : 'Turno rival';
  }

  get statusLabel(): string {
    if (!this.gameState) {
      return 'Sin estado';
    }
    return this.gameState.status === 'playing' ? 'En juego' : 'Finalizada';
  }

  get resultLabel(): string {
    if (!this.gameState || this.gameState.status !== 'finished') {
      return '';
    }
    return this.gameState.winnerPlayerId ? `Ganó ${this.winnerName}` : 'Empate';
  }

  cardLabel(card: GameCardView): string {
    if (card.state === 'hidden') {
      return '?';
    }

    if (card.state === 'blocked') {
      return 'X';
    }

    return card.value.replace('img-', '');
  }

  cardValueIndex(card: GameCardView): number {
    const parsed = Number(card.value.replace('img-', ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return parsed;
  }

  cardShapeClass(card: GameCardView): string {
    const index = this.cardValueIndex(card) % 5;
    const shapeMap = ['shape-circle', 'shape-square', 'shape-diamond', 'shape-triangle', 'shape-hexagon'];
    return shapeMap[index];
  }

  cardFaceColor(card: GameCardView): string {
    const hues = [300, 55, 165, 20, 250, 135];
    const hue = hues[this.cardValueIndex(card) % hues.length];
    return `oklch(62% 0.19 ${hue})`;
  }

  cardClass(card: GameCardView): string {
    return `card-${card.state}`;
  }

  get connectionLabel(): string {
    if (this.connectionStatus === 'connected') {
      return 'Conectado';
    }

    if (this.connectionStatus === 'disconnected') {
      return 'Desconectado (reintentando...)';
    }

    return 'Conectando...';
  }

  get winnerName(): string {
    if (!this.gameState || !this.gameState.winnerPlayerId) {
      return 'Empate';
    }
    const winner = this.gameState.scores.find(
      (score) => score.playerId === this.gameState?.winnerPlayerId,
    );
    return winner?.playerName ?? 'Empate';
  }

  private requestLatestState(): void {
    this.socketService.emit('room.subscribe', {
      roomCode: this.roomCode,
    });
    this.socketService.emit('game.state.request', {
      roomCode: this.roomCode,
    });
  }

  private triggerViewUpdate(): void {
    this.changeDetectorRef.detectChanges();
  }
}
